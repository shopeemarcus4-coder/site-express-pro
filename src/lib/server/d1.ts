import {
  publishedProjects,
  workspaceSchema,
  StoreError,
  type AuthUser,
  type Workspace,
  type WorkspaceSnapshot,
} from "./store";

type D1Value = string | number | null;
export interface D1Statement {
  bind(...values: D1Value[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}
export interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

type UserRow = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: AuthUser["role"];
  password_hash: string;
};
type SessionUserRow = Omit<UserRow, "password_hash">;
const initialized = new WeakMap<D1Database, Promise<void>>();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(value: string): Promise<string> {
  return hex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
  );
}

async function passwordHash(
  password: string,
  salt = hex(crypto.getRandomValues(new Uint8Array(16))),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: Uint8Array.from(salt.match(/../g)!.map((part) => parseInt(part, 16))),
        iterations: 210_000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
  return `pbkdf2-sha256:210000:${salt}:${hex(hash)}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2-sha256" ||
    parts[1] !== "210000" ||
    !/^[a-f0-9]{32}$/.test(parts[2] ?? "") ||
    !/^[a-f0-9]{64}$/.test(parts[3] ?? "")
  )
    return false;
  const actual = await passwordHash(password, parts[2]);
  let different = 0;
  for (let i = 0; i < actual.length; i++) different |= actual.charCodeAt(i) ^ stored.charCodeAt(i);
  return different === 0;
}

function publicUser(row: SessionUserRow): AuthUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function validateWorkspace(raw: unknown): Workspace {
  const workspace = workspaceSchema.parse(raw);
  if (
    !uniqueIds(workspace.businesses) ||
    !uniqueIds(workspace.sites) ||
    !uniqueIds(workspace.contracts) ||
    new Set(workspace.sites.map((item) => item.slug)).size !== workspace.sites.length
  ) {
    throw new StoreError("invalid_workspace", "Há IDs ou endereços de sites repetidos.");
  }
  const businessIds = new Set(workspace.businesses.map((item) => item.id));
  if (
    workspace.sites.some((item) => item.businessId && !businessIds.has(item.businessId)) ||
    workspace.contracts.some((item) => item.businessId && !businessIds.has(item.businessId))
  ) {
    throw new StoreError(
      "invalid_workspace",
      "Um site ou contrato aponta para uma empresa inexistente.",
    );
  }
  return workspace;
}

export class D1SiteExpressStore {
  constructor(private readonly db: D1Database) {}

  private async ready(): Promise<void> {
    let pending = initialized.get(this.db);
    if (!pending) {
      pending = this.db
        .exec(
          `
        CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','creator','super_admin')), created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workspaces (organization_id TEXT PRIMARY KEY, version INTEGER NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS public_sites (slug TEXT PRIMARY KEY, organization_id TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workspace_write_guard (organization_id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));
        CREATE TABLE IF NOT EXISTS image_usage (organization_id TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY (organization_id, day));
        CREATE TABLE IF NOT EXISTS guest_image_usage (scope TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY (scope, day));
      `,
        )
        .then(() => undefined)
        .catch((error: unknown) => {
          initialized.delete(this.db);
          throw error;
        });
      initialized.set(this.db, pending);
    }
    await pending;
  }

  async consumeImageQuota(organizationId: string, day: string, limit: number): Promise<boolean> {
    await this.ready();
    const result = await this.db
      .prepare(
        `
      INSERT INTO image_usage (organization_id, day, calls) VALUES (?, ?, 1)
      ON CONFLICT (organization_id, day) DO UPDATE SET calls = calls + 1
      WHERE calls < ?
    `,
      )
      .bind(organizationId, day, limit)
      .run();
    return result.success && (result.meta?.changes ?? 0) > 0;
  }

  async consumeGuestImageQuota(
    clientId: string,
    day: string,
    perClientLimit: number,
    globalLimit: number,
  ): Promise<boolean> {
    await this.ready();
    const statement = `
      INSERT INTO guest_image_usage (scope, day, calls) VALUES (?, ?, 1)
      ON CONFLICT (scope, day) DO UPDATE SET calls = calls + 1
      WHERE calls < ?
    `;
    const perClient = await this.db
      .prepare(statement)
      .bind(`client:${clientId}`, day, perClientLimit)
      .run();
    if (!perClient.success || (perClient.meta?.changes ?? 0) === 0) return false;
    const global = await this.db.prepare(statement).bind("global", day, globalLimit).run();
    return global.success && (global.meta?.changes ?? 0) > 0;
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
  }): Promise<AuthUser> {
    await this.ready();
    const organizationId = crypto.randomUUID();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      organizationId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: "owner",
    };
    const now = new Date().toISOString();
    try {
      await this.db.batch([
        this.db
          .prepare("INSERT INTO organizations VALUES (?, ?, ?)")
          .bind(organizationId, input.organizationName?.trim() || user.name, now),
        this.db
          .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(
            user.id,
            organizationId,
            user.name,
            user.email,
            await passwordHash(input.password),
            user.role,
            now,
          ),
        this.db
          .prepare("INSERT INTO workspaces VALUES (?, 0, ?, ?)")
          .bind(organizationId, JSON.stringify({ businesses: [], sites: [], contracts: [] }), now),
      ]);
      return user;
    } catch (error) {
      if (/UNIQUE constraint failed: users.email/i.test(String(error)))
        throw new StoreError("duplicate_email", "Este e-mail já está cadastrado.");
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthUser | null> {
    await this.ready();
    const row = await this.db
      .prepare(
        "SELECT id, organization_id, name, email, role, password_hash FROM users WHERE email = ?",
      )
      .bind(email.trim().toLowerCase())
      .first<UserRow>();
    return row && (await passwordMatches(password, row.password_hash)) ? publicUser(row) : null;
  }

  async createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
    await this.ready();
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await this.db
      .prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)")
      .bind(await digest(token), userId, expiresAt, new Date().toISOString())
      .run();
    return { token, expiresAt };
  }

  async getSession(token: string): Promise<AuthUser | null> {
    await this.ready();
    const row = await this.db
      .prepare(
        `SELECT u.id, u.organization_id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .bind(await digest(token), Date.now())
      .first<SessionUserRow>();
    return row ? publicUser(row) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.ready();
    await this.db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await digest(token))
      .run();
  }

  async getWorkspace(organizationId: string): Promise<WorkspaceSnapshot> {
    await this.ready();
    const row = await this.db
      .prepare("SELECT version, body FROM workspaces WHERE organization_id = ?")
      .bind(organizationId)
      .first<{ version: number; body: string }>();
    if (!row) throw new Error("Workspace does not exist");
    return { version: row.version, workspace: workspaceSchema.parse(JSON.parse(row.body)) };
  }

  async saveWorkspace(
    organizationId: string,
    baseVersion: number,
    raw: unknown,
  ): Promise<WorkspaceSnapshot> {
    await this.ready();
    const workspace = validateWorkspace(raw);
    const publicProjects = publishedProjects(workspace);
    const now = new Date().toISOString();
    const statements: D1Statement[] = [
      // D1 batch is atomic. The CHECK constraint aborts the entire batch on a stale version.
      this.db
        .prepare(
          "INSERT INTO workspace_write_guard VALUES (?, (SELECT CASE WHEN version = ? THEN 1 ELSE 0 END FROM workspaces WHERE organization_id = ?))",
        )
        .bind(organizationId, baseVersion, organizationId),
      this.db
        .prepare(
          "UPDATE workspaces SET version = ?, body = ?, updated_at = ? WHERE organization_id = ?",
        )
        .bind(baseVersion + 1, JSON.stringify(workspace), now, organizationId),
      this.db.prepare("DELETE FROM public_sites WHERE organization_id = ?").bind(organizationId),
    ];
    for (const entry of workspace.sites) {
      const publicProject = publicProjects.get(entry.id);
      if (publicProject) {
        statements.push(
          this.db
            .prepare("INSERT INTO public_sites VALUES (?, ?, ?, ?)")
            .bind(
              entry.slug,
              organizationId,
              JSON.stringify({ title: entry.title, slug: entry.slug, content: publicProject }),
              now,
            ),
        );
      }
    }
    statements.push(
      this.db
        .prepare("DELETE FROM workspace_write_guard WHERE organization_id = ?")
        .bind(organizationId),
    );
    try {
      await this.db.batch(statements);
    } catch (error) {
      if (/UNIQUE constraint failed: public_sites.slug/i.test(String(error)))
        throw new StoreError("duplicate_slug", "Este endereço de site já está em uso.");
      if (/workspace_write_guard|CHECK constraint failed: valid = 1/i.test(String(error)))
        throw new StoreError(
          "stale_version",
          "Os dados foram alterados em outra sessão. Recarregue antes de salvar.",
        );
      throw error;
    }
    return { version: baseVersion + 1, workspace };
  }

  async getPublicSite(
    slug: string,
  ): Promise<{ title: string; slug: string; content: Record<string, unknown> } | null> {
    await this.ready();
    const row = await this.db
      .prepare("SELECT body FROM public_sites WHERE slug = ?")
      .bind(slug)
      .first<{ body: string }>();
    return row
      ? (JSON.parse(row.body) as { title: string; slug: string; content: Record<string, unknown> })
      : null;
  }
}

import { randomBytes, randomUUID, scryptSync, createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { SiteProject } from "../../features/studio/types";
import { siteProjectSchema } from "./site-project";

const recordId = z.string().min(1).max(100);
const business = z.object({ id: recordId, name: z.string().min(1).max(200) }).passthrough();
const site = z
  .object({
    id: recordId,
    title: z.string().min(1).max(200),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    status: z.enum(["draft", "published", "suspended"]),
    businessId: recordId.optional(),
    publicData: z.record(z.unknown()).optional(),
  })
  .passthrough();
const contract = z.object({ id: recordId, businessId: recordId.optional() }).passthrough();
export const workspaceSchema = z.object({
  businesses: z.array(business).max(1000),
  sites: z.array(site).max(1000),
  contracts: z.array(contract).max(1000),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceSnapshot = { version: number; workspace: Workspace };
export type AuthUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "owner" | "creator" | "super_admin";
};
type UserRow = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: AuthUser["role"];
  password_hash: string;
};
type SessionUserRow = Omit<UserRow, "password_hash">;

export class StoreError extends Error {
  constructor(
    public readonly code:
      "duplicate_email" | "stale_version" | "duplicate_slug" | "invalid_workspace",
    message: string,
  ) {
    super(message);
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function uniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function publishedProjects(workspace: Workspace): Map<string, SiteProject> {
  const result = new Map<string, SiteProject>();
  for (const entry of workspace.sites) {
    if (entry.status !== "published") continue;
    const parsed = siteProjectSchema.safeParse(entry.publicData);
    if (!parsed.success || parsed.data.id !== entry.id || parsed.data.slug !== entry.slug) {
      throw new StoreError(
        "invalid_workspace",
        `O site ${entry.title} precisa de dados completos e consistentes antes da publicação.`,
      );
    }
    result.set(entry.id, parsed.data);
  }
  return result;
}

export class SiteExpressStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
        name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner','creator','super_admin')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        version INTEGER NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS public_sites (
        slug TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        body TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  register(input: {
    name: string;
    email: string;
    password: string;
    organizationName?: string;
  }): AuthUser {
    const email = input.email.trim().toLowerCase();
    const now = new Date().toISOString();
    const organizationId = randomUUID();
    const user: AuthUser = {
      id: randomUUID(),
      organizationId,
      name: input.name.trim(),
      email,
      role: "owner",
    };
    const workspace: Workspace = { businesses: [], sites: [], contracts: [] };
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT INTO organizations VALUES (?, ?, ?)")
        .run(organizationId, input.organizationName?.trim() || input.name.trim(), now);
      this.db
        .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(
          user.id,
          organizationId,
          user.name,
          email,
          hashPassword(input.password),
          user.role,
          now,
        );
      this.db
        .prepare("INSERT INTO workspaces VALUES (?, 0, ?, ?)")
        .run(organizationId, JSON.stringify(workspace), now);
      this.db.exec("COMMIT");
      return user;
    } catch (error) {
      this.db.exec("ROLLBACK");
      if (String(error).includes("UNIQUE constraint failed: users.email"))
        throw new StoreError("duplicate_email", "Este e-mail já está cadastrado.");
      throw error;
    }
  }

  login(email: string, password: string): AuthUser | null {
    const row = this.db
      .prepare(
        "SELECT id, organization_id, name, email, role, password_hash FROM users WHERE email = ?",
      )
      .get(email.trim().toLowerCase()) as UserRow | undefined;
    if (!row || !passwordMatches(password, row.password_hash)) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      email: row.email,
      role: row.role,
    };
  }

  createSession(userId: string): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    this.db
      .prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)")
      .run(tokenDigest(token), userId, expiresAt, new Date().toISOString());
    return { token, expiresAt };
  }

  getSession(token: string): AuthUser | null {
    const row = this.db
      .prepare(
        `SELECT u.id, u.organization_id, u.name, u.email, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(tokenDigest(token), Date.now()) as SessionUserRow | undefined;
    return row
      ? {
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          email: row.email,
          role: row.role,
        }
      : null;
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenDigest(token));
  }

  getWorkspace(organizationId: string): WorkspaceSnapshot {
    const row = this.db
      .prepare("SELECT version, body FROM workspaces WHERE organization_id = ?")
      .get(organizationId) as { version: number; body: string } | undefined;
    if (!row) throw new Error("Workspace does not exist");
    return { version: row.version, workspace: workspaceSchema.parse(JSON.parse(row.body)) };
  }

  saveWorkspace(organizationId: string, baseVersion: number, raw: unknown): WorkspaceSnapshot {
    const workspace = workspaceSchema.parse(raw);
    const publicProjects = publishedProjects(workspace);
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
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.db
        .prepare("SELECT version FROM workspaces WHERE organization_id = ?")
        .get(organizationId) as { version: number } | undefined;
      if (!current || current.version !== baseVersion)
        throw new StoreError(
          "stale_version",
          "Os dados foram alterados em outra sessão. Recarregue antes de salvar.",
        );
      this.db
        .prepare(
          "UPDATE workspaces SET version = ?, body = ?, updated_at = ? WHERE organization_id = ?",
        )
        .run(baseVersion + 1, JSON.stringify(workspace), now, organizationId);
      this.db.prepare("DELETE FROM public_sites WHERE organization_id = ?").run(organizationId);
      const insert = this.db.prepare("INSERT INTO public_sites VALUES (?, ?, ?, ?)");
      for (const entry of workspace.sites) {
        const publicProject = publicProjects.get(entry.id);
        if (publicProject) {
          insert.run(
            entry.slug,
            organizationId,
            JSON.stringify({ title: entry.title, slug: entry.slug, content: publicProject }),
            now,
          );
        }
      }
      this.db.exec("COMMIT");
      return { version: baseVersion + 1, workspace };
    } catch (error) {
      this.db.exec("ROLLBACK");
      if (String(error).includes("UNIQUE constraint failed: public_sites.slug"))
        throw new StoreError("duplicate_slug", "Este endereço de site já está em uso.");
      throw error;
    }
  }

  getPublicSite(
    slug: string,
  ): { title: string; slug: string; content: Record<string, unknown> } | null {
    const row = this.db.prepare("SELECT body FROM public_sites WHERE slug = ?").get(slug) as
      { body: string } | undefined;
    return row
      ? (JSON.parse(row.body) as { title: string; slug: string; content: Record<string, unknown> })
      : null;
  }
}

let singleton: SiteExpressStore | undefined;
export function getStore(): SiteExpressStore {
  if (!singleton) {
    const path = process.env["SITE_EXPRESS_DB_PATH"] || join("/tmp", "site-express-pro.sqlite");
    singleton = new SiteExpressStore(path);
  }
  return singleton;
}

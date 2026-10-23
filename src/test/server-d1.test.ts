import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { D1SiteExpressStore, type D1Database, type D1Statement } from "../lib/server/d1";
import { getStore, StorageUnavailableError } from "../lib/server/provider";
import { createSiteProject } from "../features/studio/presets";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

class FakeD1Statement implements D1Statement {
  private values: (string | number | null)[] = [];
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
  ) {}
  bind(...values: (string | number | null)[]): D1Statement {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.database.prepare(this.sql).get(...this.values) ?? null) as T | null;
  }
  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class FakeD1 implements D1Database {
  readonly database = new DatabaseSync(":memory:");
  prepare(query: string): D1Statement {
    return new FakeD1Statement(this.database, query);
  }
  async exec(query: string): Promise<void> {
    this.database.exec(query);
  }
  async batch(statements: D1Statement[]): Promise<unknown[]> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  close(): void {
    this.database.close();
  }
}

describe("Cloudflare D1 store", () => {
  it("selects D1 from the request and fails clearly without a binding", () => {
    const request = new Request("https://example.test") as Request & { runtime?: unknown };
    request.runtime = { name: "cloudflare", cloudflare: { env: {} } };
    expect(() => getStore(request)).toThrow(StorageUnavailableError);
    const db = new FakeD1();
    request.runtime = { name: "cloudflare", cloudflare: { env: { SITE_EXPRESS_DB: db } } };
    expect(getStore(request)).toBeInstanceOf(D1SiteExpressStore);
    db.close();
  });

  it("registers, authenticates, isolates tenants, and atomically rejects stale writes and duplicate slugs", async () => {
    const db = new FakeD1();
    const store = new D1SiteExpressStore(db);
    try {
      const ana = await store.register({
        name: "Ana",
        email: "ana@example.test",
        password: "long-password-for-ana",
      });
      const bia = await store.register({
        name: "Bia",
        email: "bia@example.test",
        password: "long-password-for-bia",
      });
      expect((await store.login("ANA@example.test", "long-password-for-ana"))?.id).toBe(ana.id);
      expect(await store.login("ana@example.test", "wrong")).toBeNull();
      const session = await store.createSession(ana.id);
      expect((await store.getSession(session.token))?.id).toBe(ana.id);
      const project = createSiteProject({ name: "Casa", id: "s1" });
      const workspace = {
        businesses: [{ id: "b1", name: "Casa" }],
        sites: [
          {
            id: "s1",
            title: "Casa",
            slug: "casa",
            status: "published",
            businessId: "b1",
            publicData: { ...project, secret: "private" },
            secret: "private",
          },
        ],
        contracts: [],
      };
      expect((await store.saveWorkspace(ana.organizationId, 0, workspace)).version).toBe(1);
      expect((await store.getPublicSite("casa"))?.content).toMatchObject({
        id: "s1",
        business: { name: "Casa" },
      });
      expect((await store.getPublicSite("casa"))?.content).not.toHaveProperty("secret");
      await expect(store.saveWorkspace(ana.organizationId, 0, workspace)).rejects.toThrow(
        /outra sessão/,
      );
      await expect(store.saveWorkspace(bia.organizationId, 0, workspace)).rejects.toThrow(
        /já está em uso/,
      );
      expect((await store.getWorkspace(bia.organizationId)).version).toBe(0);
      expect((await store.getWorkspace(bia.organizationId)).workspace.businesses).toEqual([]);
      await store.deleteSession(session.token);
      expect(await store.getSession(session.token)).toBeNull();
    } finally {
      db.close();
    }
  });
});

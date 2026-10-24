import { describe, expect, it } from "vitest";
import { SiteExpressStore, StoreError } from "../lib/server/store";
import { createSiteProject } from "../features/studio/presets";

describe("SiteExpressStore", () => {
  it("limits image API calls per organization and UTC day", () => {
    const store = new SiteExpressStore(":memory:");
    try {
      const user = store.register({
        name: "Ana",
        email: "ana@quota.test",
        password: "safe-password",
      });
      expect(store.consumeImageQuota(user.organizationId, "2026-10-24", 2)).toBe(true);
      expect(store.consumeImageQuota(user.organizationId, "2026-10-24", 2)).toBe(true);
      expect(store.consumeImageQuota(user.organizationId, "2026-10-24", 2)).toBe(false);
      expect(store.consumeImageQuota(user.organizationId, "2026-10-25", 2)).toBe(true);
    } finally {
      store.close();
    }
  });
  it("isolates tenants and rejects stale writes", () => {
    const store = new SiteExpressStore(":memory:");
    try {
      const ana = store.register({
        name: "Ana",
        email: "ana@example.com",
        password: "uma-senha-forte-123",
      });
      const bia = store.register({
        name: "Bia",
        email: "bia@example.com",
        password: "outra-senha-forte-456",
      });
      expect(store.login("ANA@example.com", "uma-senha-forte-123")?.id).toBe(ana.id);
      expect(store.login("ana@example.com", "senha-errada")).toBeNull();
      expect(() =>
        store.register({ name: "Outra", email: "ana@example.com", password: "mais-uma-senha-123" }),
      ).toThrow(StoreError);

      const saved = store.saveWorkspace(ana.organizationId, 0, {
        businesses: [{ id: "business-1", name: "Casa da Ana" }],
        sites: [
          {
            id: "site-1",
            title: "Casa da Ana",
            slug: "casa-da-ana",
            status: "draft",
            businessId: "business-1",
          },
        ],
        contracts: [],
      });
      expect(saved.version).toBe(1);
      expect(store.getWorkspace(bia.organizationId).workspace.businesses).toEqual([]);
      expect(() => store.saveWorkspace(ana.organizationId, 0, saved.workspace)).toThrowError(
        /outra sessão/,
      );
      expect(store.getPublicSite("casa-da-ana")).toBeNull();
    } finally {
      store.close();
    }
  });

  it("publishes only selected site content and detects global slug conflicts", () => {
    const store = new SiteExpressStore(":memory:");
    try {
      const first = store.register({
        name: "Primeiro",
        email: "first@example.com",
        password: "first-strong-password",
      });
      const second = store.register({
        name: "Segundo",
        email: "second@example.com",
        password: "second-strong-password",
      });
      const project = createSiteProject({ name: "Ateliê", id: "s1" });
      const workspace = {
        businesses: [{ id: "b1", name: "Ateliê" }],
        sites: [
          {
            id: "s1",
            title: "Ateliê",
            slug: "atelie",
            status: "published",
            businessId: "b1",
            publicData: { ...project, editorSecret: "private" },
            editorSecret: "private",
          },
        ],
        contracts: [{ id: "c1", businessId: "b1", amount: 100 }],
      };
      store.saveWorkspace(first.organizationId, 0, workspace);
      expect(store.getPublicSite("atelie")?.content).toMatchObject({
        id: "s1",
        business: { name: "Ateliê" },
      });
      expect(store.getPublicSite("atelie")?.content).not.toHaveProperty("editorSecret");
      expect(() => store.saveWorkspace(second.organizationId, 0, workspace)).toThrowError(
        /já está em uso/,
      );
      expect(store.getWorkspace(second.organizationId).version).toBe(0);
      store.saveWorkspace(first.organizationId, 1, {
        ...workspace,
        sites: [{ ...workspace.sites[0], status: "suspended" }],
      });
      expect(store.getPublicSite("atelie")).toBeNull();
    } finally {
      store.close();
    }
  });

  it("refuses to publish an incomplete site project", () => {
    const store = new SiteExpressStore(":memory:");
    try {
      const user = store.register({
        name: "Editor",
        email: "editor@example.com",
        password: "editor-strong-password",
      });
      expect(() =>
        store.saveWorkspace(user.organizationId, 0, {
          businesses: [],
          contracts: [],
          sites: [
            {
              id: "s1",
              title: "Incomplete",
              slug: "incomplete",
              status: "published",
              publicData: {},
            },
          ],
        }),
      ).toThrowError(/dados completos/);
      expect(store.getPublicSite("incomplete")).toBeNull();
      expect(store.getWorkspace(user.organizationId).version).toBe(0);
    } finally {
      store.close();
    }
  });

  it("publishes compressed inline media accepted by the editor", () => {
    const store = new SiteExpressStore(":memory:");
    try {
      const user = store.register({
        name: "Editor",
        email: "media@example.com",
        password: "media-strong-password",
      });
      const project = createSiteProject({ name: "Estúdio", id: "media-site" });
      project.slug = "estudio-media";
      project.appearance.heroImage = `data:image/webp;base64,${"a".repeat(180_000)}`;
      expect(() =>
        store.saveWorkspace(user.organizationId, 0, {
          businesses: [],
          contracts: [],
          sites: [
            {
              id: project.id,
              title: project.name,
              slug: project.slug,
              status: "published",
              publicData: project,
            },
          ],
        }),
      ).not.toThrow();
      expect(store.getPublicSite(project.slug)?.content).toMatchObject({
        appearance: { heroImage: project.appearance.heroImage },
      });
    } finally {
      store.close();
    }
  });

  it("expires and revokes sessions", () => {
    const store = new SiteExpressStore(":memory:");
    try {
      const user = store.register({
        name: "Caio",
        email: "caio@example.com",
        password: "long-enough-password",
      });
      const session = store.createSession(user.id);
      expect(store.getSession(session.token)?.id).toBe(user.id);
      store.deleteSession(session.token);
      expect(store.getSession(session.token)).toBeNull();
    } finally {
      store.close();
    }
  });
});

import type { AuthUser } from "./store";
import { getStore } from "./provider";

export const SESSION_COOKIE = "sx_session";

export function readSessionCookie(request: Request): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const value = match?.slice(SESSION_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : null;
}

export async function getAuthenticatedUser(request: Request): Promise<AuthUser | null> {
  const token = readSessionCookie(request);
  return token ? await getStore(request).getSession(token) : null;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function sessionCookie(request: Request, token: string, maxAgeSeconds: number): string {
  const secure =
    new URL(request.url).protocol === "https:" || process.env["NODE_ENV"] === "production";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export function expiredSessionCookie(request: Request): string {
  return sessionCookie(request, "", 0);
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request, maxBytes = 1_000_000): Promise<unknown> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("too_large");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new Error("content_type");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) throw new Error("too_large");
  return JSON.parse(body) as unknown;
}

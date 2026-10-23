import { describe, expect, it } from "vitest";
import { sessionCookie } from "../lib/server/auth";

describe("session cookie transport", () => {
  it("uses the actual request scheme and ignores untrusted forwarded headers", () => {
    expect(sessionCookie(new Request("https://site.example"), "token", 60)).toContain("; Secure");
    expect(sessionCookie(new Request("http://127.0.0.1:8787"), "token", 60)).not.toContain(
      "; Secure",
    );
    expect(
      sessionCookie(
        new Request("http://127.0.0.1:8787", { headers: { "x-forwarded-proto": "https" } }),
        "token",
        60,
      ),
    ).not.toContain("; Secure");
  });
});

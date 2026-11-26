// T-0133: the request log never holds an invite code. The database keeps only
// their hashes; the logger used to write every path as it came.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "./db/client";
import { createApp, redactInviteCodes } from "./index";

const CODE = "K7QM2XPA";

describe("redactInviteCodes", () => {
  it.each([
    ["/api/v1/coach-invites/K7QM2XPA", "/api/v1/coach-invites/[code]"],
    ["/api/v1/coach-invites/K7QM2XPA/preview", "/api/v1/coach-invites/[code]/preview"],
    ["/api/v1/coaches/u1/coach-invites/K7QM2XPA/revoke", "/api/v1/coaches/u1/coach-invites/[code]/revoke"],
    ["/api/v1/athletes/u2/coach-invites/K7QM2XPA/response", "/api/v1/athletes/u2/coach-invites/[code]/response"],
    ["/api/v1/coach-invites/%20k7qm2xpa%20/preview?x=1", "/api/v1/coach-invites/[code]/preview?x=1"],
    ["/cloud/join/?code=K7QM2XPA", "/cloud/join/?code=[code]"],
    ["/cloud/join/?utm=qr&code=K7QM2XPA#top", "/cloud/join/?utm=qr&code=[code]#top"],
    ["/cloud/welcome/?invite=K7QM2XPA", "/cloud/welcome/?invite=[code]"],
    ["/cloud/signup/?next=%2Fcloud%2Fjoin%2F%3Fcode%3DK7QM2XPA", "/cloud/signup/?next=%2Fcloud%2Fjoin%2F%3Fcode%3D[code]"],
    ["/cloud/login/?next=%2Fcloud%2Fjoin%2F%3Fcode%3DK7QM2XPA%26a%3D1&b=2", "/cloud/login/?next=%2Fcloud%2Fjoin%2F%3Fcode%3D[code]%26a%3D1&b=2"],
  ])("redacts %s", (path, redacted) => {
    expect(redactInviteCodes(`<-- GET ${path}`)).toBe(`<-- GET ${redacted}`);
    expect(redactInviteCodes(`--> POST ${path} 200 3ms`)).toBe(`--> POST ${redacted} 200 3ms`);
  });

  it.each([
    "/api/v1/coaches/u1/coach-invites",
    "/api/v1/coaches/u1/invites/redeem",
    "/api/v1/users/u1",
    "/cloud/join/",
    "/cloud/?codec=x",
    "/api/health",
  ])("leaves %s as it is", (path) => {
    expect(redactInviteCodes(`<-- GET ${path}`)).toBe(`<-- GET ${path}`);
  });
});

describe("the request log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes coach-invite and join paths without the code", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void lines.push(args.join(" ")));
    // No auth or storage: no data routes, but every request is still logged (here as a 404).
    const app = createApp({ db: {} as Db, mode: "production", appUrl: "http://localhost:3000", log: true });
    for (const path of [
      `/api/v1/coach-invites/${CODE}/preview`,
      `/api/v1/coach-invites/${CODE}`,
      `/api/v1/athletes/u2/coach-invites/${CODE}/response`,
      `/api/v1/coaches/u1/coach-invites/${CODE}/revoke`,
      `/cloud/join/?code=${CODE}`,
      `/cloud/welcome/?invite=${CODE}`,
      `/cloud/signup/?next=${encodeURIComponent(`/cloud/join/?code=${CODE}`)}`,
    ]) {
      await app.request(`http://localhost:8787${path}`);
    }
    expect(lines).toHaveLength(14);
    expect(lines.join("\n")).not.toContain(CODE);
    expect(lines[0]).toBe("<-- GET /api/v1/coach-invites/[code]/preview");
  });
});

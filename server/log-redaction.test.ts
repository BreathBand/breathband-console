// T-0133: the request log never holds an invite code. The database keeps only
// their hashes; the logger used to write every path as it came.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "./db/client";
import { createApp, redactAuthTokens, redactInviteCodes, redactLogLine } from "./index";

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

// T-0135: Better Auth's one-time tokens (email verification, password reset) stay out of the log too,
// and so does anything percent-encoded to dodge the redactions.

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.c2VjcmV0.Zm9v";
const RESET = "Ab3dEf6hIj9kLm2n";

describe("redactAuthTokens", () => {
  it.each([
    // Better Auth 1.7's verification link (sendVerificationEmail's url).
    [`/api/auth/verify-email?token=${TOKEN}&callbackURL=http%3A%2F%2Flocalhost%3A3000%2Fcloud%2F`, "/api/auth/verify-email?token=[token]&callbackURL=http%3A%2F%2Flocalhost%3A3000%2Fcloud%2F"],
    // Its reset link (sendResetPassword's url): the token is a path segment.
    [`/api/auth/reset-password/${RESET}?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Fcloud%2Freset%2F`, "/api/auth/reset-password/[token]?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Fcloud%2Freset%2F"],
    // Where that link redirects: the app's reset page with ?token=.
    [`/cloud/reset/?token=${RESET}`, "/cloud/reset/?token=[token]"],
    [`/api/auth/delete-user/callback?token=${TOKEN}&callbackURL=%2F`, "/api/auth/delete-user/callback?token=[token]&callbackURL=%2F"],
    [`/anything/?a=1&token=${TOKEN}#x`, "/anything/?a=1&token=[token]#x"],
    [`/x?TOKEN=${TOKEN}`, "/x?TOKEN=[token]"],
    [`/x?Token=${TOKEN}&ToKeN=${RESET}`, "/x?Token=[token]&ToKeN=[token]"],
    [`/x?id_token=${TOKEN}&access_token=${RESET}`, "/x?id_token=[token]&access_token=[token]"],
    [`/cloud/login/?next=%2Fcloud%2Freset%2F%3Ftoken%3D${RESET}%26a%3D1`, "/cloud/login/?next=%2Fcloud%2Freset%2F%3Ftoken%3D[token]%26a%3D1"],
    [`/cloud/login/?next=%2Fcloud%2Freset%2F%3FTOKEN%3D${RESET}`, "/cloud/login/?next=%2Fcloud%2Freset%2F%3FTOKEN%3D[token]"],
    [`/cloud/login/?next=%252Fcloud%252Freset%252F%253Ftoken%253D${RESET}%2526a%253D1`, "/cloud/login/?next=%252Fcloud%252Freset%252F%253Ftoken%253D[token]%2526a%253D1"],
  ])("redacts %s", (path, redacted) => {
    expect(redactAuthTokens(`<-- GET ${path}`)).toBe(`<-- GET ${redacted}`);
  });

  it.each(["/api/auth/reset-password", "/api/auth/sign-in/email", "/cloud/reset/", "/x?tokens=1", "/api/health"])(
    "leaves %s as it is",
    (path) => {
      expect(redactAuthTokens(`<-- POST ${path}`)).toBe(`<-- POST ${path}`);
    },
  );
});

describe("redactLogLine", () => {
  it("keeps method, path, status and time readable", () => {
    expect(redactLogLine(`--> GET /api/auth/verify-email?token=${TOKEN}&callbackURL=%2F 302 12ms`)).toBe(
      "--> GET /api/auth/verify-email?token=[token]&callbackURL=%2F 302 12ms",
    );
    expect(redactLogLine(`--> GET /api/auth/reset-password/${RESET}?callbackURL=%2Fcloud%2Freset%2F \x1b[36m302\x1b[0m 4ms`)).toBe(
      "--> GET /api/auth/reset-password/[token]?callbackURL=%2Fcloud%2Freset%2F \x1b[36m302\x1b[0m 4ms",
    );
    expect(redactLogLine("--> GET /api/v1/users/u1?x=1 200 3ms")).toBe("--> GET /api/v1/users/u1?x=1 200 3ms");
  });

  it.each([
    // Encodings the redactions don't expect: caught on the decoded copy, then the query (or path) is withheld.
    [`/x?%74oken=${TOKEN}`, "/x?[redacted]"],
    [`/x?%54%4F%4B%45%4E=${TOKEN}`, "/x?[redacted]"],
    [`/cloud/login/?next=%25252Fcloud%25252Freset%25252F%25253Ftoken%25253D${RESET}`, "/cloud/login/?next=%25252Fcloud%25252Freset%25252F%25253Ftoken%25253D[token]"],
    [`/cloud/login/?next=%2Fcloud%2Fjoin%2F%253Fcode%253DK7QM2XPA`, "/cloud/login/?[redacted]"],
    [`/cloud/login/?next=%2Fcloud%2Fjoin%2F%3Fco%2564e%3DK7QM2XPA`, "/cloud/login/?[redacted]"],
    ["/api/v1/coach%2Dinvites/K7QM2XPA/preview", "/api/v1/coach[redacted]"],
    ["/api/v1/coach%2Dinvites/K7QM2XPA/preview?x=1", "/api/v1/coach[redacted]"],
    [`/api/auth/reset%2Dpassword/${RESET}?callbackURL=%2F`, "/api/auth/reset[redacted]"],
    // A URL that doesn't decode is never logged raw.
    [`/x?token=${RESET}&y=%E0%A4`, "/x?[redacted]"],
    [`/x?q=100%&next=%253Ftoken%253D${RESET}`, "/x?[redacted]"],
    [`/api/v1/coach%2Dinvites/K7QM2XPA%ZZ`, "/api/v1/coach[redacted]"],
    [`/%ZZ/coach%2Dinvites/K7QM2XPA`, "/[redacted]"],
  ])("redacts %s conservatively when encoding hides a secret", (path, redacted) => {
    expect(redactLogLine(`<-- GET ${path}`)).toBe(`<-- GET ${redacted}`);
    expect(redactLogLine(`--> GET ${path} 404 1ms`)).toBe(`--> GET ${redacted} 404 1ms`);
  });

  it("redacts a line of another shape as a whole", () => {
    expect(redactLogLine(`note /x?token=${TOKEN}`)).toBe("note /x?token=[token]");
    expect(redactLogLine("note /x?%74oken=abc")).toBe("[redacted]");
  });
});

describe("the request log, for auth links", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes verification, reset and encoded links without the token or code", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void lines.push(args.join(" ")));
    // No auth: these 404, but the logger runs first and prints the URL as Better Auth would receive it.
    const app = createApp({ db: {} as Db, mode: "production", appUrl: "http://localhost:3000", log: true });
    const callback = encodeURIComponent("http://localhost:3000/cloud/");
    const paths = [
      `/api/auth/verify-email?token=${TOKEN}&callbackURL=${callback}`,
      `/api/auth/reset-password/${RESET}?callbackURL=${encodeURIComponent("http://localhost:3000/cloud/reset/")}`,
      `/cloud/reset/?token=${RESET}`,
      `/cloud/reset/?TOKEN=${RESET}`,
      `/cloud/login/?next=${encodeURIComponent(`/cloud/reset/?token=${RESET}`)}`,
      `/cloud/login/?next=${encodeURIComponent(encodeURIComponent(`/cloud/join/?code=${CODE}`))}`,
      `/api/v1/coach%2Dinvites/${CODE}/preview`,
      `/x?%74oken=${TOKEN}`,
      `/x?token=${RESET}&y=%E0%A4`,
    ];
    for (const path of paths) await app.request(`http://localhost:8787${path}`);
    expect(lines).toHaveLength(paths.length * 2);
    const all = lines.join("\n");
    for (const secret of [TOKEN, RESET, CODE]) expect(all).not.toContain(secret);
    expect(lines[0]).toBe(`<-- GET /api/auth/verify-email?token=[token]&callbackURL=${callback}`);
    expect(lines[1]).toMatch(new RegExp(`^--> GET /api/auth/verify-email\\?token=\\[token\\]&callbackURL=${callback} \\S*404\\S* \\d+ms$`));
    expect(lines[2]).toBe(`<-- GET /api/auth/reset-password/[token]?callbackURL=${encodeURIComponent("http://localhost:3000/cloud/reset/")}`);
  });
});

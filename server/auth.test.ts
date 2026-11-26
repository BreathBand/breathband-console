import { describe, expect, it } from "vitest";
import { authBaseUrl, authSecret, callbackOnApp, DEV_ONLY_AUTH_SECRET } from "./auth";
import { readEnv } from "./env";

const REAL_LOOKING = "q3Vx9mJr2Lp8Tz4Kc6Ny1Hb5Wd7Fs0Ga";

describe("authSecret", () => {
  it("requires AUTH_SECRET in production", () => {
    expect(() => authSecret("production", undefined)).toThrow("AUTH_SECRET is required in production");
  });

  it("refuses a short secret in production", () => {
    expect(() => authSecret("production", "too-short")).toThrow("at least 32 characters");
  });

  it("refuses the dev-only value in production", () => {
    expect(() => authSecret("production", DEV_ONLY_AUTH_SECRET)).toThrow("dev-only");
  });

  it("uses the given secret in production", () => {
    expect(authSecret("production", REAL_LOOKING)).toBe(REAL_LOOKING);
  });

  it.each(["development", "test"] as const)("falls back to the dev-only value in %s", (mode) => {
    expect(authSecret(mode, undefined)).toBe(DEV_ONLY_AUTH_SECRET);
    expect(DEV_ONLY_AUTH_SECRET).toMatch(/dev-only/);
    expect(authSecret(mode, REAL_LOOKING)).toBe(REAL_LOOKING);
  });
});

describe("authBaseUrl", () => {
  const base = { appUrl: "https://breathband.example/", port: 8787, apiUrl: undefined };

  it("is the web app's origin in production: one service serves both", () => {
    expect(authBaseUrl({ ...base, mode: "production" })).toBe("https://breathband.example");
  });

  it("is the API's own port in development", () => {
    expect(authBaseUrl({ ...base, mode: "development", port: 8790 })).toBe("http://localhost:8790");
  });

  it("is API_URL when set", () => {
    expect(authBaseUrl({ ...base, mode: "production", apiUrl: "https://api.breathband.example/x" })).toBe(
      "https://api.breathband.example",
    );
  });
});

describe("readEnv: auth and SMTP variables", () => {
  it("reads AUTH_SECRET, API_URL and the SMTP login", () => {
    const env = readEnv({
      AUTH_SECRET: REAL_LOOKING,
      API_URL: "http://localhost:8790",
      SMTP_HOST: "smtp.example",
      SMTP_PORT: "465",
      SMTP_USER: "apikey",
      SMTP_PASS: "smtp-password",
    });
    expect(env).toMatchObject({
      authSecret: REAL_LOOKING,
      apiUrl: "http://localhost:8790",
      smtp: { host: "smtp.example", port: 465, user: "apikey", pass: "smtp-password" },
    });
  });

  it("treats empty values as unset", () => {
    const env = readEnv({ AUTH_SECRET: "", API_URL: "", SMTP_USER: "", SMTP_PASS: "" });
    expect(env.authSecret).toBeUndefined();
    expect(env.apiUrl).toBeUndefined();
    expect(env.smtp.user).toBeUndefined();
    expect(env.smtp.pass).toBeUndefined();
  });

  it("refuses an API_URL that isn't a URL", () => {
    expect(() => readEnv({ API_URL: "api" })).toThrow("API_URL");
  });
});

describe("callbackOnApp", () => {
  const APP = "http://localhost:3000";
  const link = (callback: string) =>
    `http://localhost:8787/api/auth/verify-email?token=t&callbackURL=${encodeURIComponent(callback)}`;
  const callbackOf = (href: string) => new URL(href).searchParams.get("callbackURL");

  it("points a relative callback at the web app", () => {
    expect(callbackOf(callbackOnApp(link("/"), APP))).toBe("http://localhost:3000/");
    expect(callbackOf(callbackOnApp(link("/cloud/?a=1"), APP))).toBe("http://localhost:3000/cloud/?a=1");
  });

  it("keeps an absolute callback and the token", () => {
    const result = new URL(callbackOnApp(link("http://localhost:3000/cloud/"), APP));
    expect(result.searchParams.get("callbackURL")).toBe("http://localhost:3000/cloud/");
    expect(result.searchParams.get("token")).toBe("t");
  });

  it.each(["//evil.example/", "/\\evil.example/"])("leaves %s alone instead of making it absolute", (callback) => {
    expect(callbackOf(callbackOnApp(link(callback), APP))).toBe(callback);
  });
});

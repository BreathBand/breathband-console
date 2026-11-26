// Tests run on file databases only. Turso (libsql://, or its https:// and
// wss:// forms) holds real data, so any test pointed at a remote database
// stops before it connects.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalDatabaseUrl(url: string): boolean {
  if (url === ":memory:" || url.startsWith("file:")) return true;
  if (url.startsWith("libsql:")) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return ["http:", "ws:"].includes(protocol) && LOCAL_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export function assertLocalDatabaseUrl(url: string | undefined, source = "TURSO_DATABASE_URL"): void {
  if (url === undefined || url === "") return;
  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      `Refusing to run tests against a remote database (${source} is not a file: URL). ` +
        "Tests use file databases only; unset it or point it at file:./data/<name>.db.",
    );
  }
}

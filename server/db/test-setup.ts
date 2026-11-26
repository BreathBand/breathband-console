import { assertLocalDatabaseUrl } from "./guard";

assertLocalDatabaseUrl(process.env.TURSO_DATABASE_URL);

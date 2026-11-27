import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";

/** A band someone has paired. */
export const devices = sqliteTable(
  "devices",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bleId: text("ble_id").notNull(),
    name: text("name"),
    firmware: text("firmware"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    batteryPct: integer("battery_pct"),
    ...timestamps,
  },
  (t) => [uniqueIndex("devices_user_ble_idx").on(t.userId, t.bleId)],
);

/** One calibration, per person and per band (`Waveform.calibration`, kept on its own). */
export const calibrations = sqliteTable(
  "calibrations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null for the simulated band. */
    deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
    a100: real("a100").notNull(),
    midline: real("midline").notNull(),
    min: real("min").notNull(),
    max: real("max").notNull(),
    /** "bluetooth" or "simulated": which kind of band took it. */
    source: text("source", { enum: ["bluetooth", "simulated"] }).notNull().default("bluetooth"),
    /** The band's name as it advertised, until bands are registered in `devices`. */
    bandName: text("band_name"),
    /** The person's normal breathing reference; its shape waits on decision D-J. */
    normalReference: text("normal_reference", { mode: "json" }).$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("calibrations_user_created_idx").on(t.userId, t.createdAt)],
);

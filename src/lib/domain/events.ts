// Product events (D15, R1): what people do, for the launch measures, never what
// they breathe. Names come from this list; properties are a few flat words,
// numbers or yes/no, so no sample, signal or free text can ride along.

export const PRODUCT_EVENTS = [
  "onboarding_step_viewed",
  "onboarding_step_completed",
  "browser_unsupported",
  "band_connect_result",
  "calibration_result",
  "first_session_started",
  "session_saved",
  "invite_sent",
  "invite_accepted",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

export type EventProps = Record<string, string | number | boolean>;

export interface ProductEvent {
  name: ProductEventName;
  props?: EventProps;
  /** ISO 8601, when it happened in the browser. */
  at: string;
}

const MAX_PROPS = 8;
const MAX_KEY = 32;
const MAX_TEXT = 64;
export const MAX_EVENTS_PER_CALL = 50;

/** Why these events can't be kept, or null. Both adapters and the API refuse the same. */
export function eventsProblem(events: readonly ProductEvent[]): string | null {
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS_PER_CALL) return `events: 1 to ${MAX_EVENTS_PER_CALL}`;
  for (const e of events) {
    if (!e || !PRODUCT_EVENTS.includes(e.name)) return `name: one of ${PRODUCT_EVENTS.join(", ")}`;
    if (typeof e.at !== "string" || Number.isNaN(Date.parse(e.at))) return "at: an ISO date";
    const props = e.props ?? {};
    if (typeof props !== "object" || Array.isArray(props)) return "props: an object";
    const entries = Object.entries(props);
    if (entries.length > MAX_PROPS) return `props: at most ${MAX_PROPS}`;
    for (const [key, value] of entries) {
      if (key.length > MAX_KEY) return `props: keys up to ${MAX_KEY} characters`;
      const ok =
        typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length <= MAX_TEXT);
      if (!ok) return `props.${key}: a word (up to ${MAX_TEXT} characters), a number or true/false`;
    }
  }
  return null;
}

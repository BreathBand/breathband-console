// Which "Needs a look" flags a professional starts with, by kind
// (planning/v1/02 §4.1 step 7, §5.2 "Default flags"): a coach gets the full
// set, a clinician only missed days (no score-drop flag at the start), an
// educator none. Saved rules always win.

import { DEFAULT_ALERTS, type AlertRules, type ProKind } from "./types";

const OFF: AlertRules = {
  missedDays: null,
  scoreDrop: null,
  belowTarget: null,
  trendingDown: false,
  rateOutOfRange: false,
  practiceBehind: false,
};

const BY_KIND: Record<ProKind, AlertRules> = {
  coach: DEFAULT_ALERTS,
  clinician: { ...OFF, missedDays: DEFAULT_ALERTS.missedDays },
  educator: OFF,
};

/** The kind's starting rules; a professional of unknown kind (older coach accounts) gets the coach's. */
export function defaultFlags(kind: ProKind | null | undefined): AlertRules {
  return { ...(kind ? BY_KIND[kind] : DEFAULT_ALERTS) };
}

const KEYS = Object.keys(DEFAULT_ALERTS) as (keyof AlertRules)[];

/**
 * The rules in force. `getAlertRules` answers `DEFAULT_ALERTS` when nothing
 * was saved, so rules equal to it are read as "never changed" and the kind's
 * defaults apply instead.
 */
export function rulesInForce(saved: AlertRules, kind: ProKind | null | undefined): AlertRules {
  return KEYS.every((k) => saved[k] === DEFAULT_ALERTS[k]) ? defaultFlags(kind) : saved;
}

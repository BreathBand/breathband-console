import { Icon } from "@/components/Icon";

/** A whole-session rate no one breathes at (D-K): the band more likely slipped than the breathing changed. */
export function ImplausibleRate() {
  return (
    <p className="implausible-rate" role="note">
      <Icon name="alert" size={16} />
      That rate is unlikely for a whole session. The band may have slipped: check the strap is snug before the next one.
    </p>
  );
}

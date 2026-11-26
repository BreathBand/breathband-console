"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useDevice } from "@/lib/device/DeviceProvider";
import { supportAdvice, type BandSupport } from "@/lib/device/support";
import { FIRST_SESSION_SEC } from "@/lib/domain/first-session";
import type { PeopleNouns } from "@/lib/domain/terminology";
import type { CoachInvite, ProKind } from "@/lib/domain/types";
import { CreatedLink, InviteForm } from "../InviteAthlete";
import { deviceKindFor, routeAvailable } from "./band-route";

// The professional track's last two steps before Done (planning/v1/02 §4.1
// steps 9–10, 03 E8 and E9): try a session yourself, then invite your first
// person. Both come after the profile is saved, so the recorder can be opened
// from here and the invite is created as the professional they now are.

const TRY_LINE: Record<ProKind, (nouns: PeopleNouns) => string> = {
  coach: () => "You'll coach it better once you've felt it.",
  clinician: (nouns) => `Do what you'll ask your ${nouns.many} to do.`,
  educator: (nouns) => `Do what you'll ask your ${nouns.many} to do.`,
};

/** Step 9: record one short session on their own band or the simulated one, or skip. Uses the recorder as it is. */
export function TryStep({
  kind,
  nouns,
  support,
  onRecord,
  onSkip,
  onBack,
}: {
  kind: ProKind;
  nouns: PeopleNouns;
  support: BandSupport;
  /** Opens the recorder; the band is chosen first. */
  onRecord: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const device = useDevice();
  const bluetooth = routeAvailable("bluetooth", support);
  const advice = supportAdvice(support);

  const record = (route: "bluetooth" | "simulated") => {
    const next = deviceKindFor(route);
    if (next && next !== device.kind) {
      if (device.connected || ["requesting", "connecting", "reconnecting"].includes(device.status.state)) void device.disconnect();
      device.setKind(next);
    }
    onRecord();
  };

  return (
    <section>
      <h1>Try it yourself</h1>
      <p className="welcome-lede">{TRY_LINE[kind](nouns)} Recommended, and about four minutes.</p>
      <ol className="welcome-terms" aria-label="What happens">
        <li>Fit the strap and calibrate for 20 seconds, as your {nouns.many} will each time they put the band on.</li>
        <li>Breathe with a slow 5-5 pacer for {Math.round(FIRST_SESSION_SEC / 60)} minutes.</li>
        <li>See your score and your curve, as you&rsquo;ll see theirs. It&rsquo;s saved as your own session, never shown to them.</li>
      </ol>
      {advice && !bluetooth && (
        <p className="welcome-hint">
          <Icon name="info" size={16} />
          {advice.title} The simulated band works anywhere.
        </p>
      )}
      <div className="welcome-actions">
        {bluetooth && (
          <button type="button" className="button" data-size="large" onClick={() => record("bluetooth")}>
            <span className="rec-dot" aria-hidden="true" />
            Record with my band
          </button>
        )}
        <button type="button" className="button" data-size={bluetooth ? undefined : "large"} data-variant={bluetooth ? "ghost" : undefined} onClick={() => record("simulated")}>
          <Icon name="signal" size={18} />
          Record with the simulated band
        </button>
        <button type="button" className="button" data-variant="ghost" onClick={onSkip}>
          Skip for now
        </button>
        <button type="button" className="link" onClick={onBack}>
          Back
        </button>
      </div>
      <p className="welcome-hint">
        <Icon name="info" size={16} />
        After the session, your dashboard has the next steps, starting with your first invite.
      </p>
    </section>
  );
}

/** Step 10: create an invite with the existing invite capability; its link, QR code and copy button come from the roster's invite. */
export function InviteStep({
  coachId,
  nouns,
  onNext,
  onBack,
  invite,
  onInvite,
}: {
  coachId: string;
  nouns: PeopleNouns;
  onNext: () => void;
  onBack: () => void;
  invite: CoachInvite | null;
  onInvite: (invite: CoachInvite | null) => void;
}) {
  const [another, setAnother] = useState(false);
  const showForm = !invite || another;
  return (
    <section className="welcome-invite">
      <h1>Invite your first {nouns.one}</h1>
      <p className="welcome-lede">
        Send them a link, or let them scan the code. Nothing is shared until the {nouns.one} opens it, sees exactly what you&rsquo;ll see,
        chooses what to share and accepts.
      </p>
      {showForm ? (
        <InviteForm
          coachId={coachId}
          onCreated={(created) => {
            setAnother(false);
            onInvite(created);
          }}
        />
      ) : (
        <CreatedLink invite={invite} onAnother={() => setAnother(true)} />
      )}
      <div className="welcome-actions">
        {invite ? (
          <button type="button" className="button" data-size="large" onClick={onNext}>
            Continue
            <Icon name="arrowRight" size={18} />
          </button>
        ) : (
          <button type="button" className="button" data-variant="ghost" onClick={onNext}>
            Skip for now
          </button>
        )}
        <button type="button" className="link" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

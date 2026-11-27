import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { LEGAL_DRAFT_NOTE } from "./doc-links";

export interface DocSection {
  /** The section's anchor, so help can link straight to it (`/cloud/help/#pairing`). */
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * One help or legal page: title, lede, the draft note on legal text, a list
 * of its sections, then the sections. No hooks, so it renders in the static
 * export (and in unit tests) as plain HTML.
 */
export function DocArticle({
  eyebrow,
  title,
  lede,
  updated,
  legal,
  sections,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  /** The draft's date, as words ("27 November 2026"). */
  updated: string;
  legal: boolean;
  sections: readonly DocSection[];
}) {
  return (
    <div className="bc-wrap bc-doc">
      <header className="bc-doc-head">
        <p className="bc-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="bc-doc-lede">{lede}</p>
        <p className="bc-doc-updated">Last updated {updated}</p>
        {legal && (
          <p className="bc-doc-draft" role="note">
            <Icon name="alert" size={18} />
            <span>
              <strong>{LEGAL_DRAFT_NOTE}.</strong> This is a working draft written before launch. Counsel hasn&apos;t
              reviewed it yet, so the final wording may change, and if it does you&apos;ll be asked to agree again.
            </span>
          </p>
        )}
      </header>

      <div className="bc-doc-grid">
        <nav className="bc-doc-toc" aria-labelledby="doc-toc-h">
          <h2 id="doc-toc-h" className="bc-doc-toc-h">
            On this page
          </h2>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="bc-doc-body">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="bc-doc-section" aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`}>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A plain-language aside inside a section ("In short: …", "Not yet built: …"). */
export function DocNote({ children }: { children: ReactNode }) {
  return (
    <p className="bc-note bc-doc-note">
      <Icon name="info" size={18} />
      <span>{children}</span>
    </p>
  );
}

/** Something not decided yet, marked so it can be found and filled in before launch. */
export function Tbc({ children }: { children: ReactNode }) {
  return <mark className="bc-doc-tbc">{children}</mark>;
}

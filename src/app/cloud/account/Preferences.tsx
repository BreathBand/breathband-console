"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";

const THEMES: { id: ThemeChoice; label: string; icon: "monitor" | "sun" | "moon" }[] = [
  { id: "system", label: "System", icon: "monitor" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];

/** Colour theme for this browser. The recording screen is always dark. */
export function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  return (
    <section className="pane pane-pad" aria-labelledby="appearance-h">
      <div className="pane-h">
        <h2 id="appearance-h">Appearance</h2>
        <span className="meta">This browser only</span>
      </div>
      <div className="seg seg-wide" role="group" aria-label="Colour theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={theme === t.id}
            onClick={() => {
              applyTheme(t.id);
              setTheme(t.id);
            }}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

import type { ConnectionState, SimPersona } from "@/lib/device/types";

export function stateWords(state: ConnectionState): string {
  switch (state) {
    case "idle":
      return "Not connected";
    case "requesting":
      return "Choose your band…";
    case "connecting":
      return "Connecting…";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting…";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Couldn't connect";
  }
}

export const PERSONAS: { id: SimPersona; label: string; detail: string }[] = [
  { id: "steady", label: "Steady", detail: "Follows the pacer closely" },
  { id: "early", label: "Early", detail: "Turns each breath a little before the pacer" },
  { id: "shallow", label: "Shallow", detail: "Breathes about half as deep as the pacer" },
  { id: "deep", label: "Too deep", detail: "Breathes nearly twice as deep" },
  { id: "rushed", label: "Rushed", detail: "Breathes 25% faster than the pacer" },
  { id: "distracted", label: "Distracted", detail: "Loses the rhythm for 18 s, then recovers" },
];

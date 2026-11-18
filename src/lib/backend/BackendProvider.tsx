"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/domain/types";
import { createBackend, type AuthUser, type Backend } from "./index";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: AuthUser; profile: UserProfile | null };

interface BackendContextValue {
  backend: Backend;
  auth: AuthState;
}

const BackendContext = createContext<BackendContextValue | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [backend] = useState(() => createBackend());
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = backend.auth.onAuthStateChanged((user) => {
      if (!user) {
        setAuth({ status: "signed-out" });
        return;
      }
      backend.data
        .getProfile(user.uid)
        .catch(() => null)
        .then((profile) => {
          if (!cancelled) setAuth({ status: "signed-in", user, profile });
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [backend]);

  return <BackendContext.Provider value={{ backend, auth }}>{children}</BackendContext.Provider>;
}

function useBackendContext(): BackendContextValue {
  const value = useContext(BackendContext);
  if (!value) throw new Error("useBackend must be used inside <BackendProvider>");
  return value;
}

export const useBackend = () => useBackendContext().backend;
export const useAuth = () => useBackendContext().auth;

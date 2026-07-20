"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, setAccessToken } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the access token in MEMORY (Ch 10 §10.1) — never localStorage, which XSS
 * can read. On mount we call /auth/refresh: the browser sends the httpOnly refresh
 * cookie automatically, and we get a fresh access token back. That's how a page
 * reload stays logged in without ever persisting a token in JS-readable storage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiFetch<AuthResponse>("/auth/refresh", { method: "POST" })
      .then((session) => {
        if (!cancelled) applySession(session);
      })
      .catch(() => {
        // No valid refresh cookie — simply not logged in. Not an error state.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(
        await apiFetch<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      );
    },
    [applySession],
  );

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      applySession(
        await apiFetch<AuthResponse>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, name }),
        }),
      );
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout }),
    [user, isLoading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

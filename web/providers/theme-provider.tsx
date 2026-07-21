"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "wealth-os-theme";

/**
 * localStorage is external state, so it is read with useSyncExternalStore rather
 * than copied into useState inside an effect.
 *
 * The effect version rendered once with the wrong value and then re-rendered to
 * correct itself — a cascading render React explicitly warns about. This reads
 * the real value during render, and `getServerSnapshot` keeps SSR consistent:
 * the server has no localStorage, so it reports "system" and hydration matches.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Also react to another TAB changing the theme — same user, same preference.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
}

/** No localStorage on the server; "system" is what the CSS already defaults to. */
function getServerSnapshot(): Theme {
  return "system";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme control (Ch 11 §11.2). The tokens already define both palettes; this
 * only decides which one wins.
 *
 * "system" is the default and removes the attribute entirely, letting the
 * `prefers-color-scheme` media query in globals.css apply. An explicit choice
 * stamps `data-theme` on <html>, which our CSS is written to beat the media
 * query with — in both directions.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-theme", next);
    }
    // localStorage writes don't fire `storage` in the tab that made them, so
    // subscribers are notified explicitly.
    listeners.forEach((listener) => listener());
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

/**
 * Runs before first paint to apply the saved theme.
 *
 * Without this the page renders in the default palette and then snaps to the
 * chosen one — the "flash of wrong theme" — because React hydration happens
 * after the browser has already painted.
 */
export const themeInitScript = `
try {
  var t = localStorage.getItem('${STORAGE_KEY}');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "wealth-os-theme";

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
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored) setThemeState(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);

    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-theme", next);
    }
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

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getItem, setItem } from "../utils/storage";

const ThemeContext = createContext();

const FONT_FAMILIES = {
  gothic: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif',
  myeongjo: '"Noto Serif KR", "Batang", serif',
  pretendard: '"Pretendard", -apple-system, BlinkMacSystemFont, sans-serif',
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => getItem("theme", "minimal"));
  const [darkMode, setDarkModeState] = useState(() => getItem("darkMode", "auto"));
  const [font, setFontState] = useState(() => getItem("font", "gothic"));
  const [fontSize, setFontSizeState] = useState(() => {
    const saved = getItem("fontSize", "16");
    const num = Number(saved);
    // 기존 문자열 키("small" 등) → 숫자로 마이그레이션
    if (isNaN(num)) return 16;
    return Math.min(32, Math.max(12, num));
  });

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark =
    darkMode === "on" ? true : darkMode === "off" ? false : systemDark;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-dark", String(isDark));
  }, [theme, isDark]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-family", FONT_FAMILIES[font]);
    document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
  }, [font, fontSize]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    setItem("theme", t);
  }, []);

  const setDarkMode = useCallback((mode) => {
    setDarkModeState(mode);
    setItem("darkMode", mode);
  }, []);

  const setFont = useCallback((f) => {
    setFontState(f);
    setItem("font", f);
  }, []);

  const setFontSize = useCallback((s) => {
    const clamped = Math.min(32, Math.max(12, Number(s)));
    setFontSizeState(clamped);
    setItem("fontSize", String(clamped));
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, darkMode, setDarkMode, isDark, font, setFont, fontSize, setFontSize }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

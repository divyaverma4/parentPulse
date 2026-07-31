import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark';

type AppThemeContextValue = {
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme();
  // Keep the first render deterministic for web prerender + hydration.
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    setThemeMode(system === 'dark' ? 'dark' : 'light');
  }, [system]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      themeMode,
      isDark: themeMode === 'dark',
      toggleTheme: () => {
        setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
      },
    }),
    [themeMode]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}

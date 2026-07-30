import React, { createContext, useContext, useMemo, useState } from 'react';
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
  const initialMode: ThemeMode = system === 'dark' ? 'dark' : 'light';
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialMode);

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

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AppThemeProvider, useAppTheme } from '@/contexts/app-theme-context';

export const unstable_settings = {
  anchor: 'chat',
};

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}

function RootNavigator() {
  const { themeMode } = useAppTheme();

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      <StatusBar
        style={themeMode === 'dark' ? 'light' : 'dark'}
        backgroundColor={themeMode === 'dark' ? '#020617' : '#f4f6ff'}
      />
    </>
  );
}

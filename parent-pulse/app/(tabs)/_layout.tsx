import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';

export default function TabLayout() {
  const { themeMode } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[themeMode].tint,
        tabBarHideOnKeyboard: false,
        tabBarStyle: {
          backgroundColor: themeMode === 'dark' ? '#0f172a' : '#ffffff',
          borderTopColor: themeMode === 'dark' ? '#1e293b' : '#e5e7eb',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="test-prep"
        options={{
          title: 'Test Prep',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

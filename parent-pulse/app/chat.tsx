import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ChatRouteRedirect() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  return <Redirect href={{ pathname: '/(tabs)/explore', params }} />;
}

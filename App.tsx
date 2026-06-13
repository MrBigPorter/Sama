import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { Navigation } from '@/Navigation';
import { initSentry } from '@/lib/sentry';

// Hermes polyfills — must be imported before any other code at module scope
import '@/lib/globals';

function AppContent() {
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <Navigation />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <AppContent />
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

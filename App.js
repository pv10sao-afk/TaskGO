import './global.css'; // Import NativeWind global css
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { SettingsProvider } from './src/context/SettingsContext';
import { ProgressProvider } from './src/context/ProgressContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ProgressProvider>
          <AppNavigator />
        </ProgressProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

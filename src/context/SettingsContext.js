import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedValue = await AsyncStorage.getItem('@autoPlayAudio');
        if (storedValue !== null) {
          setAutoPlayAudio(JSON.parse(storedValue));
        }
      } catch (e) {
        console.error('Failed to load autoPlayAudio setting', e);
      }
    };
    loadSettings();
  }, []);

  const toggleAutoPlay = async () => {
    try {
      const newValue = !autoPlayAudio;
      setAutoPlayAudio(newValue);
      await AsyncStorage.setItem('@autoPlayAudio', JSON.stringify(newValue));
    } catch (e) {
      console.error('Failed to save autoPlayAudio setting', e);
    }
  };

  return (
    <SettingsContext.Provider value={{ autoPlayAudio, toggleAutoPlay }}>
      {children}
    </SettingsContext.Provider>
  );
};

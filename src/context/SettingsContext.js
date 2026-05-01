import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [userLevel, setUserLevel] = useState('A1');
  const [dailyNewLimit, setDailyNewLimit] = useState(5);
  const [dailyReviewLimit, setDailyReviewLimit] = useState(20);
  const [groqApiKey, setGroqApiKey] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedAudio = await AsyncStorage.getItem('@autoPlayAudio');
        if (storedAudio !== null) setAutoPlayAudio(JSON.parse(storedAudio));

        const storedLevel = await AsyncStorage.getItem('@userLevel');
        if (storedLevel !== null) setUserLevel(storedLevel);

        const storedNewLimit = await AsyncStorage.getItem('@dailyNewLimit');
        if (storedNewLimit !== null) setDailyNewLimit(Number(storedNewLimit));

        const storedReviewLimit = await AsyncStorage.getItem('@dailyReviewLimit');
        if (storedReviewLimit !== null) setDailyReviewLimit(Number(storedReviewLimit));

        const storedApiKey = await AsyncStorage.getItem('@groqApiKey');
        if (storedApiKey !== null) setGroqApiKey(storedApiKey);
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const saveSetting = async (key, value, setter) => {
    try {
      await AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      setter(value);
    } catch (e) {
      console.error(`Failed to save ${key}`, e);
    }
  };

  return (
    <SettingsContext.Provider value={{
      autoPlayAudio,
      toggleAutoPlay: (val) => {
        const nextValue = typeof val === 'boolean' ? val : !autoPlayAudio;
        return saveSetting('@autoPlayAudio', nextValue, setAutoPlayAudio);
      },
      userLevel,
      setUserLevel: (val) => saveSetting('@userLevel', val, setUserLevel),
      dailyNewLimit,
      setDailyNewLimit: (val) => saveSetting('@dailyNewLimit', val, setDailyNewLimit),
      dailyReviewLimit,
      setDailyReviewLimit: (val) => saveSetting('@dailyReviewLimit', val, setDailyReviewLimit),
      groqApiKey,
      setGroqApiKey: (val) => saveSetting('@groqApiKey', val, setGroqApiKey)
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

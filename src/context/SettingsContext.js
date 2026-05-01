import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [userLevel, setUserLevel] = useState('A1');
  const [dailyNewLimit, setDailyNewLimit] = useState(5);
  const [dailyReviewLimit, setDailyReviewLimit] = useState(15);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedAutoPlay = await AsyncStorage.getItem('@autoPlayAudio');
        if (storedAutoPlay !== null) setAutoPlayAudio(JSON.parse(storedAutoPlay));

        const storedLevel = await AsyncStorage.getItem('@userLevel');
        if (storedLevel !== null) setUserLevel(storedLevel);

        const storedNew = await AsyncStorage.getItem('@dailyNewLimit');
        if (storedNew !== null) setDailyNewLimit(JSON.parse(storedNew));

        const storedReview = await AsyncStorage.getItem('@dailyReviewLimit');
        if (storedReview !== null) setDailyReviewLimit(JSON.parse(storedReview));
      } catch (e) {
        console.error('Failed to load settings', e);
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

  const updateLevel = async (level) => {
    setUserLevel(level);
    await AsyncStorage.setItem('@userLevel', level);
  };

  const updateNewLimit = async (limit) => {
    setDailyNewLimit(limit);
    await AsyncStorage.setItem('@dailyNewLimit', JSON.stringify(limit));
  };

  const updateReviewLimit = async (limit) => {
    setDailyReviewLimit(limit);
    await AsyncStorage.setItem('@dailyReviewLimit', JSON.stringify(limit));
  };

  return (
    <SettingsContext.Provider value={{ 
      autoPlayAudio, toggleAutoPlay,
      userLevel, updateLevel,
      dailyNewLimit, updateNewLimit,
      dailyReviewLimit, updateReviewLimit
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

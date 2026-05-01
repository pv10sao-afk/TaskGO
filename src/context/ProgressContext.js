import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ProgressContext = createContext();

export const ProgressProvider = ({ children }) => {
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const storedXp = await AsyncStorage.getItem('@xp');
        if (storedXp !== null) setXp(Number(storedXp));

        const storedStreak = await AsyncStorage.getItem('@streak');
        if (storedStreak !== null) setStreak(Number(storedStreak));

        const lastLogin = await AsyncStorage.getItem('@lastLoginDate');
        const today = new Date().toISOString().split('T')[0];

        if (lastLogin !== today) {
          if (lastLogin) {
            const lastDate = new Date(lastLogin);
            const currentDate = new Date(today);
            const diffTime = Math.abs(currentDate - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays === 1) {
              // Logged in yesterday, increment streak
              const newStreak = Number(storedStreak || 0) + 1;
              setStreak(newStreak);
              await AsyncStorage.setItem('@streak', newStreak.toString());
            } else if (diffDays > 1) {
              // Streak broken
              setStreak(1);
              await AsyncStorage.setItem('@streak', '1');
            }
          } else {
            // First time ever
            setStreak(1);
            await AsyncStorage.setItem('@streak', '1');
          }
          await AsyncStorage.setItem('@lastLoginDate', today);
        }
      } catch (e) {
        console.error('Failed to load progress settings', e);
      }
    };
    loadProgress();
  }, []);

  const addXp = async (amount) => {
    try {
      const newXp = xp + amount;
      setXp(newXp);
      await AsyncStorage.setItem('@xp', newXp.toString());
    } catch (e) {
      console.error('Failed to save XP', e);
    }
  };

  return (
    <ProgressContext.Provider value={{ xp, streak, addXp }}>
      {children}
    </ProgressContext.Provider>
  );
};

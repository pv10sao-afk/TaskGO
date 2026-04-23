import { StatusBar, ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { USER_LEVEL } from './src/constants/config';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { defaultLearningProfile, saveLearningProfile } from './src/services/learningHub';
import { completeOnboarding, hasCompletedOnboarding } from './src/services/storage';
import type { LearningGoal, LearningProfile, PracticeFocus, UserLevel } from './src/types';

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<UserLevel | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal>(defaultLearningProfile.goal);
  const [selectedDailyMinutes, setSelectedDailyMinutes] = useState<LearningProfile['dailyMinutes']>(
    defaultLearningProfile.dailyMinutes
  );
  const [selectedFocus, setSelectedFocus] = useState<PracticeFocus>(
    defaultLearningProfile.preferredFocus
  );

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      try {
        const completed = await hasCompletedOnboarding();

        if (!isActive) {
          return;
        }

        setOnboardingDone(completed);
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
      }
    }

    const subscription = DeviceEventEmitter.addListener('onboarding-reset', () => {
      setOnboardingDone(false);
      setSelectedLevel(null);
      setSelectedGoal(defaultLearningProfile.goal);
      setSelectedDailyMinutes(defaultLearningProfile.dailyMinutes);
      setSelectedFocus(defaultLearningProfile.preferredFocus);
    });

    void bootstrap();

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  async function handleCompleteOnboarding() {
    if (!selectedLevel) return;
    await saveLearningProfile({
      ...defaultLearningProfile,
      level: selectedLevel,
      goal: selectedGoal,
      dailyMinutes: selectedDailyMinutes,
      preferredFocus: selectedFocus,
    });
    await completeOnboarding(selectedLevel);
    setOnboardingDone(true);
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />
      {isBootstrapping ? (
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#7C3AED" size="large" />
        </View>
      ) : onboardingDone ? (
        <AppNavigator />
      ) : (
        <OnboardingScreen
          onContinue={handleCompleteOnboarding}
          onSelectDailyMinutes={setSelectedDailyMinutes}
          onSelectFocus={setSelectedFocus}
          onSelectGoal={setSelectedGoal}
          onSelectLevel={setSelectedLevel}
          selectedDailyMinutes={selectedDailyMinutes}
          selectedFocus={selectedFocus}
          selectedGoal={selectedGoal}
          selectedLevel={selectedLevel}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#030712',
    flex: 1,
    justifyContent: 'center',
  },
});

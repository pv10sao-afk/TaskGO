import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from '../utils/haptics';

import type { LearningGoal, PracticeFocus, UserLevel } from '../types';

type OnboardingScreenProps = {
  selectedLevel: UserLevel | null;
  selectedGoal: LearningGoal;
  selectedDailyMinutes: 10 | 15 | 20 | 30;
  selectedFocus: PracticeFocus;
  onSelectLevel: (level: UserLevel) => void;
  onSelectGoal: (goal: LearningGoal) => void;
  onSelectDailyMinutes: (minutes: 10 | 15 | 20 | 30) => void;
  onSelectFocus: (focus: PracticeFocus) => void;
  onContinue: () => void;
};

const LEVELS: UserLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const GOALS: Array<{ key: LearningGoal; label: string }> = [
  { key: 'daily_communication', label: 'Спілкування' },
  { key: 'travel', label: 'Подорожі' },
  { key: 'work', label: 'Робота' },
  { key: 'interview', label: 'Співбесіда' },
  { key: 'movies', label: 'Фільми' },
];
const DAILY_MINUTES: Array<10 | 15 | 20 | 30> = [10, 15, 20, 30];
const FOCUS_OPTIONS: Array<{ key: PracticeFocus; label: string }> = [
  { key: 'mixed', label: 'Мікс' },
  { key: 'vocabulary', label: 'Слова' },
  { key: 'grammar', label: 'Граматика' },
  { key: 'speaking', label: 'Speaking' },
];

export function OnboardingScreen({
  selectedLevel,
  selectedGoal,
  selectedDailyMinutes,
  selectedFocus,
  onSelectLevel,
  onSelectGoal,
  onSelectDailyMinutes,
  onSelectFocus,
  onContinue,
}: OnboardingScreenProps) {
  async function handleSelectLevel(level: UserLevel) {
    await Haptics.selectionAsync();
    onSelectLevel(level);
  }

  async function handleContinue() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onContinue();
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Welcome to LangAI</Text>
        <Text style={styles.title}>Налаштуй LangAI під себе за 30 секунд</Text>
        <Text style={styles.subtitle}>
          Обери рівень, ціль, темп і головний акцент. Далі додаток підлаштує план і рекомендації.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Рівень</Text>
        <View style={styles.levelGrid}>
          {LEVELS.map((level) => {
            const isSelected = level === selectedLevel;

            return (
              <TouchableOpacity
                key={level}
                onPress={() => void handleSelectLevel(level)}
                style={[styles.levelCard, isSelected && styles.levelCardActive]}
              >
                <Text style={[styles.levelLabel, isSelected && styles.levelLabelActive]}>{level}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Ціль</Text>
        <View style={styles.goalGrid}>
          {GOALS.map((goal) => {
            const isSelected = goal.key === selectedGoal;

            return (
              <TouchableOpacity
                key={goal.key}
                onPress={() => onSelectGoal(goal.key)}
                style={[styles.goalChip, isSelected && styles.goalChipActive]}
              >
                <Text style={[styles.goalChipText, isSelected && styles.goalChipTextActive]}>
                  {goal.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Скільки хвилин на день</Text>
        <View style={styles.goalGrid}>
          {DAILY_MINUTES.map((minutes) => {
            const isSelected = minutes === selectedDailyMinutes;

            return (
              <TouchableOpacity
                key={minutes}
                onPress={() => onSelectDailyMinutes(minutes)}
                style={[styles.goalChip, isSelected && styles.goalChipActive]}
              >
                <Text style={[styles.goalChipText, isSelected && styles.goalChipTextActive]}>
                  {minutes} хв
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Головний акцент</Text>
        <View style={styles.goalGrid}>
          {FOCUS_OPTIONS.map((option) => {
            const isSelected = option.key === selectedFocus;

            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => onSelectFocus(option.key)}
                style={[styles.goalChip, isSelected && styles.goalChipActive]}
              >
                <Text style={[styles.goalChipText, isSelected && styles.goalChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity 
        disabled={!selectedLevel}
        onPress={() => void handleContinue()} 
        style={[styles.primaryButton, !selectedLevel && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>Почати</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#030712',
    flex: 1,
  },
  screen: {
    gap: 18,
    minHeight: '100%',
    justifyContent: 'center',
    padding: 24,
  },
  hero: {
    gap: 12,
  },
  block: {
    gap: 10,
  },
  blockTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F9FAFB',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 24,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  levelCard: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 22,
    borderWidth: 1,
    minWidth: '30%',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  levelCardActive: {
    backgroundColor: '#1E1B4B',
    borderColor: '#7C3AED',
  },
  levelLabel: {
    color: '#E5E7EB',
    fontSize: 22,
    fontWeight: '800',
  },
  levelLabelActive: {
    color: '#DDD6FE',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalChip: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  goalChipActive: {
    backgroundColor: '#1E1B4B',
    borderColor: '#7C3AED',
  },
  goalChipText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
  },
  goalChipTextActive: {
    color: '#F5F3FF',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingVertical: 18,
  },
  primaryButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

import { useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from '../utils/haptics';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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

const LEVELS: Array<{ key: UserLevel; label: string; desc: string }> = [
  { key: 'A1', label: 'A1', desc: 'Починаю з нуля' },
  { key: 'A2', label: 'A2', desc: 'Базові слова є' },
  { key: 'B1', label: 'B1', desc: 'Можу спілкуватись' },
  { key: 'B2', label: 'B2', desc: 'Впевнений рівень' },
  { key: 'C1', label: 'C1', desc: 'Майже бездоганно' },
];

const GOALS: Array<{ key: LearningGoal; label: string; icon: string }> = [
  { key: 'daily_communication', label: 'Спілкування', icon: 'message-text' },
  { key: 'travel', label: 'Подорожі', icon: 'airplane' },
  { key: 'work', label: 'Робота', icon: 'briefcase' },
  { key: 'interview', label: 'Співбесіда', icon: 'account-tie' },
  { key: 'movies', label: 'Фільми', icon: 'movie-open' },
];

const DAILY_MINUTES: Array<{ value: 10 | 15 | 20 | 30; label: string; desc: string }> = [
  { value: 10, label: '10 хв', desc: 'Легкий темп' },
  { value: 15, label: '15 хв', desc: 'Рекомендовано' },
  { value: 20, label: '20 хв', desc: 'Активне вивчення' },
  { value: 30, label: '30 хв', desc: 'Інтенсивний курс' },
];

const FOCUS_OPTIONS: Array<{ key: PracticeFocus; label: string; icon: string }> = [
  { key: 'mixed', label: 'Мікс усього', icon: 'shuffle-variant' },
  { key: 'vocabulary', label: 'Слова', icon: 'book-alphabet' },
  { key: 'grammar', label: 'Граматика', icon: 'format-list-checks' },
  { key: 'speaking', label: 'Speaking', icon: 'microphone' },
];

const TOTAL_STEPS = 4;

const STEP_META = [
  { title: 'Який твій рівень?', subtitle: 'Обери рівень чесно — це допоможе підібрати вправи під тебе' },
  { title: 'Для чого вчиш?', subtitle: 'Мета визначає словник і теми, які тобі найкорисніші' },
  { title: 'Скільки часу є?', subtitle: 'Навіть 10 хвилин щодня дають результат' },
  { title: 'На чому фокус?', subtitle: 'Можна змінити будь-коли після налаштування' },
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
  const [step, setStep] = useState(0); // 0..3
  const slideAnim = useRef(new Animated.Value(0)).current;

  function animateStep(direction: 'forward' | 'back', callback: () => void) {
    const toOut = direction === 'forward' ? -60 : 60;
    const fromIn = direction === 'forward' ? 60 : -60;

    Animated.timing(slideAnim, {
      toValue: toOut,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(fromIn);
      callback();
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }

  async function handleNext() {
    await Haptics.selectionAsync();
    if (step < TOTAL_STEPS - 1) {
      animateStep('forward', () => setStep((s) => s + 1));
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onContinue();
    }
  }

  async function handleBack() {
    await Haptics.selectionAsync();
    if (step > 0) {
      animateStep('back', () => setStep((s) => s - 1));
    }
  }

  async function handleSelectLevel(level: UserLevel) {
    await Haptics.selectionAsync();
    onSelectLevel(level);
  }

  const canGoNext =
    step === 0 ? selectedLevel !== null :
    true; // steps 1,2,3 always have a default

  const meta = STEP_META[step];

  return (
    <View style={styles.root}>
      {/* ── TOP: logo + step progress ── */}
      <View style={styles.topBar}>
        <Text style={styles.brandMark}>LangAI</Text>
        <View style={styles.progressDots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
                i < step && styles.dotDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepCounter}>{step + 1} / {TOTAL_STEPS}</Text>
      </View>

      {/* ── STEP CONTENT ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.stepWrap,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <Text style={styles.stepTitle}>{meta.title}</Text>
          <Text style={styles.stepSubtitle}>{meta.subtitle}</Text>

          {/* ─ STEP 0: LEVEL ─ */}
          {step === 0 && (
            <View style={styles.optionList}>
              {LEVELS.map((level) => {
                const isSelected = level.key === selectedLevel;
                return (
                  <TouchableOpacity
                    key={level.key}
                    onPress={() => void handleSelectLevel(level.key)}
                    style={[styles.optionRow, isSelected && styles.optionRowActive]}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionBadge, isSelected && styles.optionBadgeActive]}>
                      <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextActive]}>
                        {level.label}
                      </Text>
                    </View>
                    <View style={styles.optionTextBlock}>
                      <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>
                        {level.label}
                      </Text>
                      <Text style={styles.optionDesc}>{level.desc}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color="#818CF8" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ─ STEP 1: GOAL ─ */}
          {step === 1 && (
            <View style={styles.optionList}>
              {GOALS.map((goal) => {
                const isSelected = goal.key === selectedGoal;
                return (
                  <TouchableOpacity
                    key={goal.key}
                    onPress={() => onSelectGoal(goal.key)}
                    style={[styles.optionRow, isSelected && styles.optionRowActive]}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.iconCircle, isSelected && styles.iconCircleActive]}>
                      <MaterialCommunityIcons
                        name={goal.icon as any}
                        size={22}
                        color={isSelected ? '#818CF8' : '#64748B'}
                      />
                    </View>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>
                      {goal.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color="#818CF8" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ─ STEP 2: DAILY MINUTES ─ */}
          {step === 2 && (
            <View style={styles.optionList}>
              {DAILY_MINUTES.map((opt) => {
                const isSelected = opt.value === selectedDailyMinutes;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onSelectDailyMinutes(opt.value)}
                    style={[styles.optionRow, isSelected && styles.optionRowActive]}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionBadge, isSelected && styles.optionBadgeActive]}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={18}
                        color={isSelected ? '#818CF8' : '#64748B'}
                      />
                    </View>
                    <View style={styles.optionTextBlock}>
                      <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.optionDesc}>{opt.desc}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color="#818CF8" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ─ STEP 3: FOCUS ─ */}
          {step === 3 && (
            <View style={styles.optionList}>
              {FOCUS_OPTIONS.map((opt) => {
                const isSelected = opt.key === selectedFocus;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => onSelectFocus(opt.key)}
                    style={[styles.optionRow, isSelected && styles.optionRowActive]}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.iconCircle, isSelected && styles.iconCircleActive]}>
                      <MaterialCommunityIcons
                        name={opt.icon as any}
                        size={22}
                        color={isSelected ? '#818CF8' : '#64748B'}
                      />
                    </View>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color="#818CF8" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── BOTTOM BUTTONS ── */}
      <View style={styles.bottomBar}>
        {step > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => void handleBack()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#818CF8" />
            <Text style={styles.backBtnText}>Назад</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <TouchableOpacity
          style={[styles.nextBtn, !canGoNext && styles.nextBtnDisabled]}
          disabled={!canGoNext}
          onPress={() => void handleNext()}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {step === TOTAL_STEPS - 1 ? 'Розпочати навчання' : 'Далі'}
          </Text>
          <MaterialCommunityIcons
            name={step === TOTAL_STEPS - 1 ? 'rocket-launch' : 'arrow-right'}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Hint when level not selected */}
      {step === 0 && !selectedLevel && (
        <Text style={styles.hintText}>👆 Обери свій рівень, щоб продовжити</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#030712',
    flex: 1,
  },

  // TOP BAR
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 20,
  },
  brandMark: {
    color: '#818CF8',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1E293B',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#6366F1',
  },
  dotDone: {
    backgroundColor: '#4F46E5',
  },
  stepCounter: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },

  // SCROLL CONTENT
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  stepWrap: {
    gap: 20,
  },
  stepTitle: {
    color: '#F9FAFB',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 24,
    marginTop: -8,
  },

  // OPTION ROWS
  optionList: {
    gap: 10,
  },
  optionRow: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optionRowActive: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: '#6366F1',
  },
  optionBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeActive: {
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  optionBadgeText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '900',
  },
  optionBadgeTextActive: {
    color: '#818CF8',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  optionTitleActive: {
    color: '#F5F3FF',
  },
  optionDesc: {
    color: '#64748B',
    fontSize: 13,
  },

  // BOTTOM BAR
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    backgroundColor: '#030712',
    borderTopColor: '#1E293B',
    borderTopWidth: 1,
  },
  backBtnPlaceholder: {
    width: 96,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderColor: 'rgba(99,102,241,0.2)',
    borderWidth: 1,
    width: 96,
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#818CF8',
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#6366F1',
    borderRadius: 18,
    paddingVertical: 18,
  },
  nextBtnDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.6,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // HINT
  hintText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
});

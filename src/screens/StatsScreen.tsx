import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';
import * as Haptics from '../utils/haptics';
import { useIsFocused } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ProgressBar } from '../components/ProgressBar';
import { WeakTopicBadge } from '../components/WeakTopicBadge';
import { useProgress } from '../hooks/useProgress';
import type { AppTabParamList } from '../navigation/AppNavigator';
import { getAccessStatus } from '../services/access';
import {
  clearChatHistory,
  getBadges,
  getLearningProfile,
  resetLearningHubData,
  updateLearningProfile,
} from '../services/learningHub';
import {
  clearExerciseCache,
  clearStoredData,
  getExerciseCacheCount,
  resetLearningData,
} from '../services/storage';
import { useEffect, useMemo, useState } from 'react';
import { formatLocalDateKey, getLocalDateKeyFromStoredValue } from '../utils/date';
import type { AccessStatus, Badge, LearningProfile } from '../types';
import { C } from '../constants/theme';
import {
  cancelStudyReminder,
  scheduleStudyReminder,
} from '../services/notifications';

type StatsScreenProps = BottomTabScreenProps<AppTabParamList, 'Stats'>;

function getLast28Days() {
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - index));

    return {
      key: formatLocalDateKey(date),
      label: date.toLocaleDateString('uk-UA', { weekday: 'short' }).slice(0, 2),
    };
  });
}

export function StatsScreen({ navigation }: StatsScreenProps) {
  const isFocused = useIsFocused();
  const { progress, sessions, refresh } = useProgress();
  const [cacheCount, setCacheCount] = useState(0);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      const [count, nextBadges, nextProfile, nextAccessStatus] = await Promise.all([
        getExerciseCacheCount(),
        getBadges(progress, sessions),
        getLearningProfile(),
        getAccessStatus(),
      ]);

      if (isActive) {
        setCacheCount(count);
        setBadges(nextBadges);
        setProfile(nextProfile);
        setAccessStatus(nextAccessStatus);
      }
    }

    if (isFocused) void loadData();
    return () => { isActive = false; };
  }, [isFocused, sessions.length, progress.totalExercises]);

  const recentDays = useMemo(() => getLast28Days(), []);

  const chartData = useMemo(() => recentDays.map((day) => {
    const exercises = sessions.flatMap((session) =>
      getLocalDateKeyFromStoredValue(session.date) === day.key ? session.exercises : []
    );
    const correctCount = exercises.filter((exercise) => exercise.isCorrect).length;
    const totalXP = exercises.length * 10 + correctCount * 5;
    const intensity = Math.min(totalXP / 150, 1);
    return { ...day, totalXP, intensity };
  }), [recentDays, sessions]);

  const topicStats = useMemo(() =>
    sessions.flatMap((session) => session.exercises).reduce<Record<string, { total: number; incorrect: number }>>(
      (accumulator, exercise) => {
        const current = accumulator[exercise.topic] ?? { total: 0, incorrect: 0 };
        accumulator[exercise.topic] = {
          total: current.total + 1,
          incorrect: current.incorrect + (exercise.isCorrect ? 0 : 1),
        };
        return accumulator;
      },
      {}
    ), [sessions]);

  const weakTopicEntries = useMemo(() =>
    Object.entries(topicStats)
      .filter(([, value]) => value.incorrect > 0)
      .sort((left, right) => right[1].incorrect - left[1].incorrect),
    [topicStats]);

  const currentLevelIndex = ['A1', 'A2', 'B1', 'B2', 'C1'].indexOf(progress.level);
  const levelProgress = currentLevelIndex < 4 ? (currentLevelIndex + 1) / 5 : 1;

  const accuracy = useMemo(() =>
    progress.totalExercises > 0
      ? Math.round((progress.correctAnswers / progress.totalExercises) * 100)
      : 0,
    [progress.totalExercises, progress.correctAnswers]);

  // Top weekly sessions — real data instead of fake leaderboard
  const weeklyTopSessions = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekKey = formatLocalDateKey(sevenDaysAgo);

    return sessions
      .filter((s) => getLocalDateKeyFromStoredValue(s.date) >= weekKey)
      .map((s) => ({
        id: s.id,
        date: getLocalDateKeyFromStoredValue(s.date),
        xp: s.exercises.length * 10 + s.exercises.filter((e) => e.isCorrect).length * 5,
        correct: s.exercises.filter((e) => e.isCorrect).length,
        total: s.exercises.length,
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5);
  }, [sessions]);

  async function handleResetData() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Скинути статистику?',
      'Це очистить прогрес, сесії та кеш збережених вправ, але збереже вибраний рівень і профіль навчання.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Скинути',
          style: 'destructive',
          onPress: async () => {
            await resetLearningData();
            await resetLearningHubData();
            refresh();
            setCacheCount(0);
            setBadges([]);
            setProfile(await getLearningProfile());
          },
        },
      ]
    );
  }

  async function handleClearExerciseCacheOnly() {
    await Haptics.selectionAsync();
    await clearExerciseCache();
    setCacheCount(0);
  }

  async function handleClearChatOnly() {
    await Haptics.selectionAsync();
    await clearChatHistory();
    Alert.alert('Готово', 'Історію AI-чату очищено.');
  }

  async function handleFullLearningReset() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Почати з нуля?',
      'Це очистить статистику, кеш вправ, словник, курси, денний план, AI-чат, профіль навчання і поверне тебе на перший екран вибору рівня.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Скинути все',
          style: 'destructive',
          onPress: async () => {
            await clearStoredData();
            await resetLearningHubData({ includeProfile: true });
            DeviceEventEmitter.emit('onboarding-reset');
          },
        },
      ]
    );
  }

  async function handleToggleReminders() {
    await Haptics.selectionAsync();
    const nextEnabled = !(profile?.remindersEnabled ?? false);
    const nextProfile = await updateLearningProfile({ remindersEnabled: nextEnabled });
    setProfile(nextProfile);

    if (nextEnabled) {
      const ok = await scheduleStudyReminder(
        nextProfile.reminderHour,
        nextProfile.reminderMinute,
      );
      if (!ok) {
        Alert.alert(
          'Дозвіл відсутній',
          'Дозволь сповіщення у налаштуваннях пристрою, щоб нагадування працювали.',
        );
      }
    } else {
      await cancelStudyReminder();
    }
  }

  async function handleShiftReminder(hoursDelta: number) {
    if (!profile) return;
    await Haptics.selectionAsync();
    const nextHour = (profile.reminderHour + hoursDelta + 24) % 24;
    const nextProfile = await updateLearningProfile({ reminderHour: nextHour });
    setProfile(nextProfile);

    // Re-schedule with updated time if reminders are enabled
    if (nextProfile.remindersEnabled) {
      await scheduleStudyReminder(nextProfile.reminderHour, nextProfile.reminderMinute);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>

      {/* ── HERO ── */}
      <View style={styles.heroSection}>
        <Text style={styles.eyebrow}>Статистика</Text>
        <Text style={styles.heroTitle}>Твій прогрес</Text>

        <View style={styles.heroGrid}>
          <View style={[styles.heroStat, { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: C.goldDim }]}>
            <Text style={styles.heroStatEmoji}>🔥</Text>
            <Text style={[styles.heroStatValue, { color: C.goldLight }]}>{progress.streak}</Text>
            <Text style={styles.heroStatLabel}>Streak</Text>
          </View>
          <View style={[styles.heroStat, { borderColor: C.accentBorder, backgroundColor: C.accentDim }]}>
            <Text style={styles.heroStatEmoji}>⚡</Text>
            <Text style={[styles.heroStatValue, { color: C.accentLight }]}>{progress.xp ?? 0}</Text>
            <Text style={styles.heroStatLabel}>XP</Text>
          </View>
          <View style={[styles.heroStat, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: C.greenDim }]}>
            <Text style={styles.heroStatEmoji}>🎯</Text>
            <Text style={[styles.heroStatValue, { color: C.greenLight }]}>{accuracy}%</Text>
            <Text style={styles.heroStatLabel}>Точність</Text>
          </View>
          <View style={[styles.heroStat, { borderColor: C.accentBorder, backgroundColor: C.accentDim }]}>
            <MaterialCommunityIcons name="school-outline" size={20} color={C.accentLight} />
            <Text style={[styles.heroStatValue, { color: C.accentLight }]}>{progress.level}</Text>
            <Text style={styles.heroStatLabel}>Рівень</Text>
          </View>
        </View>

        <View style={styles.levelBarWrap}>
          <ProgressBar label="Прогрес до наступного рівня" progress={levelProgress} />
        </View>

        {profile ? (
          <Text style={styles.profileHint}>
            Ціль: {profile.goal.replace(/_/g, ' ')} · {profile.dailyMinutes} хв/день · акцент: {profile.preferredFocus}
          </Text>
        ) : null}
      </View>

      {/* ── АКТИВНІСТЬ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Активність — 28 днів</Text>
        <Text style={styles.sectionSub}>Темнішій квадрат = більше XP за цей день</Text>
        <View style={styles.heatmapGrid}>
          {chartData.map((day) => (
            <View
              key={day.key}
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: day.intensity > 0
                    ? `rgba(99,102,241,${0.15 + day.intensity * 0.85})`
                    : C.surface,
                  borderColor: day.intensity > 0 ? C.accentBorder : C.cardBorder,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── СЛАБКІ ТЕМИ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📉 Слабкі теми</Text>
        {weakTopicEntries.length > 0 ? (
          <View style={styles.badgeWrap}>
            {weakTopicEntries.map(([topic, value]) => (
              <WeakTopicBadge
                key={topic}
                topic={topic}
                value={`${Math.round((value.incorrect / value.total) * 100)}% помилок`}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Слабких тем ще немає — продовжуй практикуватись!</Text>
        )}
      </View>

      {/* ── ТОП ТИЖНЯ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Топ сесій за тиждень</Text>
        {weeklyTopSessions.length > 0 ? (
          <View style={styles.leaderList}>
            {weeklyTopSessions.map((item, index) => (
              <View key={item.id} style={[styles.leaderRow, index === 0 && styles.leaderRowMe]}>
                <Text style={[styles.leaderRank, index === 0 && { color: C.goldLight }]}>#{index + 1}</Text>
                <View style={[styles.leaderAvatar, index === 0 && { backgroundColor: C.accent }]}>
                  <MaterialCommunityIcons
                    name={index === 0 ? 'trophy' : 'lightning-bolt'}
                    size={16}
                    color={index === 0 ? '#fff' : C.accentLight}
                  />
                </View>
                <Text style={[styles.leaderName, index === 0 && { color: C.text }]}>
                  {item.date} · {item.correct}/{item.total} правильно
                </Text>
                <Text style={[styles.leaderXP, index === 0 && { color: C.goldLight }]}>
                  {item.xp} XP
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Ще немає сесій цього тижня. Починай практику!</Text>
        )}
      </View>

      {/* ── БЕЙДЖІ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎖 Досягнення</Text>
        {badges.length > 0 ? (
          <View style={styles.badgeWrap}>
            {badges.map((badge) => (
              <View
                key={badge.id}
                style={[styles.badgeCard, badge.unlocked && styles.badgeCardActive]}
              >
                <Text style={styles.badgeTitle}>{badge.title}</Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Бейджі ще не пораховані.</Text>
        )}
      </View>

      {/* ── НАГАДУВАННЯ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Нагадування</Text>
        <Text style={styles.emptyText}>
          {profile
            ? profile.remindersEnabled
              ? `Активно на ${`${profile.reminderHour}`.padStart(2, '0')}:${`${profile.reminderMinute}`.padStart(2, '0')}`
              : 'Нагадування вимкнені'
            : 'Завантажуємо налаштування...'}
        </Text>
        <View style={styles.pillRow}>
          <TouchableOpacity style={styles.pill} onPress={() => void handleToggleReminders()}>
            <Text style={styles.pillText}>{profile?.remindersEnabled ? 'Вимкнути' : 'Увімкнути'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => void handleShiftReminder(-1)}>
            <Text style={styles.pillText}>−1 год</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => void handleShiftReminder(1)}>
            <Text style={styles.pillText}>+1 год</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── ПІДПИСКА ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💎 Підписка</Text>
        <Text style={styles.emptyText}>
          {accessStatus?.tier === 'vip'
            ? 'VIP активний — ліміти знято повністю.'
            : `Вправи: ${accessStatus?.remaining.practiceExercises ?? 0} · Слова: ${accessStatus?.remaining.wordReviews ?? 0} · Chat: ${accessStatus?.remaining.aiChatMessages ?? 0}`}
        </Text>
        <TouchableOpacity style={styles.accentBtn} onPress={() => (navigation as any).navigate('Subscription')}>
          <Text style={styles.accentBtnText}>Відкрити меню підписки →</Text>
        </TouchableOpacity>
      </View>

      {/* ── КЕРУВАННЯ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Керування даними</Text>
        <Text style={styles.emptyText}>У кеші {cacheCount} AI-вправ.</Text>
        <TouchableOpacity style={styles.pill} onPress={() => void handleClearExerciseCacheOnly()}>
          <Text style={styles.pillText}>Очистити кеш вправ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pill} onPress={() => void handleClearChatOnly()}>
          <Text style={styles.pillText}>Очистити AI-чат</Text>
        </TouchableOpacity>
        <View style={styles.dangerRow}>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => void handleResetData()}>
            <MaterialCommunityIcons name="refresh" size={15} color={C.redLight} />
            <Text style={styles.dangerBtnText}>Скинути статистику</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => void handleFullLearningReset()}>
            <MaterialCommunityIcons name="delete-outline" size={15} color={C.redLight} />
            <Text style={styles.dangerBtnText}>Почати з нуля</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── ПІДСУМОК ── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Виконано вправ</Text>
          <Text style={styles.summaryValue}>{progress.totalExercises}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Найкращий стрик</Text>
          <Text style={styles.summaryValue}>{progress.streakRecord ?? progress.streak}</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, flex: 1 },
  container: { gap: 16, padding: 16, paddingBottom: 32 },

  // HERO
  heroSection: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderRadius: C.r.xl,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  eyebrow: {
    color: C.accentLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: { color: C.text, fontSize: 26, fontWeight: '800', lineHeight: 32 },
  heroGrid: { flexDirection: 'row', gap: 10 },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    borderRadius: C.r.md,
    borderWidth: 1,
    gap: 4,
    paddingVertical: 12,
  },
  heroStatEmoji: { fontSize: 18 },
  heroStatValue: { fontSize: 20, fontWeight: '900' },
  heroStatLabel: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  levelBarWrap: { marginTop: 4 },
  profileHint: { color: C.textMuted, fontSize: 12, lineHeight: 18 },

  // SECTIONS
  section: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderRadius: C.r.lg,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  sectionSub: { color: C.textMuted, fontSize: 12 },
  emptyText: { color: C.textMuted, fontSize: 14, lineHeight: 20 },

  // HEATMAP
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  heatmapCell: {
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    width: '12%',
  },

  // LEAGUE
  leagueTag: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: C.r.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  leagueTagText: { color: C.goldLight, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  leaderList: { gap: 8 },
  leaderRow: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderRadius: C.r.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  leaderRowMe: {
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
  },
  leaderRank: { color: C.textMuted, fontSize: 15, fontWeight: '800', width: 20, textAlign: 'center' },
  leaderAvatar: {
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: C.r.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  leaderInitial: { color: C.text, fontSize: 14, fontWeight: '800' },
  leaderName: { color: C.textSub, flex: 1, fontSize: 15, fontWeight: '700' },
  leaderXP: { color: C.textMuted, fontSize: 14, fontWeight: '800' },

  // BADGES
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: {
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderRadius: C.r.md,
    borderWidth: 1,
    gap: 4,
    minWidth: '47%',
    padding: 14,
    flex: 1,
  },
  badgeCardActive: { borderColor: C.gold },
  badgeTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  badgeDesc: { color: C.textSub, fontSize: 13, lineHeight: 18 },

  // PILLS
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
    borderRadius: C.r.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillText: { color: C.accentLight, fontSize: 13, fontWeight: '700' },

  // ACCENT BUTTON
  accentBtn: {
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: C.r.md,
    paddingVertical: 12,
  },
  accentBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // DANGER
  dangerRow: { flexDirection: 'row', gap: 10 },
  dangerBtn: {
    alignItems: 'center',
    backgroundColor: C.redDim,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: C.r.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 11,
  },
  dangerBtnText: { color: C.redLight, fontSize: 13, fontWeight: '700' },

  // SUMMARY
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderRadius: C.r.lg,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 18,
  },
  summaryLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  summaryValue: { color: C.text, fontSize: 28, fontWeight: '800' },
});

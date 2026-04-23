import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from '../utils/haptics';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useProgress } from '../hooks/useProgress';
import type { AppTabParamList } from '../navigation/AppNavigator';
import {
  getBadges,
  getDailyPlan,
  getLearningProfile,
  resetLearningHubData,
  toggleDailyPlanItem,
} from '../services/learningHub';
import {
  clearStoredData,
  getSmartRecommendedCachedExercises,
  getWeakTopicCachedExercises,
  normalizeTopicKey,
  resetLearningData,
  type CachedExerciseRecord,
} from '../services/storage';
import type { DailyPlan, LearningProfile, PracticeFocus } from '../types';
import { C } from '../constants/theme';

type HomeScreenProps = BottomTabScreenProps<AppTabParamList, 'Home'>;

function getExerciseKey(record: CachedExerciseRecord) {
  return `${record.exercise.type}:${record.exercise.topic}:${record.exercise.question}:${record.exercise.correctAnswer}`;
}

const QUICK_CARDS: Array<{
  icon: string;
  label: string;
  color: string;
  bg: string;
  action: 'Learn' | 'Practice' | 'PracticeMistakes' | 'Chat' | 'Library' | 'Stats' | 'Subscription';
}> = [
  { icon: 'book-open-variant', label: 'Слова', color: '#818CF8', bg: 'rgba(99,102,241,0.12)', action: 'Learn' },
  { icon: 'lightning-bolt', label: 'Практика', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', action: 'Practice' },
  { icon: 'alert-circle-check-outline', label: 'Мої помилки', color: '#FB7185', bg: 'rgba(244,63,94,0.12)', action: 'PracticeMistakes' },
  { icon: 'chat-processing', label: 'AI Чат', color: '#10B981', bg: 'rgba(16,185,129,0.12)', action: 'Chat' },
  { icon: 'database', label: 'База', color: '#C084FC', bg: 'rgba(192,132,252,0.12)', action: 'Library' },
  { icon: 'chart-bar', label: 'Статистика', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', action: 'Stats' },
  { icon: 'crown', label: 'Підписка', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', action: 'Subscription' },
];

export function HomeScreen({ navigation }: HomeScreenProps) {
  const isFocused = useIsFocused();
  const { progress, sessions, refresh } = useProgress();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [recommendedExercises, setRecommendedExercises] = useState<CachedExerciseRecord[]>([]);
  const [weakTopicExercises, setWeakTopicExercises] = useState<CachedExerciseRecord[]>([]);

  const glowAnim = useRef(new Animated.Value(0)).current;

  const accuracy = useMemo(
    () =>
      progress.totalExercises > 0
        ? Math.round((progress.correctAnswers / progress.totalExercises) * 100)
        : 0,
    [progress.totalExercises, progress.correctAnswers]
  );

  // Stable key to avoid JSON.stringify on every render
  const topicMistakeKey = useMemo(
    () => Object.entries(progress.topicMistakes ?? {}).sort().map(([k, v]) => `${k}:${v}`).join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress.topicMistakes]
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  useEffect(() => {
    let isActive = true;
    async function load() {
      const [nextProfile, nextPlan, items, weakItems] = await Promise.all([
        getLearningProfile(),
        getDailyPlan(progress),
        getSmartRecommendedCachedExercises(progress, 3),
        getWeakTopicCachedExercises(progress, 6),
      ]);

      const recommendedItems = items.slice(0, 3);
      const recommendedKeys = new Set(recommendedItems.map(getExerciseKey));
      const filteredWeakItems = weakItems
        .filter((item) => !recommendedKeys.has(getExerciseKey(item)))
        .sort(
          (l, r) =>
            (progress.topicMistakes?.[normalizeTopicKey(r.exercise.topic)] ?? 0) -
            (progress.topicMistakes?.[normalizeTopicKey(l.exercise.topic)] ?? 0)
        )
        .slice(0, 3);

      if (!isActive) return;
      setProfile(nextProfile);
      setPlan(nextPlan);
      setRecommendedExercises(recommendedItems);
      setWeakTopicExercises(filteredWeakItems);
    }
    if (isFocused) void load();
    return () => { isActive = false; };
  }, [
    isFocused,
    progress.correctAnswers,
    progress.level,
    progress.streak,
    progress.totalExercises,
    progress.weakTopics.join('|'),
    sessions.length,
    topicMistakeKey,
  ]);

  async function openPractice(options?: {
    quickStart?: boolean;
    focus?: PracticeFocus;
    presetExercise?: CachedExerciseRecord['exercise'];
    source?: 'default' | 'mistakes';
  }) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Practice', {
      quickStart: options?.quickStart,
      focus: options?.focus ?? 'mixed',
      presetExercise: options?.presetExercise,
      source: options?.source ?? 'default',
    });
  }

  async function openTab(tab: 'Learn' | 'Library' | 'Chat' | 'Stats') {
    await Haptics.selectionAsync();
    navigation.navigate(tab);
  }

  async function openSubscription() {
    await Haptics.selectionAsync();
    (navigation as any).navigate('Subscription');
  }

  async function handleTogglePlan(itemId: string) {
    await Haptics.selectionAsync();
    const nextPlan = await toggleDailyPlanItem(itemId);
    if (nextPlan) setPlan(nextPlan);
  }

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
            setPlan(null);
            setProfile(await getLearningProfile());
          },
        },
      ]
    );
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
            refresh();
            setPlan(null);
            setProfile(null);
            DeviceEventEmitter.emit('onboarding-reset');
          },
        },
      ]
    );
  }

  const completedCount = plan?.items.filter((i) => i.completed).length ?? 0;
  const totalCount = plan?.items.length ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>

      {/* ── 1. HERO ── */}
      <View style={styles.hero}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heroGlow,
            {
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] }),
            },
          ]}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroEyebrow}>LangAI</Text>
              <Text style={styles.heroGreeting}>
                {profile ? `Привіт! Рівень ${progress.level}` : 'Готуємо маршрут...'}
              </Text>
              {profile ? (
                <Text style={styles.heroGoal}>
                  {profile.goal.replace(/_/g, ' ')} · {profile.dailyMinutes} хв на день
                </Text>
              ) : null}
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{progress.level}</Text>
            </View>
          </View>

          {/* stat row */}
          <View style={styles.statRow}>
            <View style={[styles.statPill, { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.3)' }]}>
              <Text style={styles.statPillEmoji}>🔥</Text>
              <View>
                <Text style={[styles.statPillValue, { color: C.goldLight }]}>{progress.streak}</Text>
                <Text style={styles.statPillLabel}>Streak</Text>
              </View>
            </View>
            <View style={[styles.statPill, { backgroundColor: C.accentDim, borderColor: C.accentBorder }]}>
              <Text style={styles.statPillEmoji}>⚡</Text>
              <View>
                <Text style={[styles.statPillValue, { color: C.accentLight }]}>{progress.xp ?? 0}</Text>
                <Text style={styles.statPillLabel}>XP</Text>
              </View>
            </View>
            <View style={[styles.statPill, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' }]}>
              <Text style={styles.statPillEmoji}>🎯</Text>
              <View>
                <Text style={[styles.statPillValue, { color: C.greenLight }]}>{accuracy}%</Text>
                <Text style={styles.statPillLabel}>Точність</Text>
              </View>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.heroCTA}
            onPress={() => void openPractice({ quickStart: true, focus: 'mixed' })}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#fff" />
            <Text style={styles.heroCTAText}>Старт 1 хв</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. ПЛАН НА СЬОГОДНІ ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📅 План на сьогодні</Text>
          {totalCount > 0 && (
            <View style={styles.planProgress}>
              <Text style={styles.planProgressText}>{completedCount}/{totalCount}</Text>
            </View>
          )}
        </View>

        {plan ? (
          plan.items.map((item) => (
            <View key={item.id} style={[styles.planCard, item.completed && styles.planCardDone]}>
              <View style={styles.planCardLeft}>
                <TouchableOpacity
                  style={[styles.planCheck, item.completed && styles.planCheckDone]}
                  onPress={() => void handleTogglePlan(item.id)}
                >
                  {item.completed && (
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                  )}
                </TouchableOpacity>
                <View style={styles.planTextBlock}>
                  <Text style={[styles.planTitle, item.completed && styles.planTitleDone]}>
                    {item.title}
                  </Text>
                  <Text style={styles.planDesc}>{item.description}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.planOpenBtn}
                onPress={() => {
                  if (item.type === 'chat') { void openTab('Chat'); return; }
                  if (item.type === 'new_words' || item.type === 'review_words') { void openTab('Learn'); return; }
                  if (item.type === 'mistakes') {
                    void openPractice({ focus: item.focus ?? 'mixed', source: 'mistakes' });
                    return;
                  }
                  void openPractice({ focus: item.focus ?? 'mixed' });
                }}
              >
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.accentLight} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Готуємо денний план...</Text>
        )}
      </View>

      {/* ── 3. ШВИДКИЙ СТАРТ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Швидкий старт</Text>
        <View style={styles.quickGrid}>
          {QUICK_CARDS.map((card) => (
            <TouchableOpacity
              key={card.label}
              style={[styles.quickCard, { backgroundColor: card.bg, borderColor: card.color + '30' }]}
              onPress={() => {
                if (card.action === 'Subscription') { void openSubscription(); return; }
                if (card.action === 'Practice') { void openPractice({ focus: 'mixed' }); return; }
                if (card.action === 'PracticeMistakes') {
                  void openPractice({ focus: 'mixed', source: 'mistakes' });
                  return;
                }
                void openTab(card.action as any);
              }}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: card.color + '18' }]}>
                <MaterialCommunityIcons name={card.icon as any} size={24} color={card.color} />
              </View>
              <Text style={[styles.quickLabel, { color: card.color }]}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── 4. РЕКОМЕНДАЦІЇ ── */}
      {(recommendedExercises.length > 0 || weakTopicExercises.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Рекомендовані вправи</Text>

          {recommendedExercises.map((item) => (
            <TouchableOpacity
              key={`${item.exercise.id}-${item.createdAt}`}
              style={styles.recCard}
              onPress={() => void openPractice({ focus: item.exercise.category, presetExercise: item.exercise })}
            >
              <View style={styles.recCardTop}>
                <Text style={styles.recTopic}>{item.exercise.topic.replace(/_/g, ' ')}</Text>
                <View style={styles.recBadge}><Text style={styles.recBadgeText}>Smart</Text></View>
              </View>
              <Text style={styles.recTitle}>{item.exercise.title}</Text>
              <Text style={styles.recText} numberOfLines={2}>{item.exercise.question}</Text>
            </TouchableOpacity>
          ))}

          {weakTopicExercises.map((item) => (
            <TouchableOpacity
              key={`${item.exercise.id}-${item.createdAt}-weak`}
              style={[styles.recCard, styles.recCardWeak]}
              onPress={() => void openPractice({ focus: item.exercise.category, presetExercise: item.exercise })}
            >
              <View style={styles.recCardTop}>
                <Text style={styles.recTopic}>{item.exercise.topic.replace(/_/g, ' ')}</Text>
                <View style={[styles.recBadge, styles.recBadgeWeak]}>
                  <Text style={styles.recBadgeText}>
                    {progress.topicMistakes?.[normalizeTopicKey(item.exercise.topic)] ?? 0} помилок
                  </Text>
                </View>
              </View>
              <Text style={styles.recTitle}>{item.exercise.title}</Text>
              <Text style={styles.recText} numberOfLines={2}>{item.exercise.question}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 5. КЕРУВАННЯ ДАНИМИ ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Керування</Text>
        <View style={styles.dangerRow}>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => void handleResetData()}>
            <MaterialCommunityIcons name="refresh" size={16} color={C.redLight} />
            <Text style={styles.dangerBtnText}>Скинути статистику</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => void handleFullLearningReset()}>
            <MaterialCommunityIcons name="delete-outline" size={16} color={C.redLight} />
            <Text style={styles.dangerBtnText}>Почати з нуля</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, flex: 1 },
  container: { gap: 16, padding: 16, paddingBottom: 32 },

  // HERO
  hero: {
    borderRadius: C.r.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: C.accent,
    borderRadius: 999,
    height: 260,
    left: '20%',
    position: 'absolute',
    top: -80,
    width: 260,
  },
  heroContent: {
    backgroundColor: '#0D1526',
    borderColor: C.accentBorder,
    borderRadius: C.r.xl,
    borderWidth: 1,
    gap: 16,
    padding: 22,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroTextBlock: { flex: 1, gap: 4 },
  heroEyebrow: {
    color: C.accentLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroGreeting: { color: C.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  heroGoal: { color: C.textSub, fontSize: 13, lineHeight: 18, marginTop: 2 },
  levelBadge: {
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
    borderRadius: C.r.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: { color: C.accentLight, fontSize: 22, fontWeight: '900' },

  statRow: { flexDirection: 'row', gap: 10 },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: C.r.md,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statPillEmoji: { fontSize: 18 },
  statPillValue: { fontSize: 18, fontWeight: '800' },
  statPillLabel: { color: C.textMuted, fontSize: 10, fontWeight: '600', marginTop: 1 },

  heroCTA: {
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: C.r.lg,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  heroCTAText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // SECTIONS
  section: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderRadius: C.r.lg,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  emptyText: { color: C.textMuted, fontSize: 14, lineHeight: 20 },

  // PLAN
  planProgress: {
    backgroundColor: C.accentDim,
    borderRadius: C.r.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planProgressText: { color: C.accentLight, fontSize: 12, fontWeight: '700' },
  planCard: {
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderRadius: C.r.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  planCardDone: { borderColor: 'rgba(16,185,129,0.3)', opacity: 0.75 },
  planCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planCheck: {
    width: 26,
    height: 26,
    borderRadius: C.r.full,
    borderWidth: 2,
    borderColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCheckDone: { backgroundColor: C.green, borderColor: C.green },
  planTextBlock: { flex: 1, gap: 2 },
  planTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  planTitleDone: { color: C.textDim, textDecorationLine: 'line-through' },
  planDesc: { color: C.textMuted, fontSize: 12, lineHeight: 16 },
  planOpenBtn: { padding: 4 },

  // QUICK GRID
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    alignItems: 'center',
    borderRadius: C.r.md,
    borderWidth: 1,
    gap: 8,
    minWidth: '30%',
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  quickIconWrap: {
    borderRadius: C.r.sm,
    padding: 10,
  },
  quickLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // RECOMMENDATIONS
  recCard: {
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderRadius: C.r.md,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  recCardWeak: { borderColor: 'rgba(239,68,68,0.2)' },
  recCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recTopic: { color: C.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  recBadge: {
    backgroundColor: C.accentDim,
    borderRadius: C.r.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recBadgeWeak: { backgroundColor: 'rgba(239,68,68,0.12)' },
  recBadgeText: { color: C.accentLight, fontSize: 11, fontWeight: '700' },
  recTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  recText: { color: C.textSub, fontSize: 13, lineHeight: 18 },

  // DANGER
  dangerRow: { flexDirection: 'row', gap: 10 },
  dangerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.redDim,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: C.r.md,
    borderWidth: 1,
    paddingVertical: 12,
  },
  dangerBtnText: { color: C.redLight, fontSize: 13, fontWeight: '700' },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Haptics from '../utils/haptics';
import { useIsFocused } from '@react-navigation/native';

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type { AppTabParamList } from '../navigation/AppNavigator';
import type { AppRootParamList } from '../navigation/AppNavigator';
import { getAccessStatus } from '../services/access';
import {
  addCustomWord,
  canManageWordEntry,
  completeCourseLesson,
  deleteWord,
  getCoursesWithProgress,
  getDueWords,
  getLearningProfile,
  getNewWords,
  getReminderLabel,
  getStudyQueue,
  getWordStats,
  generateAIWordCollection,
  importWordCollection,
  markDailyPlanItemsCompleted,
  getWordBank,
  reviewWord,
  toggleCourseEnrollment,
  toggleWordFavorite,
  updateWord,
  updateLearningProfile,
} from '../services/learningHub';
import type { AccessStatus, CourseWithProgress, LearningProfile, ReviewOutcome, WordEntry } from '../types';

type LearnScreenProps = BottomTabScreenProps<AppTabParamList, 'Learn'> & {
  navigation: any; // allows navigating to root stack screens like Flashcard
};

const REVIEW_ACTIONS: Array<{ key: ReviewOutcome; label: string }> = [
  { key: 'again', label: 'Не знаю' },
  { key: 'hard', label: 'Важко' },
  { key: 'good', label: 'Добре' },
  { key: 'easy', label: 'Легко' },
];

const REVIEW_BATCH_OPTIONS: number[] = [5, 10, 15, 20, 30, 50];
const NEW_WORD_OPTIONS: number[] = [0, 3, 5, 8, 12, 20];

function getSourceLabel(word: WordEntry) {
  if (word.source === 'ai') {
    return 'Бот';
  }

  if (word.source === 'manual') {
    return 'Своє';
  }

  if (word.source === 'cache') {
    return 'З практики';
  }

  if (word.source === 'course') {
    return 'Курс';
  }

  return 'База';
}

function createWordDraft(word: WordEntry) {
  return {
    word: word.word,
    translation: word.translation,
    example: word.example,
    topic: word.topic,
  };
}

function createEmptyWordDraft(topic = '') {
  return {
    word: '',
    translation: '',
    example: '',
    topic,
  };
}

function formatTopicLabel(topic: string) {
  const normalized = topic.trim().replace(/_/g, ' ');
  return normalized ? normalized : 'Без теми';
}

function getWordAccessText(accessStatus: AccessStatus | null) {
  if (!accessStatus) {
    return 'Перевіряємо доступ до повторення слів...';
  }

  if (accessStatus.tier === 'vip') {
    return 'VIP активний: повторення слів без денного ліміту.';
  }

  return `Звичайний доступ: сьогодні залишилось ${accessStatus.remaining.wordReviews ?? 0} повторів слів.`;
}

export function LearnScreen({ navigation }: LearnScreenProps) {
  const isFocused = useIsFocused();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [wordStats, setWordStats] = useState({
    total: 0,
    favorites: 0,
    mastered: 0,
    due: 0,
    newWords: 0,
  });
  const [dueWords, setDueWords] = useState<WordEntry[]>([]);
  const [newWords, setNewWords] = useState<WordEntry[]>([]);
  const [studyQueue, setStudyQueue] = useState<WordEntry[]>([]);
  const [favoriteWords, setFavoriteWords] = useState<WordEntry[]>([]);
  const [allWords, setAllWords] = useState<WordEntry[]>([]);
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [reminderLabel, setReminderLabel] = useState('');
  const [wordEditorVisible, setWordEditorVisible] = useState(false);
  const [topicManagerVisible, setTopicManagerVisible] = useState(false);
  const [managedTopic, setManagedTopic] = useState('');
  const [editingWord, setEditingWord] = useState<WordEntry | null>(null);
  const [wordEditorDraft, setWordEditorDraft] = useState(createEmptyWordDraft());
  const [draftWord, setDraftWord] = useState('');
  const [draftTranslation, setDraftTranslation] = useState('');
  const [draftExample, setDraftExample] = useState('');
  const [draftTopic, setDraftTopic] = useState('');
  const [topicWordDraft, setTopicWordDraft] = useState(createEmptyWordDraft());
  const [draftAiTopic, setDraftAiTopic] = useState('');
  const [isGeneratingWords, setIsGeneratingWords] = useState(false);
  const [importTopic, setImportTopic] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [reviewBatchDraft, setReviewBatchDraft] = useState('10');
  const [newWordsDraft, setNewWordsDraft] = useState('3');
  const swipeX = useRef(new Animated.Value(0)).current;
  const activeStudyWord = studyQueue[0] ?? null;

  async function syncWordPlanCompletion(nextDueWords: WordEntry[], nextNewWords: WordEntry[], activeProfile: LearningProfile) {
    const completedIds: string[] = [];

    if (nextDueWords.length === 0) {
      completedIds.push('review-words');
    }

    if (activeProfile.newWordsPerSession === 0 || nextNewWords.length === 0) {
      completedIds.push('new-words');
    }

    if (completedIds.length > 0) {
      await markDailyPlanItemsCompleted(completedIds);
    }
  }

  // Shared loader — used by both the focus effect and refreshData
  const loadData = useCallback(async (profileOverride?: LearningProfile) => {
    const activeProfile = profileOverride ?? await getLearningProfile();
    const [nextStats, nextDueWords, nextNewWords, nextWords, nextCourses, nextReminder, nextStudyQueue] =
      await Promise.all([
        getWordStats(),
        getDueWords(5),
        getNewWords(5),
        getWordBank(),
        getCoursesWithProgress(),
        getReminderLabel(),
        getStudyQueue(activeProfile),
      ]);
    const nextAccessStatus = await getAccessStatus();

    await syncWordPlanCompletion(nextDueWords, nextNewWords, activeProfile);

    setProfile(activeProfile);
    setAccessStatus(nextAccessStatus);
    setWordStats(nextStats);
    setDueWords(nextDueWords);
    setNewWords(nextNewWords);
    setStudyQueue(nextStudyQueue);
    setAllWords(nextWords);
    setFavoriteWords(nextWords.filter((word) => word.favorite).slice(0, 5));
    setCourses(nextCourses);
    setReminderLabel(nextReminder);
    setReviewBatchDraft(`${activeProfile.reviewBatchSize}`);
    setNewWordsDraft(`${activeProfile.newWordsPerSession}`);
  }, []);

  async function refreshData(nextProfileOverride?: LearningProfile) {
    await loadData(nextProfileOverride);
  }

  useEffect(() => {
    let isActive = true;

    async function load() {
      if (!isActive) return;
      await loadData();
    }

    if (isFocused) {
      void load();
    }

    return () => {
      isActive = false;
    };
  }, [isFocused, loadData]);

  useEffect(() => {
    swipeX.setValue(0);
  }, [activeStudyWord?.id, swipeX]);

  async function handleReview(wordId: string, outcome: ReviewOutcome) {
    try {
      await Haptics.selectionAsync();
      await reviewWord(wordId, outcome);
      await refreshData();
    } catch (error) {
      Alert.alert('Ліміт на сьогодні', error instanceof Error ? error.message : 'Не вдалося виконати повторення.');
      setAccessStatus(await getAccessStatus());
    }
  }

  async function handleToggleFavorite(wordId: string) {
    await Haptics.selectionAsync();
    await toggleWordFavorite(wordId);
    await refreshData();
  }

  async function handleDeleteWord(word: WordEntry) {
    if (!canManageWordEntry(word)) {
      Alert.alert('Слово з бази', 'Слова з бази не можна видаляти.');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Видалити слово?',
      `Слово "${word.word}" буде прибране зі словника і з черги повторення.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            await deleteWord(word.id);
            await refreshData();
          },
        },
      ]
    );
  }

  function openWordEditor(word: WordEntry) {
    if (!canManageWordEntry(word)) {
      Alert.alert('Слово з бази', 'Слова з бази не можна редагувати.');
      return;
    }

    setEditingWord(word);
    setWordEditorDraft(createWordDraft(word));
    setWordEditorVisible(true);
  }

  function closeWordEditor() {
    setWordEditorVisible(false);
    setEditingWord(null);
    setWordEditorDraft(createEmptyWordDraft());
  }

  function openTopicManager(topic: string) {
    setManagedTopic(topic);
    setTopicWordDraft(createEmptyWordDraft(topic));
    setTopicManagerVisible(true);
  }

  function closeTopicManager() {
    setTopicManagerVisible(false);
    setManagedTopic('');
    setTopicWordDraft(createEmptyWordDraft());
  }

  async function handleSaveWordEdit() {
    if (!editingWord) {
      return;
    }

    if (
      !wordEditorDraft.word.trim() ||
      !wordEditorDraft.translation.trim() ||
      !wordEditorDraft.topic.trim()
    ) {
      Alert.alert('Не вистачає даних', 'Заповни слово, переклад і тему.');
      return;
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateWord(editingWord.id, {
        word: wordEditorDraft.word,
        translation: wordEditorDraft.translation,
        example: wordEditorDraft.example || `${wordEditorDraft.word} - ${wordEditorDraft.translation}`,
        topic: wordEditorDraft.topic,
      });
      closeWordEditor();
      await refreshData();
    } catch (error) {
      Alert.alert('Помилка', error instanceof Error ? error.message : 'Не вдалося зберегти слово.');
    }
  }

  function animateSwipeBack() {
    Animated.spring(swipeX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }

  async function handleSwipeReview(outcome: ReviewOutcome) {
    if (!activeStudyWord) {
      return;
    }

    const targetX = outcome === 'again' ? -220 : 220;
    Animated.timing(swipeX, {
      toValue: targetX,
      duration: 180,
      useNativeDriver: true,
    }).start(async () => {
      swipeX.setValue(0);
      await handleReview(activeStudyWord.id, outcome);
    });
  }

  async function handleUpdateReviewBatchSize(value: number) {
    if (!profile || profile.reviewBatchSize === value) {
      return;
    }

    await Haptics.selectionAsync();
    const nextProfile = await updateLearningProfile({ reviewBatchSize: value });
    await refreshData(nextProfile);
  }

  async function handleUpdateNewWordsPerSession(value: number) {
    if (!profile || profile.newWordsPerSession === value) {
      return;
    }

    await Haptics.selectionAsync();
    const nextProfile = await updateLearningProfile({ newWordsPerSession: value });
    await refreshData(nextProfile);
  }

  async function handleApplyCustomReviewBatch() {
    const parsed = Number.parseInt(reviewBatchDraft, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
      Alert.alert('Некоректне число', 'Для повторів введи число від 1.');
      return;
    }

    await handleUpdateReviewBatchSize(parsed);
  }

  async function handleApplyCustomNewWords() {
    const parsed = Number.parseInt(newWordsDraft, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      Alert.alert('Некоректне число', 'Для нових слів введи число від 0.');
      return;
    }

    await handleUpdateNewWordsPerSession(parsed);
  }

  async function handleAddWordToTopic(input: {
    word: string;
    translation: string;
    example: string;
    topic: string;
  }) {
    if (!input.word.trim() || !input.translation.trim()) {
      Alert.alert('Не вистачає даних', 'Потрібно ввести слово і переклад.');
      return false;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addCustomWord({
      word: input.word,
      translation: input.translation,
      example: input.example,
      topic: input.topic,
    });
    await refreshData();
    return true;
  }

  async function handleAddWord() {
    const wasSaved = await handleAddWordToTopic({
      word: draftWord,
      translation: draftTranslation,
      example: draftExample,
      topic: draftTopic,
    });

    if (!wasSaved) {
      return;
    }

    setDraftWord('');
    setDraftTranslation('');
    setDraftExample('');
    setDraftTopic('');
  }

  async function handleAddWordToManagedTopic() {
    if (!managedTopic.trim()) {
      return;
    }

    const wasSaved = await handleAddWordToTopic({
      word: topicWordDraft.word,
      translation: topicWordDraft.translation,
      example: topicWordDraft.example,
      topic: managedTopic,
    });

    if (!wasSaved) {
      return;
    }

    setTopicWordDraft(createEmptyWordDraft(managedTopic));
  }

  async function handleGenerateAiWords() {
    if (!profile) return;
    if (!draftAiTopic.trim()) {
      Alert.alert('Не вистачає даних', 'Введіть тему для генерації слів.');
      return;
    }

    setIsGeneratingWords(true);
    try {
      await generateAIWordCollection(draftAiTopic.trim(), profile);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Готово', 'Слова успішно згенеровані та додані до словника.');
      setDraftAiTopic('');
      await refreshData();
    } catch (e) {
      const errorStr = e instanceof Error ? e.message : 'Невідома помилка';
      Alert.alert('Помилка', errorStr);
    } finally {
      setIsGeneratingWords(false);
    }
  }

  async function handleImportJson() {
    if (!importJsonText.trim()) {
      Alert.alert('Помилка', 'Вставте JSON текст для імпорту.');
      return;
    }

    try {
      await importWordCollection(importJsonText, importTopic);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Готово', 'Слова успішно імпортовані!');
      setImportJsonText('');
      setImportTopic('');
      await refreshData();
    } catch (e) {
      const errorStr = e instanceof Error ? e.message : 'Невідома помилка';
      Alert.alert('Помилка', errorStr);
    }
  }

  async function handleToggleCourse(courseId: string) {
    await Haptics.selectionAsync();
    await toggleCourseEnrollment(courseId);
    await refreshData();
  }

  async function handleCompleteNextLesson(course: CourseWithProgress) {
    const nextLesson = course.lessons.find(
      (lesson) => !course.progress.completedLessonIds.includes(lesson.id)
    );

    if (!nextLesson) {
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeCourseLesson(course.id, nextLesson.id);
    await refreshData();
  }

  const swipeLabelLeftOpacity = swipeX.interpolate({
    inputRange: [-180, -40, 0],
    outputRange: [1, 0.35, 0],
  });
  const swipeLabelRightOpacity = swipeX.interpolate({
    inputRange: [0, 40, 180],
    outputRange: [0, 0.35, 1],
  });
  const cardRotate = swipeX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const topicSummaries = Array.from(
    allWords
      .reduce((map, word) => {
      const topicKey = word.topic.trim() || 'custom_words';
      const current = map.get(topicKey) ?? {
        topic: topicKey,
        totalWords: 0,
        editableWords: 0,
      };

      current.totalWords += 1;
      if (canManageWordEntry(word)) {
        current.editableWords += 1;
      }

      map.set(topicKey, current);
      return map;
      }, new Map<string, { topic: string; totalWords: number; editableWords: number }>())
      .values()
  ).sort((left, right) => {
    if (right.totalWords !== left.totalWords) {
      return right.totalWords - left.totalWords;
    }

    return formatTopicLabel(left.topic).localeCompare(formatTopicLabel(right.topic));
  });
  const topicWords = allWords
    .filter((word) => word.topic === managedTopic)
    .sort((left, right) => left.word.localeCompare(right.word));
  const existingTopics = topicSummaries.map((topic) => topic.topic);
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Boolean(activeStudyWord) && Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderMove: (_, gestureState) => {
      swipeX.setValue(gestureState.dx);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -120) {
        void handleSwipeReview('again');
        return;
      }

      if (gestureState.dx >= 120) {
        void handleSwipeReview('good');
        return;
      }

      animateSwipeBack();
    },
    onPanResponderTerminate: () => {
      animateSwipeBack();
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>
      {/* HERO */}
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroSurface}>
          <Text style={styles.eyebrow}>Learn Hub</Text>
          <Text style={styles.title}>Слова та повторення</Text>
          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroBadge, { borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.1)' }]}>
              <Text style={styles.heroBadgeLabel}>У словнику</Text>
              <Text style={[styles.heroBadgeValue, { color: '#818CF8' }]}>{wordStats.total}</Text>
            </View>
            <View style={[styles.heroBadge, { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Text style={styles.heroBadgeLabel}>На зараз</Text>
              <Text style={[styles.heroBadgeValue, { color: '#FCD34D' }]}>{studyQueue.length}</Text>
            </View>
            <View style={[styles.heroBadge, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Text style={styles.heroBadgeLabel}>Освоєно</Text>
              <Text style={[styles.heroBadgeValue, { color: '#6EE7B7' }]}>{wordStats.mastered}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.flashcardHeroButton}
            onPress={() => navigation.navigate('Flashcard')}
          >
            <Text style={styles.flashcardHeroButtonText}>🃏 Флеш-картки</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Режим слів по одному</Text>
        <Text style={styles.cardText}>
          У сесію потрапляє обмежена кількість слів на повтор і нових слів, а не весь запас одразу.
        </Text>
        {activeStudyWord ? (
          <View style={styles.swipeStage}>
            <Animated.Text style={[styles.swipeBadge, styles.swipeBadgeLeft, { opacity: swipeLabelLeftOpacity }]}>
              Не знаю
            </Animated.Text>
            <Animated.Text style={[styles.swipeBadge, styles.swipeBadgeRight, { opacity: swipeLabelRightOpacity }]}>
              Добре
            </Animated.Text>
            
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.wordCard,
                {
                  transform: [{ translateX: swipeX }, { rotate: cardRotate }],
                },
              ]}
            >
            <View style={styles.swipeHintRow}>
              <Animated.View style={{ opacity: swipeX.interpolate({ inputRange: [-50, 0], outputRange: [1, 0.4], extrapolate: 'clamp' }) }}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FCA5A5" />
              </Animated.View>
              <Text style={styles.swipeHintText}>Свайпай картку</Text>
              <Animated.View style={{ opacity: swipeX.interpolate({ inputRange: [0, 50], outputRange: [0.4, 1], extrapolate: 'clamp' }) }}>
                <MaterialCommunityIcons name="arrow-right" size={24} color="#86EFAC" />
              </Animated.View>
            </View>

            <View style={styles.wordHeader}>
              <View style={styles.wordInfo}>
                <Text style={styles.word}>{activeStudyWord.word}</Text>
                <Text style={styles.wordMeta}>
                  {getSourceLabel(activeStudyWord)} · тема {activeStudyWord.topic.replace(/_/g, ' ')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => void handleToggleFavorite(activeStudyWord.id)}>
                <Text style={styles.favorite}>{activeStudyWord.favorite ? '★' : '☆'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.translationBox}>
              <Text style={styles.translation}>{activeStudyWord.translation}</Text>
              <Text style={styles.wordExample}>{activeStudyWord.example}</Text>
            </View>

            <Text style={styles.queueHint}>
              У міні-сесії зараз {studyQueue.length} слів. На повтор: {wordStats.due}. Нових: {wordStats.newWords}.
            </Text>

            <View style={styles.actionRow}>
              {REVIEW_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.reviewButton}
                  onPress={() => void handleReview(activeStudyWord.id, action.key)}
                >
                  <Text style={styles.reviewButtonText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
              {canManageWordEntry(activeStudyWord) ? (
                <>
                  <TouchableOpacity
                    onPress={() => void handleDeleteWord(activeStudyWord)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>Видалити слово</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openWordEditor(activeStudyWord)}
                    style={styles.editButton}
                  >
                    <Text style={styles.editButtonText}>Редагувати</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyBadgeText}>Слово з бази: лише повторення</Text>
                </View>
              )}
            </View>
            </Animated.View>
          </View>
        ) : (
          <Text style={styles.cardText}>
            {accessStatus?.tier !== 'vip' && (accessStatus?.remaining.wordReviews ?? 0) <= 0
              ? 'Ліміт повторення слів на сьогодні вичерпано. Завтра він оновиться, або активуй VIP у меню Підписка.'
              : 'На сьогодні черга слів порожня. План по словах буде зарахований автоматично, а ти можеш додати нові слова або збільшити ліміт нижче.'}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Налаштування повторення</Text>
        <Text style={styles.cardText}>
          Регулюй, скільки слів на повтор і скільки нових слів підмішувати в одну сесію.
        </Text>
        <Text style={styles.settingLabel}>Слів на повтор за сесію</Text>
        <View style={styles.actionRow}>
          {REVIEW_BATCH_OPTIONS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => void handleUpdateReviewBatchSize(value)}
              style={[
                styles.optionChip,
                profile?.reviewBatchSize === value && styles.optionChipActive,
              ]}
            >
              <Text
                style={[
                  styles.optionChipText,
                  profile?.reviewBatchSize === value && styles.optionChipTextActive,
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.customSettingRow}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setReviewBatchDraft}
            placeholder="Власне число"
            placeholderTextColor="#6B7280"
            style={styles.customSettingInput}
            value={reviewBatchDraft}
          />
          <TouchableOpacity style={styles.customSettingButton} onPress={() => void handleApplyCustomReviewBatch()}>
            <Text style={styles.customSettingButtonText}>Застосувати</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.settingLabel}>Нових слів у сесію</Text>
        <View style={styles.actionRow}>
          {NEW_WORD_OPTIONS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => void handleUpdateNewWordsPerSession(value)}
              style={[
                styles.optionChip,
                profile?.newWordsPerSession === value && styles.optionChipActive,
              ]}
            >
              <Text
                style={[
                  styles.optionChipText,
                  profile?.newWordsPerSession === value && styles.optionChipTextActive,
                ]}
              >
                {value === 0 ? '0' : value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.customSettingRow}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setNewWordsDraft}
            placeholder="Власне число"
            placeholderTextColor="#6B7280"
            style={styles.customSettingInput}
            value={newWordsDraft}
          />
          <TouchableOpacity style={styles.customSettingButton} onPress={() => void handleApplyCustomNewWords()}>
            <Text style={styles.customSettingButtonText}>Застосувати</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Нові слова</Text>
        {newWords.length > 0 ? (
          newWords.map((word) => (
            <View key={word.id} style={styles.simpleRow}>
              <View style={styles.simpleRowContent}>
                <Text style={styles.simpleRowTitle}>{word.word}</Text>
                <Text style={styles.simpleRowText}>{word.translation}</Text>
              </View>
              {canManageWordEntry(word) ? (
                <View style={styles.inlineActions}>
                  <TouchableOpacity onPress={() => openWordEditor(word)} style={styles.inlineEditButton}>
                    <Text style={styles.inlineEditButtonText}>Редагувати</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void handleDeleteWord(word)} style={styles.inlineDeleteButton}>
                    <Text style={styles.inlineDeleteButtonText}>Видалити</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.simpleRowBadge}>З бази</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>Усі поточні слова вже активні. Можна додати свої або пройти курс.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Теми та слова всередині</Text>
        <Text style={styles.cardText}>
          Тут можна відкрити будь-яку наявну тему, подивитися її слова, редагувати свої записи або швидко додати нове слово саме в цю тему.
        </Text>
        {topicSummaries.length > 0 ? (
          topicSummaries.map((topic) => (
            <TouchableOpacity
              key={topic.topic}
              onPress={() => openTopicManager(topic.topic)}
              style={styles.topicCard}
            >
              <View style={styles.topicCardContent}>
                <Text style={styles.topicTitle}>{formatTopicLabel(topic.topic)}</Text>
                <Text style={styles.topicMeta}>
                  {topic.totalWords} слів · своїх для редагування: {topic.editableWords}
                </Text>
              </View>
              <Text style={styles.topicOpenLabel}>Відкрити</Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.cardText}>Поки що тем немає. Додай перше слово нижче.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Згенерувати колекцію (AI)</Text>
        <Text style={styles.cardText}>
          Введи тему, і AI автоматично підбере 10 цільових слів під твій рівень (наприклад: IT, travel, food).
        </Text>
        <TextInput
          editable={!isGeneratingWords}
          onChangeText={setDraftAiTopic}
          placeholder="Тема слів"
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={draftAiTopic}
        />
        <TouchableOpacity
          disabled={isGeneratingWords}
          onPress={() => void handleGenerateAiWords()}
          style={[styles.primaryButton, isGeneratingWords && { opacity: 0.7 }]}
        >
          <Text style={styles.primaryButtonText}>
            {isGeneratingWords ? 'Генерується...' : 'Згенерувати слова'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Імпорт зі стороннього AI</Text>
        <Text style={styles.cardText}>
          Згенеруйте список слів у ChatGPT/Claude, скопіювавши цей промпт (можна виділити і скопіювати):
        </Text>
        <Text selectable={true} style={[styles.cardText, { backgroundColor: '#1E1B4B', padding: 10, borderRadius: 8, marginTop: 4, marginBottom: 4, fontWeight: '600', color: '#DDD6FE' }]}>
          Згенеруй 15 англійських слів на тему [ТЕМА] для мого рівня. Поверни лише JSON-масив: [&#123;"word":"", "translation":"", "example":""&#125;] без зайвого тексту.
        </Text>
        <TextInput
          onChangeText={setImportTopic}
          placeholder="Назва теми (необов'язково)"
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={importTopic}
        />
        <TextInput
          multiline
          onChangeText={setImportJsonText}
          placeholder="Вставте JSON масив сюди..."
          placeholderTextColor="#6B7280"
          style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={importJsonText}
        />
        <TouchableOpacity
          onPress={() => void handleImportJson()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Імпортувати слова</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Додати своє слово</Text>
        {existingTopics.length > 0 ? (
          <>
            <Text style={styles.settingLabel}>Швидко додати в існуючу тему</Text>
            <View style={styles.topicChipRow}>
              {existingTopics.map((topic) => (
                <TouchableOpacity
                  key={topic}
                  onPress={() => setDraftTopic(topic)}
                  style={[
                    styles.topicChip,
                    draftTopic === topic && styles.topicChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.topicChipText,
                      draftTopic === topic && styles.topicChipTextActive,
                    ]}
                  >
                    {formatTopicLabel(topic)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
        <TextInput
          placeholder="Слово англійською"
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={draftWord}
          onChangeText={setDraftWord}
        />
        <TextInput
          placeholder="Переклад українською"
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={draftTranslation}
          onChangeText={setDraftTranslation}
        />
        <TextInput
          placeholder="Приклад речення"
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={draftExample}
          onChangeText={setDraftExample}
        />
        <TextInput
          placeholder="Тема, наприклад travel_vocabulary"
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={draftTopic}
          onChangeText={setDraftTopic}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleAddWord()}>
          <Text style={styles.primaryButtonText}>Зберегти слово</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Курси</Text>
        {courses.map((course) => {
          const completedCount = course.progress.completedLessonIds.length;
          const nextLesson = course.lessons.find(
            (lesson) => !course.progress.completedLessonIds.includes(lesson.id)
          );

          return (
            <View key={course.id} style={[styles.courseCard, { borderLeftColor: course.accentColor }]}>
              <Text style={styles.courseTitle}>{course.title}</Text>
              <Text style={styles.cardText}>{course.description}</Text>
              <Text style={styles.courseMeta}>
                {completedCount}/{course.lessons.length} уроків завершено
              </Text>
              {nextLesson ? <Text style={styles.courseMeta}>Далі: {nextLesson.title}</Text> : null}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.reviewButton}
                  onPress={() => void handleToggleCourse(course.id)}
                >
                  <Text style={styles.reviewButtonText}>
                    {course.progress.enrolled ? 'Вийти з курсу' : 'Почати курс'}
                  </Text>
                </TouchableOpacity>
                {course.progress.enrolled && nextLesson ? (
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => void handleCompleteNextLesson(course)}
                  >
                    <Text style={styles.reviewButtonText}>Завершити урок</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Улюблені слова</Text>
        {favoriteWords.length > 0 ? (
          favoriteWords.map((word) => (
            <View key={word.id} style={styles.simpleRow}>
              <View style={styles.simpleRowContent}>
                <Text style={styles.simpleRowTitle}>{word.word}</Text>
                <Text style={styles.simpleRowText}>{word.translation}</Text>
              </View>
              {canManageWordEntry(word) ? (
                <View style={styles.inlineActions}>
                  <TouchableOpacity onPress={() => openWordEditor(word)} style={styles.inlineEditButton}>
                    <Text style={styles.inlineEditButtonText}>Редагувати</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void handleDeleteWord(word)} style={styles.inlineDeleteButton}>
                    <Text style={styles.inlineDeleteButtonText}>Видалити</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.simpleRowBadge}>З бази</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>Поки що немає улюблених. Позначай їх з карток повторення.</Text>
        )}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={closeTopicManager}
        transparent
        visible={topicManagerVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.modalCardLarge]}>
            <Text style={styles.modalTitle}>Тема: {formatTopicLabel(managedTopic)}</Text>
            <Text style={styles.cardText}>
              У цій темі зараз {topicWords.length} слів. Свої слова можна редагувати, переносити між темами та видаляти.
            </Text>
            <ScrollView contentContainerStyle={styles.modalScrollContent} style={styles.modalScrollArea}>
              {topicWords.length > 0 ? (
                topicWords.map((word) => (
                  <View key={word.id} style={styles.topicWordRow}>
                    <View style={styles.simpleRowContent}>
                      <Text style={styles.simpleRowTitle}>{word.word}</Text>
                      <Text style={styles.simpleRowText}>{word.translation}</Text>
                      <Text style={styles.topicWordMeta}>
                        {getSourceLabel(word)} · {word.example}
                      </Text>
                    </View>
                    {canManageWordEntry(word) ? (
                      <View style={styles.inlineActions}>
                        <TouchableOpacity onPress={() => openWordEditor(word)} style={styles.inlineEditButton}>
                          <Text style={styles.inlineEditButtonText}>Редагувати</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => void handleDeleteWord(word)} style={styles.inlineDeleteButton}>
                          <Text style={styles.inlineDeleteButtonText}>Видалити</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.simpleRowBadge}>З бази</Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.cardText}>
                  У темі поки немає слів. Можна одразу додати нове слово нижче.
                </Text>
              )}
            </ScrollView>

            <View style={styles.topicQuickAddCard}>
              <Text style={styles.settingLabel}>Додати нове слово в цю тему</Text>
              <TextInput
                onChangeText={(value) => setTopicWordDraft((current) => ({ ...current, word: value }))}
                placeholder="Слово англійською"
                placeholderTextColor="#6B7280"
                style={styles.input}
                value={topicWordDraft.word}
              />
              <TextInput
                onChangeText={(value) =>
                  setTopicWordDraft((current) => ({ ...current, translation: value }))
                }
                placeholder="Переклад"
                placeholderTextColor="#6B7280"
                style={styles.input}
                value={topicWordDraft.translation}
              />
              <TextInput
                multiline
                onChangeText={(value) => setTopicWordDraft((current) => ({ ...current, example: value }))}
                placeholder="Приклад речення"
                placeholderTextColor="#6B7280"
                style={[styles.input, styles.inputTall]}
                value={topicWordDraft.example}
              />
              <TouchableOpacity onPress={() => void handleAddWordToManagedTopic()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Додати в тему</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={closeTopicManager} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Закрити тему</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeWordEditor}
        transparent
        visible={wordEditorVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Редагувати слово</Text>
            <TextInput
              onChangeText={(value) => setWordEditorDraft((current) => ({ ...current, word: value }))}
              placeholder="Слово англійською"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={wordEditorDraft.word}
            />
            <TextInput
              onChangeText={(value) =>
                setWordEditorDraft((current) => ({ ...current, translation: value }))
              }
              placeholder="Переклад"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={wordEditorDraft.translation}
            />
            <TextInput
              multiline
              onChangeText={(value) => setWordEditorDraft((current) => ({ ...current, example: value }))}
              placeholder="Приклад"
              placeholderTextColor="#6B7280"
              style={[styles.input, styles.inputTall]}
              value={wordEditorDraft.example}
            />
            <TextInput
              onChangeText={(value) => setWordEditorDraft((current) => ({ ...current, topic: value }))}
              placeholder="Тема"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={wordEditorDraft.topic}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeWordEditor} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleSaveWordEdit()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#030712',
    flex: 1,
  },
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 28,
  },
  hero: {
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: '#6366F1',
    borderRadius: 999,
    height: 180,
    opacity: 0.18,
    position: 'absolute',
    right: -30,
    top: -40,
    width: 180,
  },
  heroSurface: {
    backgroundColor: '#0D1526',
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 22,
  },
  eyebrow: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  heroBadge: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroBadgeLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroBadgeValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    backgroundColor: '#101826',
    borderColor: '#1D2A3F',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 16,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 17,
    fontWeight: '800',
  },
  cardText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#818CF8',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#030712',
    borderColor: '#374151',
    borderRadius: 14,
    borderWidth: 1,
    color: '#F9FAFB',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputTall: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  swipeStage: {
    minHeight: 260,
    justifyContent: 'center',
  },
  swipeBadge: {
    position: 'absolute',
    top: 14,
    zIndex: 2,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  swipeBadgeLeft: {
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    color: '#FCA5A5',
    left: 10,
  },
  swipeBadgeRight: {
    backgroundColor: '#0C2435',
    borderColor: '#0EA5E9',
    color: '#67E8F9',
    right: 10,
  },
  wordCard: {
    backgroundColor: '#0C1424',
    borderColor: '#23324A',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  wordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wordInfo: {
    flex: 1,
    gap: 4,
  },
  word: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  wordMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
  },
  translationBox: {
    backgroundColor: '#09111F',
    borderColor: '#22314B',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  translation: {
    color: '#C4B5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  wordExample: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  favorite: {
    color: '#FBBF24',
    fontSize: 22,
    fontWeight: '900',
  },
  queueHint: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewButton: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewButtonText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: '#0B1120',
    borderColor: '#0F766E',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editButtonText: {
    color: '#99F6E4',
    fontSize: 13,
    fontWeight: '700',
  },
  settingLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
  },
  optionChip: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: '#6366F1',
  },
  optionChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: '#818CF8',
  },
  customSettingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  customSettingInput: {
    backgroundColor: '#030712',
    borderColor: '#374151',
    borderRadius: 14,
    borderWidth: 1,
    color: '#F9FAFB',
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  customSettingButton: {
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  customSettingButtonText: {
    color: '#F5F3FF',
    fontSize: 13,
    fontWeight: '800',
  },
  courseCard: {
    backgroundColor: '#0F172A',
    borderLeftWidth: 4,
    borderRadius: 18,
    gap: 8,
    padding: 14,
  },
  courseTitle: {
    color: '#F9FAFB',
    fontSize: 17,
    fontWeight: '800',
  },
  courseMeta: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
  },
  topicCard: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  topicCardContent: {
    flex: 1,
    gap: 4,
  },
  topicTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '800',
  },
  topicMeta: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
  },
  topicOpenLabel: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '800',
  },
  topicChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  topicChipActive: {
    backgroundColor: '#0F1F34',
    borderColor: '#0EA5E9',
  },
  topicChipText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  topicChipTextActive: {
    color: '#67E8F9',
  },
  simpleRow: {
    alignItems: 'center',
    backgroundColor: '#0C1424',
    borderColor: '#22314B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  simpleRowContent: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  inlineActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  simpleRowBadge: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  simpleRowTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  simpleRowText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  inlineDeleteButton: {
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineDeleteButtonText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineEditButton: {
    backgroundColor: '#0B1120',
    borderColor: '#0F766E',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineEditButtonText: {
    color: '#99F6E4',
    fontSize: 12,
    fontWeight: '700',
  },
  readOnlyBadge: {
    backgroundColor: '#0F1F34',
    borderColor: '#1D4ED8',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyBadgeText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  modalCardLarge: {
    maxHeight: '92%',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
  },
  modalScrollArea: {
    maxHeight: 280,
  },
  modalScrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topicWordRow: {
    alignItems: 'center',
    backgroundColor: '#0C1424',
    borderColor: '#22314B',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  topicWordMeta: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  topicQuickAddCard: {
    backgroundColor: '#0C1424',
    borderColor: '#22314B',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  flashcardHeroButton: {
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderColor: '#4338CA',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 4,
  },
  flashcardHeroButtonText: {
    color: '#C4B5FD',
    fontSize: 15,
    fontWeight: '800',
  },
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 20,
  },
  swipeHintText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from '../utils/haptics';
import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

import {
  clearExerciseCache,
  deleteCachedExercise,
  getCachedExercises,
  importGrammarExercises,
  rateCachedExercise,
  toggleCachedExerciseFavorite,
  updateCachedExercise,
  type CachedExerciseRecord,
} from '../services/storage';
import type { AppRootParamList } from '../navigation/AppNavigator';
import type { Exercise } from '../types';

function getExerciseCategory(exercise: Exercise) {
  if (exercise.type.startsWith('listening_')) {
    return 'listening';
  }

  if (exercise.type === 'reading_comprehension') {
    return 'reading';
  }

  return exercise.category;
}

function getCategoryLabel(exercise: CachedExerciseRecord['exercise']) {
  const category = getExerciseCategory(exercise);

  if (category === 'vocabulary') {
    return 'Слова';
  }

  if (category === 'grammar') {
    return 'Граматика';
  }

  if (category === 'listening') {
    return 'Слух';
  }

  if (category === 'reading') {
    return 'Читання';
  }

  return 'Speaking';
}

function getPracticeFocusForExercise(exercise: Exercise) {
  if (exercise.type.startsWith('listening_')) {
    return 'listening' as const;
  }

  if (exercise.type === 'reading_comprehension') {
    return 'reading' as const;
  }

  return exercise.category;
}

type LibraryScreenProps = StackScreenProps<AppRootParamList, 'Library'>;

const FILTERS = [
  { key: 'all', label: 'Усе' },
  { key: 'favorites', label: 'Улюблені' },
  { key: 'vocabulary', label: 'Слова' },
  { key: 'grammar', label: 'Граматика' },
  { key: 'speaking', label: 'Speaking' },
  { key: 'listening', label: 'Слух' },
  { key: 'reading', label: 'Читання' },
] as const;

function createExerciseDraft(item: CachedExerciseRecord) {
  return {
    title: item.exercise.title,
    instruction: item.exercise.instruction,
    question: item.exercise.question,
    correctAnswer: item.exercise.correctAnswer,
    topic: item.exercise.topic,
    explanation: item.exercise.explanation ?? '',
    sampleAnswer: item.exercise.sampleAnswer ?? '',
    choicesText: (item.exercise.choices ?? []).join('\n'),
  };
}

export function LibraryScreen({ navigation }: LibraryScreenProps) {
  const isFocused = useIsFocused();
  const [cacheItems, setCacheItems] = useState<CachedExerciseRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [importTopic, setImportTopic] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CachedExerciseRecord | null>(null);
  const [editorDraft, setEditorDraft] = useState({
    title: '',
    instruction: '',
    question: '',
    correctAnswer: '',
    topic: '',
    explanation: '',
    sampleAnswer: '',
    choicesText: '',
  });

  useEffect(() => {
    let isActive = true;

    async function loadCache() {
      const items = await getCachedExercises();

      if (isActive) {
        setCacheItems(items);
      }
    }

    void loadCache();

    return () => {
      isActive = false;
    };
  }, [isFocused]);

  async function refreshCache() {
    const items = await getCachedExercises();
    setCacheItems(items);
  }

  async function handleClearCache() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Очистити кеш вправ?',
      'Це видалить лише збережені AI-вправи. Статистика, прогрес і сесії залишаться.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Очистити',
          style: 'destructive',
          onPress: async () => {
            await clearExerciseCache();
            await refreshCache();
          },
        },
      ]
    );
  }

  async function handleUseExercise(item: CachedExerciseRecord) {
    await Haptics.selectionAsync();
    (navigation as any).navigate('Tabs', {
      screen: 'Practice',
      params: {
        focus: getPracticeFocusForExercise(item.exercise),
        presetExercise: item.exercise,
      }
    });
  }

  async function handleToggleFavorite(item: CachedExerciseRecord) {
    await Haptics.selectionAsync();
    await toggleCachedExerciseFavorite(item.exercise);
    await refreshCache();
  }

  async function handleRate(item: CachedExerciseRecord, rating: -1 | 0 | 1) {
    await Haptics.selectionAsync();
    await rateCachedExercise(item.exercise, rating);
    await refreshCache();
  }

  async function handleDeleteExercise(item: CachedExerciseRecord) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Видалити завдання?',
      'Це прибере цю вправу з локальної бази, і вона більше не буде випадати в повторному використанні.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            await deleteCachedExercise(item.exercise);
            await refreshCache();
          },
        },
      ]
    );
  }

  function openEditor(item: CachedExerciseRecord) {
    setEditingItem(item);
    setEditorDraft(createExerciseDraft(item));
    setEditorVisible(true);
  }

  function closeEditor() {
    setEditingItem(null);
    setEditorVisible(false);
    setEditorDraft({
      title: '',
      instruction: '',
      question: '',
      correctAnswer: '',
      topic: '',
      explanation: '',
      sampleAnswer: '',
      choicesText: '',
    });
  }

  async function handleSaveExerciseEdit() {
    if (!editingItem) {
      return;
    }

    if (
      !editorDraft.title.trim() ||
      !editorDraft.instruction.trim() ||
      !editorDraft.question.trim() ||
      !editorDraft.correctAnswer.trim() ||
      !editorDraft.topic.trim()
    ) {
      Alert.alert('Не вистачає даних', 'Заповни заголовок, інструкцію, питання, відповідь і тему.');
      return;
    }

    const choices = editorDraft.choicesText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    if (editingItem.exercise.answerFormat === 'choice' && choices.length < 2) {
      Alert.alert('Замало варіантів', 'Для тесту додай хоча б 2 варіанти відповіді окремими рядками.');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateCachedExercise(editingItem.exercise, {
      title: editorDraft.title.trim(),
      instruction: editorDraft.instruction.trim(),
      question: editorDraft.question.trim(),
      correctAnswer: editorDraft.correctAnswer.trim(),
      topic: editorDraft.topic.trim(),
      explanation: editorDraft.explanation.trim() || undefined,
      sampleAnswer: editorDraft.sampleAnswer.trim() || undefined,
      choices: editingItem.exercise.answerFormat === 'choice' ? choices : undefined,
    });
    closeEditor();
    await refreshCache();
  }

  async function handleImportJson() {
    if (!importJsonText.trim()) {
      Alert.alert('Помилка', 'Вставте JSON текст для імпорту.');
      return;
    }

    try {
      await importGrammarExercises(importJsonText, importTopic);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Готово', 'Граматичні вправи успішно імпортовані!');
      setImportJsonText('');
      setImportTopic('');
      await refreshCache();
    } catch (e) {
      const errorStr = e instanceof Error ? e.message : 'Невідома помилка';
      Alert.alert('Помилка', errorStr);
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = cacheItems.filter((item) => {
    const categoryMatches =
      selectedFilter === 'all'
        ? true
        : selectedFilter === 'favorites'
          ? item.favorite
          : getExerciseCategory(item.exercise) === selectedFilter;
    const queryMatches =
      normalizedQuery.length === 0 ||
      item.exercise.title.toLowerCase().includes(normalizedQuery) ||
      item.exercise.question.toLowerCase().includes(normalizedQuery) ||
      item.exercise.topic.toLowerCase().includes(normalizedQuery);

    return categoryMatches && queryMatches;
  });

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Library</Text>
        <Text style={styles.title}>Збережені вправи</Text>
        <Text style={styles.subtitle}>
          Тут видно локальну базу вправ, які вже були згенеровані і можуть використовуватись повторно
          без нового запиту до AI.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>У кеші зараз</Text>
        <Text style={styles.summaryValue}>{cacheItems.length}</Text>
        <Text style={styles.summaryHint}>вправ у локальній базі</Text>
      </View>

      <View style={styles.filterCard}>
        <TextInput
          onChangeText={setSearchQuery}
          placeholder="Пошук за темою або текстом"
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
          value={searchQuery}
        />
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setSelectedFilter(filter.key)}
              style={[
                styles.filterChip,
                selectedFilter === filter.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === filter.key && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.clearButton} onPress={() => void handleClearCache()}>
        <Text style={styles.clearButtonText}>Очистити лише кеш вправ</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Імпорт зі стороннього AI</Text>
        <Text style={styles.subtitle}>
          Згенеруйте тести з граматики (наприклад, у ChatGPT) за цим промптом:
        </Text>
        <Text selectable={true} style={[styles.subtitle, { backgroundColor: '#1E1B4B', padding: 10, borderRadius: 8, marginTop: 4, marginBottom: 4, fontWeight: '600', color: '#DDD6FE' }]}>
          Згенеруй 10 тестів з англійської граматики на тему [ТЕМА] для мого рівня. Поверни лише JSON масив об'єктів без тексту: [&#123;"question":"He ___ an apple", "correctAnswer":"has", "choices":["have","has","had"]&#125;]
        </Text>
        <TextInput
          onChangeText={setImportTopic}
          placeholder="Назва теми (необов'язково)"
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
          value={importTopic}
        />
        <TextInput
          multiline
          onChangeText={setImportJsonText}
          placeholder="Вставте JSON масив сюди..."
          placeholderTextColor="#6B7280"
          style={[styles.searchInput, { minHeight: 100, textAlignVertical: 'top', marginTop: 8 }]}
          value={importJsonText}
        />
        <TouchableOpacity
          onPress={() => void handleImportJson()}
          style={styles.useButton}
        >
          <Text style={styles.useButtonText}>Імпортувати вправи</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <View key={`${item.exercise.id}-${item.createdAt}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.category}>{getCategoryLabel(item.exercise)}</Text>
                <View style={styles.headerActions}>
                  {item.favorite ? <Text style={styles.favoriteMark}>★</Text> : null}
                  <Text style={styles.topic}>{item.exercise.topic.replace(/_/g, ' ')}</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{item.exercise.title}</Text>
              <Text style={styles.cardQuestion}>{item.exercise.question}</Text>
              <Text style={styles.meta}>Тип: {item.exercise.type}</Text>
              <Text style={styles.meta}>Використано: {item.useCount} разів</Text>
              <Text style={styles.meta}>
                Оцінка: {item.userRating === 1 ? 'подобається' : item.userRating === -1 ? 'не дуже' : 'без оцінки'}
              </Text>
              <Text style={styles.meta}>
                Останній раз: {new Date(item.lastUsedAt).toLocaleString('uk-UA')}
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => void handleToggleFavorite(item)}
                  style={styles.preferenceButton}
                >
                  <Text style={styles.preferenceButtonText}>
                    {item.favorite ? 'Прибрати з улюблених' : 'В улюблені'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleRate(item, item.userRating === 1 ? 0 : 1)}
                  style={styles.preferenceButton}
                >
                  <Text style={styles.preferenceButtonText}>Подобається</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleRate(item, item.userRating === -1 ? 0 : -1)}
                  style={styles.preferenceButton}
                >
                  <Text style={styles.preferenceButtonText}>Не подобається</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openEditor(item)}
                  style={styles.preferenceButtonEdit}
                >
                  <Text style={styles.preferenceButtonText}>Редагувати</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleDeleteExercise(item)}
                  style={styles.preferenceButtonDanger}
                >
                  <Text style={styles.preferenceButtonText}>Видалити</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => void handleUseExercise(item)}
                style={styles.useButton}
              >
                <Text style={styles.useButtonText}>Використати цю вправу зараз</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Кеш поки порожній</Text>
            <Text style={styles.emptyText}>
              Коли AI згенерує нові вправи, вони збережуться тут і потім зможуть перевикористовуватись.
            </Text>
          </View>
        )}
      </View>

      <Modal animationType="slide" onRequestClose={closeEditor} transparent visible={editorVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Редагувати завдання</Text>
            <TextInput
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, title: value }))}
              placeholder="Заголовок"
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
              value={editorDraft.title}
            />
            <TextInput
              multiline
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, instruction: value }))}
              placeholder="Інструкція"
              placeholderTextColor="#6B7280"
              style={[styles.searchInput, styles.editorMultiline]}
              value={editorDraft.instruction}
            />
            <TextInput
              multiline
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, question: value }))}
              placeholder="Питання"
              placeholderTextColor="#6B7280"
              style={[styles.searchInput, styles.editorMultiline]}
              value={editorDraft.question}
            />
            <TextInput
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, correctAnswer: value }))}
              placeholder="Правильна відповідь"
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
              value={editorDraft.correctAnswer}
            />
            <TextInput
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, topic: value }))}
              placeholder="Тема"
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
              value={editorDraft.topic}
            />
            {editingItem?.exercise.answerFormat === 'choice' ? (
              <TextInput
                multiline
                onChangeText={(value) => setEditorDraft((current) => ({ ...current, choicesText: value }))}
                placeholder="Варіанти відповіді, кожен з нового рядка"
                placeholderTextColor="#6B7280"
                style={[styles.searchInput, styles.editorLarge]}
                value={editorDraft.choicesText}
              />
            ) : null}
            <TextInput
              multiline
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, explanation: value }))}
              placeholder="Пояснення"
              placeholderTextColor="#6B7280"
              style={[styles.searchInput, styles.editorMultiline]}
              value={editorDraft.explanation}
            />
            <TextInput
              multiline
              onChangeText={(value) => setEditorDraft((current) => ({ ...current, sampleAnswer: value }))}
              placeholder="Зразок відповіді"
              placeholderTextColor="#6B7280"
              style={[styles.searchInput, styles.editorMultiline]}
              value={editorDraft.sampleAnswer}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeEditor} style={styles.preferenceButton}>
                <Text style={styles.preferenceButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleSaveExerciseEdit()} style={styles.useButton}>
                <Text style={styles.useButtonText}>Зберегти</Text>
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
    gap: 20,
    padding: 20,
  },
  hero: {
    gap: 10,
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
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    gap: 6,
    padding: 20,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 34,
    fontWeight: '900',
  },
  summaryHint: {
    color: '#C4B5FD',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
  },
  clearButtonText: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '800',
  },
  filterCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    gap: 12,
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#030712',
    borderColor: '#374151',
    borderRadius: 14,
    borderWidth: 1,
    color: '#F9FAFB',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#1E1B4B',
    borderColor: '#7C3AED',
  },
  filterChipText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#F5F3FF',
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  category: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  favoriteMark: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '900',
  },
  topic: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  cardQuestion: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  preferenceButton: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preferenceButtonText: {
    color: '#DDD6FE',
    fontSize: 13,
    fontWeight: '700',
  },
  preferenceButtonEdit: {
    backgroundColor: '#0B1120',
    borderColor: '#0F766E',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preferenceButtonDanger: {
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  useButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    marginTop: 6,
    paddingVertical: 12,
  },
  useButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    gap: 10,
    padding: 18,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    maxHeight: '90%',
    padding: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editorMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  editorLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});

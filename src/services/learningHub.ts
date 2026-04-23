import AsyncStorage from '@react-native-async-storage/async-storage';

import { USER_LEVEL } from '../constants/config';
import { consumeFeatureUsage, ensureFeatureAvailable, getAccessStatus } from './access';
import { askAI } from './gemini';
import { getCachedExercises } from './storage';
import type {
  Badge,
  ChatMessage,
  Course,
  CourseProgress,
  CourseWithProgress,
  CourseWordSeed,
  DailyPlan,
  DailyPlanItem,
  LearningGoal,
  LearningProfile,
  PracticeFocus,
  ReviewOutcome,
  Session,
  UserProgress,
  WordEntry,
} from '../types';
import { formatLocalDateKey, formatLocalDateTime } from '../utils/date';

const PROFILE_KEY = 'langai:learning-profile';
const WORD_BANK_KEY = 'langai:word-bank';
const DELETED_WORD_IDS_KEY = 'langai:deleted-word-ids';
const COURSE_PROGRESS_KEY = 'langai:course-progress';
const DAILY_PLAN_KEY = 'langai:daily-plan';
const CHAT_HISTORY_KEY = 'langai:chat-history';

const REVIEW_INTERVALS = [0, 1, 3, 7, 14, 30, 45, 60, 90];
const EDITABLE_WORD_SOURCES = new Set<WordEntry['source']>(['manual', 'ai']);

const SEED_WORDS: Omit<WordEntry, 'id' | 'nextReviewDate' | 'lastReviewedAt'>[] = [
  {
    word: 'travel',
    translation: 'подорож',
    example: 'I love to travel in summer.',
    topic: 'travel_vocabulary',
    source: 'seed',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  },
  {
    word: 'neighbor',
    translation: 'сусід',
    example: 'My neighbor is very friendly.',
    topic: 'daily_vocabulary',
    source: 'seed',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  },
  {
    word: 'ticket',
    translation: 'квиток',
    example: 'I bought a ticket for the train.',
    topic: 'travel_vocabulary',
    source: 'seed',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  },
  {
    word: 'cheap',
    translation: 'дешевий',
    example: 'This bag is cheap but useful.',
    topic: 'shopping_vocabulary',
    source: 'seed',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  },
  {
    word: 'umbrella',
    translation: 'парасолька',
    example: 'Take an umbrella with you.',
    topic: 'daily_vocabulary',
    source: 'seed',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  },
  {
    word: 'interview',
    translation: 'співбесіда',
    example: 'I have an interview on Monday.',
    topic: 'work_vocabulary',
    source: 'seed',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  },
];

const COURSE_LIBRARY: Course[] = [
  {
    id: 'travel-starter',
    title: 'Travel Starter',
    description: 'Базові слова та ситуації для подорожей.',
    goal: 'travel',
    focus: 'vocabulary',
    accentColor: '#0F766E',
    lessons: [
      {
        id: 'travel-words',
        title: 'Слова для дороги',
        description: 'Airport, ticket, hotel, luggage.',
        focus: 'vocabulary',
        topic: 'travel_vocabulary',
        keywords: [
          { word: 'airport', translation: 'аеропорт', example: 'The airport is very busy today.' },
          { word: 'ticket', translation: 'квиток', example: 'I bought a ticket for the train.' },
          { word: 'hotel', translation: 'готель', example: 'Our hotel is near the beach.' },
          { word: 'luggage', translation: 'багаж', example: 'My luggage is too heavy.' },
        ],
      },
      {
        id: 'travel-questions',
        title: 'Поставити питання',
        description: 'Як запитати дорогу або допомогу.',
        focus: 'speaking',
        topic: 'travel_speaking',
        keywords: [
          { word: 'station', translation: 'станція', example: 'Where is the bus station?' },
          { word: 'passport', translation: 'паспорт', example: 'Show your passport, please.' },
          { word: 'taxi', translation: 'таксі', example: 'We need a taxi to the hotel.' },
          { word: 'map', translation: 'карта', example: 'Can you show me the map?' },
        ],
      },
    ],
  },
  {
    id: 'job-english',
    title: 'Job English',
    description: 'Підготовка до роботи та співбесіди.',
    goal: 'work',
    focus: 'mixed',
    accentColor: '#7C2D12',
    lessons: [
      {
        id: 'job-vocabulary',
        title: 'Слова для офісу',
        description: 'Team, deadline, meeting, project.',
        focus: 'vocabulary',
        topic: 'work_vocabulary',
        keywords: [
          { word: 'meeting', translation: 'зустріч', example: 'We have a team meeting at noon.' },
          { word: 'deadline', translation: 'дедлайн', example: 'The deadline is next Friday.' },
          { word: 'project', translation: 'проєкт', example: 'This project is very important.' },
          { word: 'salary', translation: 'зарплата', example: 'She is happy with her salary.' },
        ],
      },
      {
        id: 'job-speaking',
        title: 'Представити себе',
        description: 'Коротко розказати про свій досвід.',
        focus: 'speaking',
        topic: 'interview_speaking',
        keywords: [
          { word: 'experience', translation: 'досвід', example: 'I have three years of experience.' },
          { word: 'skills', translation: 'навички', example: 'My skills include communication and planning.' },
          { word: 'role', translation: 'роль', example: 'This role fits my background well.' },
          { word: 'team', translation: 'команда', example: 'I enjoy working in a team.' },
        ],
      },
    ],
  },
  {
    id: 'daily-talk',
    title: 'Daily Talk',
    description: 'Повсякденне спілкування на прості теми.',
    goal: 'daily_communication',
    focus: 'speaking',
    accentColor: '#1D4ED8',
    lessons: [
      {
        id: 'daily-routine',
        title: 'Про свій день',
        description: 'Morning routine, plans, hobbies.',
        focus: 'speaking',
        topic: 'daily_routine_speaking',
        keywords: [
          { word: 'breakfast', translation: 'сніданок', example: 'I make breakfast at seven.' },
          { word: 'work', translation: 'робота', example: 'I start work at nine o’clock.' },
          { word: 'walk', translation: 'прогулянка', example: 'I take a walk in the evening.' },
          { word: 'evening', translation: 'вечір', example: 'My evening is usually quiet.' },
        ],
      },
      {
        id: 'shopping-small-talk',
        title: 'У магазині',
        description: 'Як попросити розмір або уточнити ціну.',
        focus: 'speaking',
        topic: 'shopping_dialogue',
        keywords: [
          { word: 'size', translation: 'розмір', example: 'Do you have this in my size?' },
          { word: 'price', translation: 'ціна', example: 'What is the price of this jacket?' },
          { word: 'cash', translation: 'готівка', example: 'Can I pay in cash?' },
          { word: 'receipt', translation: 'чек', example: 'Could I have the receipt, please?' },
        ],
      },
    ],
  },
  {
    id: 'grammar-boost',
    title: 'Grammar Boost',
    description: 'Стисле прокачування ключової граматики.',
    goal: 'interview',
    focus: 'grammar',
    accentColor: '#6D28D9',
    lessons: [
      {
        id: 'grammar-times',
        title: 'Часи в дії',
        description: 'Present Simple, Present Perfect, Past Simple.',
        focus: 'grammar',
        topic: 'present_simple',
        keywords: [
          { word: 'always', translation: 'завжди', example: 'She always drinks tea in the morning.' },
          { word: 'already', translation: 'вже', example: 'I have already finished my homework.' },
          { word: 'yesterday', translation: 'вчора', example: 'We met yesterday after work.' },
          { word: 'usually', translation: 'зазвичай', example: 'They usually go home by bus.' },
        ],
      },
      {
        id: 'grammar-articles',
        title: 'Артиклі без болю',
        description: 'A, an, the у реальних фразах.',
        focus: 'grammar',
        topic: 'articles',
        keywords: [
          { word: 'a', translation: 'неозначений артикль a', example: 'She has a car.' },
          { word: 'an', translation: 'неозначений артикль an', example: 'He ate an apple.' },
          { word: 'the', translation: 'означений артикль the', example: 'The sun is shining.' },
          { word: 'article', translation: 'артикль', example: 'Choose the correct article.' },
        ],
      },
    ],
  },
];

export const defaultLearningProfile: LearningProfile = {
  level: USER_LEVEL,
  goal: 'daily_communication',
  dailyMinutes: 15,
  preferredFocus: 'mixed',
  reviewBatchSize: 10,
  newWordsPerSession: 3,
  remindersEnabled: false,
  reminderHour: 19,
  reminderMinute: 0,
};

function getCourseWordLookupKey(topic: string, word: string) {
  return `${topic.trim().toLowerCase()}::${normalizeWord(word)}`;
}

const COURSE_WORD_LOOKUP = new Map<string, CourseWordSeed>(
  COURSE_LIBRARY.flatMap((course) =>
    course.lessons.flatMap((lesson) =>
      lesson.keywords.map((keyword) => [getCourseWordLookupKey(lesson.topic, keyword.word), keyword] as const)
    )
  )
);

function normalizeProfile(profile: Partial<LearningProfile> | null | undefined): LearningProfile {
  return {
    ...defaultLearningProfile,
    ...(profile ?? {}),
    reviewBatchSize: clamp(
      typeof profile?.reviewBatchSize === 'number'
        ? Math.round(profile.reviewBatchSize)
        : defaultLearningProfile.reviewBatchSize,
      1,
      200
    ),
    newWordsPerSession: clamp(
      typeof profile?.newWordsPerSession === 'number'
        ? Math.round(profile.newWordsPerSession)
        : defaultLearningProfile.newWordsPerSession,
      0,
      100
    ),
  };
}

function normalizeWord(value: string) {
  return value.trim().toLowerCase();
}

function syncCourseWordsWithLibrary(words: WordEntry[]) {
  let hasChanges = false;

  const nextWords = words.map((word) => {
    if (word.source !== 'course') {
      return word;
    }

    const courseWord = COURSE_WORD_LOOKUP.get(getCourseWordLookupKey(word.topic, word.word));

    if (!courseWord) {
      return word;
    }

    const nextExample = courseWord.example?.trim() || `${courseWord.word} - ${courseWord.translation}`;

    if (word.translation === courseWord.translation && word.example === nextExample) {
      return word;
    }

    hasChanges = true;

    return {
      ...word,
      translation: courseWord.translation,
      example: nextExample,
    };
  });

  return { hasChanges, nextWords };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDateKey(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBaseIntervalByStage(stage: number) {
  return REVIEW_INTERVALS[clamp(stage, 0, REVIEW_INTERVALS.length - 1)];
}

function getNextReviewDays(word: WordEntry, outcome: ReviewOutcome) {
  if (outcome === 'again') {
    return 0;
  }

  if (outcome === 'hard') {
    const nextStage = Math.min(REVIEW_INTERVALS.length - 1, Math.max(1, word.stage + 1));
    const baseInterval = getBaseIntervalByStage(nextStage);

    return Math.max(1, Math.round(baseInterval * clamp(word.easeScore * 0.7, 0.6, 1.1)));
  }

  if (outcome === 'easy') {
    const nextStage = Math.min(REVIEW_INTERVALS.length - 1, word.stage + 2);
    const baseInterval = getBaseIntervalByStage(nextStage);

    return Math.max(2, Math.round(baseInterval * clamp(word.easeScore + 0.35, 1.25, 2.4)));
  }

  const nextStage = Math.min(REVIEW_INTERVALS.length - 1, word.stage + 1);
  const baseInterval = getBaseIntervalByStage(nextStage);

  return Math.max(1, Math.round(baseInterval * clamp(word.easeScore, 0.9, 2.1)));
}

function getNextEaseScore(word: WordEntry, outcome: ReviewOutcome) {
  if (outcome === 'again') {
    return clamp(word.easeScore - 0.35, 1, 5);
  }

  if (outcome === 'hard') {
    return clamp(word.easeScore - 0.1, 1, 5);
  }

  if (outcome === 'easy') {
    return clamp(word.easeScore + 0.35, 1, 5);
  }

  return clamp(word.easeScore + 0.15, 1, 5);
}

function getNextStage(word: WordEntry, outcome: ReviewOutcome) {
  if (outcome === 'again') {
    return 0;
  }

  if (outcome === 'hard') {
    return Math.min(REVIEW_INTERVALS.length - 1, Math.max(1, word.stage + 1));
  }

  if (outcome === 'easy') {
    return Math.min(REVIEW_INTERVALS.length - 1, word.stage + 2);
  }

  return Math.min(REVIEW_INTERVALS.length - 1, word.stage + 1);
}

function createWordId(word: string, topic: string) {
  return `${normalizeWord(word)}::${topic.trim().toLowerCase()}`;
}

function hasCyrillic(value: string) {
  return /[А-Яа-яЇїІіЄєҐґ]/.test(value);
}

function createWordEntry(
  seed: Omit<WordEntry, 'id' | 'nextReviewDate' | 'lastReviewedAt'>
): WordEntry {
  const today = formatLocalDateKey();

  return {
    ...seed,
    id: createWordId(seed.word, seed.topic),
    nextReviewDate: today,
    lastReviewedAt: '',
  };
}

function isWordEntry(value: unknown): value is WordEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as WordEntry;
  return (
    typeof item.id === 'string' &&
    typeof item.word === 'string' &&
    typeof item.translation === 'string' &&
    typeof item.topic === 'string' &&
    typeof item.nextReviewDate === 'string'
  );
}

function isDailyPlan(value: unknown): value is DailyPlan {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const plan = value as DailyPlan;
  return typeof plan.date === 'string' && Array.isArray(plan.items);
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getLearningProfile(): Promise<LearningProfile> {
  const stored = await readJson<Partial<LearningProfile> | null>(PROFILE_KEY, null);
  return normalizeProfile(stored);
}

export async function saveLearningProfile(profile: LearningProfile): Promise<void> {
  await saveJson(PROFILE_KEY, profile);
}

export async function updateLearningProfile(
  partial: Partial<LearningProfile>
): Promise<LearningProfile> {
  const current = await getLearningProfile();
  const next = normalizeProfile({
    ...current,
    ...partial,
  });

  await saveLearningProfile(next);
  return next;
}

async function saveWordBank(words: WordEntry[]) {
  await saveJson(WORD_BANK_KEY, words);
}

async function readDeletedWordIds(): Promise<string[]> {
  const stored = await readJson<unknown[]>(DELETED_WORD_IDS_KEY, []);
  return stored.filter((value): value is string => typeof value === 'string');
}

async function saveDeletedWordIds(ids: string[]) {
  await saveJson(DELETED_WORD_IDS_KEY, Array.from(new Set(ids)));
}

async function readWordBank(): Promise<WordEntry[]> {
  const stored = await readJson<unknown[]>(WORD_BANK_KEY, []);
  return stored.filter(isWordEntry);
}

function buildWordsFromCacheEntry(question: string, correctAnswer: string, topic: string): WordEntry | null {
  const answer = correctAnswer.trim();

  if (!answer || answer.includes(' ')) {
    return null;
  }

  const quoted = question.match(/"([^"]+)"/)?.[1]?.trim() ?? '';
  const answerLooksUa = hasCyrillic(answer);
  const quotedLooksUa = hasCyrillic(quoted);
  const word = answerLooksUa && !quotedLooksUa && quoted ? quoted : answer;
  const translation =
    answerLooksUa && !quotedLooksUa && quoted
      ? answer
      : quoted || topic.replace(/_/g, ' ');

  return createWordEntry({
    word,
    translation,
    example: `${word} - ${translation}`,
    topic,
    source: 'cache',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  });
}

export async function ensureWordBankReady(): Promise<WordEntry[]> {
  const existing = await readWordBank();

  if (existing.length === 0) {
    const seeded = SEED_WORDS.map(createWordEntry);
    await saveWordBank(seeded);
    return seeded;
  }

  const { hasChanges, nextWords } = syncCourseWordsWithLibrary(existing);

  if (hasChanges) {
    await saveWordBank(nextWords);
    return nextWords;
  }

  return existing;
}

export async function syncWordsFromExerciseCache(): Promise<WordEntry[]> {
  const [words, cache, deletedWordIds] = await Promise.all([
    ensureWordBankReady(),
    getCachedExercises(),
    readDeletedWordIds(),
  ]);
  const byId = new Map(words.map((word) => [word.id, word]));
  const deletedSet = new Set(deletedWordIds);

  for (const item of cache) {
    if (item.exercise.category !== 'vocabulary') {
      continue;
    }

    const nextWord = buildWordsFromCacheEntry(
      item.exercise.question,
      item.exercise.correctAnswer,
      item.exercise.topic
    );

    if (!nextWord || byId.has(nextWord.id) || deletedSet.has(nextWord.id)) {
      continue;
    }

    byId.set(nextWord.id, nextWord);
  }

  const nextWords = [...byId.values()];
  await saveWordBank(nextWords);
  return nextWords;
}

export async function getWordBank(): Promise<WordEntry[]> {
  return syncWordsFromExerciseCache();
}

export async function addCustomWord(input: {
  word: string;
  translation: string;
  example: string;
  topic: string;
}): Promise<WordEntry[]> {
  const words = await ensureWordBankReady();
  const topic = input.topic.trim() || 'custom_words';
  const nextWord = createWordEntry({
    word: input.word.trim(),
    translation: input.translation.trim(),
    example: input.example.trim() || `${input.word.trim()} - ${input.translation.trim()}`,
    topic,
    source: 'manual',
    stage: 0,
    repetitions: 0,
    easeScore: 1,
    favorite: false,
    mastered: false,
    incorrectCount: 0,
  });

  const byId = new Map(words.map((word) => [word.id, word]));
  byId.set(nextWord.id, nextWord);
  const nextWords = [...byId.values()];
  await saveWordBank(nextWords);
  return nextWords;
}

export function canManageWordEntry(word: Pick<WordEntry, 'source'>): boolean {
  return EDITABLE_WORD_SOURCES.has(word.source);
}

export async function updateWord(
  wordId: string,
  updates: Pick<WordEntry, 'word' | 'translation' | 'example' | 'topic'>
): Promise<WordEntry[]> {
  const words = await ensureWordBankReady();
  const targetWord = words.find((word) => word.id === wordId);

  if (!targetWord) {
    return words;
  }

  if (!canManageWordEntry(targetWord)) {
    throw new Error('Слова з бази не можна редагувати.');
  }

  const nextWord = updates.word.trim();
  const nextTranslation = updates.translation.trim();
  const nextTopic = updates.topic.trim();
  const nextExample = updates.example.trim() || `${nextWord} - ${nextTranslation}`;
  const nextId = createWordId(nextWord, nextTopic);

  const duplicate = words.find((word) => word.id === nextId && word.id !== wordId);

  if (duplicate) {
    throw new Error('У цій темі вже є таке слово. Виберіть іншу назву або тему.');
  }

  const nextWords = words
    .filter((word) => word.id !== wordId)
    .concat({
      ...targetWord,
      id: nextId,
      word: nextWord,
      translation: nextTranslation,
      example: nextExample,
      topic: nextTopic,
    });

  await saveWordBank(nextWords);
  return nextWords;
}

export async function generateAIWordCollection(
  topic: string,
  profile: LearningProfile
): Promise<WordEntry[]> {
  const prompt = `You are an English vocabulary builder for a Ukrainian-speaking learner.
Student level: ${profile.level}
Student goal: ${profile.goal}
Topic: ${topic}

Generate 10 words or short phrases in English strictly related to this topic, appropriate for the student's level.
Return ONLY a valid JSON array of objects with an exact structure like this:
[
  { "word": "english word", "translation": "ukrainian translation", "example": "short english example sentence" }
]
Do not include any markdown, backticks, or other text.`;

  const rawResponse = await askAI(prompt);
  const cleanResponse = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  let parsed: Array<{ word: string; translation: string; example: string }> = [];
  try {
    parsed = JSON.parse(cleanResponse);
    if (!Array.isArray(parsed)) {
      parsed = [];
    }
  } catch (error) {
    throw new Error('Не вдалося згенерувати слова. Спробуйте ще раз або змініть тему.');
  }

  const words = await ensureWordBankReady();
  const byId = new Map(words.map((word) => [word.id, word]));

  for (const item of parsed) {
    if (!item.word || !item.translation) continue;
    const wordKey = item.word.trim();
    const nextWord = createWordEntry({
      word: wordKey,
      translation: item.translation.trim(),
      example: item.example?.trim() || `${wordKey} - ${item.translation.trim()}`,
      topic,
      source: 'ai',
      stage: 0,
      repetitions: 0,
      easeScore: 1,
      favorite: false,
      mastered: false,
      incorrectCount: 0,
    });
    byId.set(nextWord.id, nextWord);
  }

  const nextWords = [...byId.values()];
  await saveWordBank(nextWords);
  return nextWords;
}

export async function importWordCollection(
  jsonText: string,
  topic: string
): Promise<WordEntry[]> {
  const cleanResponse = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  let parsed: Array<{ word?: string; translation?: string; example?: string }> = [];
  try {
    parsed = JSON.parse(cleanResponse);
    if (!Array.isArray(parsed)) {
      throw new Error('Очікується JSON масив.');
    }
  } catch (error) {
    throw new Error('Неправильний формат JSON. Переконайтеся, що ви вставили правильний масив.');
  }

  const words = await ensureWordBankReady();
  const byId = new Map(words.map((word) => [word.id, word]));
  let addedCount = 0;

  for (const item of parsed) {
    if (!item.word || !item.translation) continue;
    
    const wordKey = item.word.trim();
    if (!wordKey) continue;

    const nextWord = createWordEntry({
      word: wordKey,
      translation: item.translation.trim(),
      example: item.example?.trim() || `${wordKey} - ${item.translation.trim()}`,
      topic: topic.trim() || 'imported_words',
      source: 'manual',
      stage: 0,
      repetitions: 0,
      easeScore: 1,
      favorite: false,
      mastered: false,
      incorrectCount: 0,
    });
    
    if (!byId.has(nextWord.id)) {
      byId.set(nextWord.id, nextWord);
      addedCount++;
    }
  }

  if (addedCount === 0) {
    throw new Error('Не знайдено жодного нового слова у вашому тексті. Перевірте формат: [{"word":"", "translation":""}].');
  }

  const nextWords = [...byId.values()];
  await saveWordBank(nextWords);
  return nextWords;
}

export async function toggleWordFavorite(wordId: string): Promise<WordEntry[]> {
  const words = await ensureWordBankReady();
  const nextWords = words.map((word) =>
    word.id === wordId ? { ...word, favorite: !word.favorite } : word
  );

  await saveWordBank(nextWords);
  return nextWords;
}

export async function deleteWord(wordId: string): Promise<WordEntry[]> {
  const [words, deletedWordIds] = await Promise.all([ensureWordBankReady(), readDeletedWordIds()]);
  const targetWord = words.find((word) => word.id === wordId);

  if (!targetWord) {
    return words;
  }

  if (!canManageWordEntry(targetWord)) {
    throw new Error('Слова з бази не можна видаляти.');
  }

  const nextWords = words.filter((word) => word.id !== wordId);

  await Promise.all([saveWordBank(nextWords), saveDeletedWordIds([...deletedWordIds, wordId])]);

  return nextWords;
}

export async function reviewWord(wordId: string, outcome: ReviewOutcome): Promise<WordEntry[]> {
  const words = await ensureWordBankReady();
  const targetWord = words.find((word) => word.id === wordId);

  if (!targetWord) {
    return words;
  }

  await ensureFeatureAvailable('wordReviews');
  const today = formatLocalDateKey();
  const nextWords = words.map((word) => {
    if (word.id !== wordId) {
      return word;
    }

    if (outcome === 'again') {
      return {
        ...word,
        stage: getNextStage(word, outcome),
        repetitions: Math.max(0, word.repetitions - 1),
        nextReviewDate: today,
        lastReviewedAt: formatLocalDateTime(),
        easeScore: getNextEaseScore(word, outcome),
        incorrectCount: word.incorrectCount + 1,
        mastered: false,
      };
    }

    const nextStage = getNextStage(word, outcome);
    const nextReviewDays = getNextReviewDays(word, outcome);

    return {
      ...word,
      stage: nextStage,
      repetitions: word.repetitions + 1,
      nextReviewDate: addDays(today, nextReviewDays),
      lastReviewedAt: formatLocalDateTime(),
      easeScore: getNextEaseScore(word, outcome),
      incorrectCount: outcome === 'hard' ? word.incorrectCount + 1 : Math.max(0, word.incorrectCount - 1),
      mastered: nextStage >= 5,
    };
  });

  await saveWordBank(nextWords);
  await consumeFeatureUsage('wordReviews');
  return nextWords;
}

export async function getDueWords(limit = 8): Promise<WordEntry[]> {
  const today = formatLocalDateKey();
  const words = await getWordBank();

  return [...words]
    .filter((word) => word.repetitions > 0 && word.nextReviewDate <= today)
    .sort((left, right) => {
      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }

      if (left.incorrectCount !== right.incorrectCount) {
        return right.incorrectCount - left.incorrectCount;
      }

      if (left.stage !== right.stage) {
        return left.stage - right.stage;
      }

      return left.nextReviewDate.localeCompare(right.nextReviewDate);
    })
    .slice(0, limit);
}

export async function getNewWords(limit = 8): Promise<WordEntry[]> {
  const words = await getWordBank();
  return words
    .filter((word) => word.repetitions === 0)
    .sort((left, right) => {
      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }

      return left.word.localeCompare(right.word);
    })
    .slice(0, limit);
}

function interleaveWordQueue(reviewWords: WordEntry[], newWords: WordEntry[]) {
  const reviewQueue = [...reviewWords];
  const newQueue = [...newWords];
  const combined: WordEntry[] = [];

  while (reviewQueue.length > 0 || newQueue.length > 0) {
    if (reviewQueue.length > 0) {
      combined.push(reviewQueue.shift() as WordEntry);
    }

    if (reviewQueue.length > 0) {
      combined.push(reviewQueue.shift() as WordEntry);
    }

    if (newQueue.length > 0) {
      combined.push(newQueue.shift() as WordEntry);
    }
  }

  return combined;
}

export async function getStudyQueue(profile?: LearningProfile): Promise<WordEntry[]> {
  const activeProfile = profile ?? (await getLearningProfile());
  const [reviewWords, newWords] = await Promise.all([
    getDueWords(activeProfile.reviewBatchSize),
    getNewWords(activeProfile.newWordsPerSession),
  ]);
  const accessStatus = await getAccessStatus();
  const queue = interleaveWordQueue(reviewWords, newWords);

  if (accessStatus.tier === 'vip') {
    return queue;
  }

  return queue.slice(0, accessStatus.remaining.wordReviews ?? 0);
}

export async function getWordStats() {
  const words = await getWordBank();
  const today = formatLocalDateKey();

  return {
    total: words.length,
    favorites: words.filter((word) => word.favorite).length,
    mastered: words.filter((word) => word.mastered).length,
    due: words.filter((word) => word.repetitions > 0 && word.nextReviewDate <= today).length,
    newWords: words.filter((word) => word.repetitions === 0).length,
  };
}

async function readCourseProgressMap(): Promise<Record<string, CourseProgress>> {
  return readJson<Record<string, CourseProgress>>(COURSE_PROGRESS_KEY, {});
}

async function saveCourseProgressMap(value: Record<string, CourseProgress>) {
  await saveJson(COURSE_PROGRESS_KEY, value);
}

export async function getCoursesWithProgress(): Promise<CourseWithProgress[]> {
  const progressMap = await readCourseProgressMap();

  return COURSE_LIBRARY.map((course) => ({
    ...course,
    progress: progressMap[course.id] ?? { enrolled: false, completedLessonIds: [] },
  }));
}

export async function toggleCourseEnrollment(courseId: string): Promise<CourseWithProgress[]> {
  const progressMap = await readCourseProgressMap();
  const current = progressMap[courseId] ?? { enrolled: false, completedLessonIds: [] };

  progressMap[courseId] = {
    ...current,
    enrolled: !current.enrolled,
  };

  await saveCourseProgressMap(progressMap);
  return getCoursesWithProgress();
}

export async function completeCourseLesson(courseId: string, lessonId: string): Promise<CourseWithProgress[]> {
  const progressMap = await readCourseProgressMap();
  const current = progressMap[courseId] ?? { enrolled: true, completedLessonIds: [] };
  progressMap[courseId] = {
    enrolled: true,
    completedLessonIds: Array.from(new Set([...current.completedLessonIds, lessonId])),
  };

  await saveCourseProgressMap(progressMap);

  const course = COURSE_LIBRARY.find((item) => item.id === courseId);
  const lesson = course?.lessons.find((item) => item.id === lessonId);

  if (lesson) {
    const words = await ensureWordBankReady();
    const byId = new Map(words.map((word) => [word.id, word]));

    for (const keyword of lesson.keywords) {
      const nextWord = createWordEntry({
        word: keyword.word,
        translation: keyword.translation,
        example: keyword.example?.trim() || `${keyword.word} - ${keyword.translation}`,
        topic: lesson.topic,
        source: 'course',
        stage: 0,
        repetitions: 0,
        easeScore: 1,
        favorite: false,
        mastered: false,
        incorrectCount: 0,
      });

      const existingWord = byId.get(nextWord.id);

      if (!existingWord) {
        byId.set(nextWord.id, nextWord);
        continue;
      }

      if (existingWord.source === 'course') {
        byId.set(nextWord.id, {
          ...existingWord,
          translation: nextWord.translation,
          example: nextWord.example,
          source: 'course',
        });
      }
    }

    await saveWordBank([...byId.values()]);
  }

  return getCoursesWithProgress();
}

async function saveDailyPlan(plan: DailyPlan) {
  await saveJson(DAILY_PLAN_KEY, plan);
}

function buildPlanItems(
  profile: LearningProfile,
  progress: UserProgress,
  dueWords: number,
  newWords: number
): DailyPlanItem[] {
  const items: DailyPlanItem[] = [];
  const wordsTarget = profile.reviewBatchSize;
  const newWordsTarget = profile.newWordsPerSession;
  const practiceTarget = profile.dailyMinutes >= 20 ? 4 : 3;
  const speakingTarget = profile.dailyMinutes >= 20 ? 3 : 2;

  if (dueWords > 0) {
    items.push({
      id: 'review-words',
      type: 'review_words',
      title: 'Повторити слова',
      description: `На сьогодні є ${dueWords} слів на повторення.`,
      target: Math.min(dueWords, wordsTarget),
      completed: false,
      focus: 'vocabulary',
    });
  }

  if (newWords > 0 && newWordsTarget > 0) {
    items.push({
      id: 'new-words',
      type: 'new_words',
      title: 'Вивчити нові слова',
      description: 'Додай нові слова до активного словника.',
      target: Math.min(newWords, newWordsTarget),
      completed: false,
      focus: 'vocabulary',
    });
  }

  items.push({
    id: 'grammar-practice',
    type: 'grammar',
    title: 'Граматика',
    description: 'Закріпити одну граматичну тему.',
    target: practiceTarget,
    completed: false,
    focus: 'grammar',
  });

  items.push({
    id: 'speaking-practice',
    type: 'speaking',
    title: 'Speaking',
    description: 'Сказати або написати 2-3 короткі відповіді англійською.',
    target: speakingTarget,
    completed: false,
    focus: 'speaking',
  });

  if (progress.weakTopics.length > 0) {
    items.push({
      id: 'mistake-repeat',
      type: 'mistakes',
      title: 'Повторити помилки',
      description: `Пройдися по слабких темах: ${progress.weakTopics.slice(0, 2).join(', ')}.`,
      target: 2,
      completed: false,
      focus: profile.preferredFocus === 'mixed' ? undefined : profile.preferredFocus,
    });
  }

  items.push({
    id: 'ai-chat',
    type: 'chat',
    title: 'AI-чат',
    description: 'Короткий діалог англійською під твій рівень.',
    target: 1,
    completed: false,
  });

  return items;
}

export async function getDailyPlan(progress: UserProgress): Promise<DailyPlan> {
  const today = formatLocalDateKey();
  const stored = await readJson<DailyPlan | null>(DAILY_PLAN_KEY, null);

  if (stored && isDailyPlan(stored) && stored.date === today) {
    return stored;
  }

  const [profile, wordStats] = await Promise.all([getLearningProfile(), getWordStats()]);
  const plan: DailyPlan = {
    date: today,
    items: buildPlanItems(profile, progress, wordStats.due, wordStats.newWords),
  };

  await saveDailyPlan(plan);
  return plan;
}

export async function toggleDailyPlanItem(itemId: string): Promise<DailyPlan | null> {
  const stored = await readJson<DailyPlan | null>(DAILY_PLAN_KEY, null);

  if (!stored || !isDailyPlan(stored)) {
    return null;
  }

  const nextPlan: DailyPlan = {
    ...stored,
    items: stored.items.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ),
  };

  await saveDailyPlan(nextPlan);
  return nextPlan;
}

export async function markDailyPlanItemsCompleted(itemIds: string[]): Promise<DailyPlan | null> {
  const stored = await readJson<DailyPlan | null>(DAILY_PLAN_KEY, null);

  if (!stored || !isDailyPlan(stored)) {
    return null;
  }

  const completedIds = new Set(itemIds);
  const nextPlan: DailyPlan = {
    ...stored,
    items: stored.items.map((item) =>
      completedIds.has(item.id) ? { ...item, completed: true } : item
    ),
  };

  await saveDailyPlan(nextPlan);
  return nextPlan;
}

export async function getReminderLabel(): Promise<string> {
  const profile = await getLearningProfile();
  const time = `${`${profile.reminderHour}`.padStart(2, '0')}:${`${profile.reminderMinute}`.padStart(2, '0')}`;

  return profile.remindersEnabled
    ? `Нагадування збережене на ${time}`
    : 'Нагадування поки вимкнені';
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  return readJson<ChatMessage[]>(CHAT_HISTORY_KEY, []);
}

async function saveChatHistory(messages: ChatMessage[]) {
  await saveJson(CHAT_HISTORY_KEY, messages.slice(-20));
}

export async function clearChatHistory() {
  await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
}

export async function resetLearningHubData(options?: { includeProfile?: boolean }): Promise<void> {
  const keys = [WORD_BANK_KEY, DELETED_WORD_IDS_KEY, COURSE_PROGRESS_KEY, DAILY_PLAN_KEY, CHAT_HISTORY_KEY];

  if (options?.includeProfile) {
    keys.push(PROFILE_KEY);
  }

  await AsyncStorage.multiRemove(keys);
}

export async function sendChatMessage(
  input: string,
  profile: LearningProfile,
  progress: UserProgress
): Promise<{ messages: ChatMessage[]; aiError: string | null }> {
  await ensureFeatureAvailable('aiChatMessages');
  const history = await getChatHistory();
  const userMessage: ChatMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    text: input.trim(),
    createdAt: formatLocalDateTime(),
  };

  const recentHistory = [...history, userMessage].slice(-8);
  const transcript = recentHistory
    .map((message) => `${message.role === 'user' ? 'Student' : 'Tutor'}: ${message.text}`)
    .join('\n');

  let replyText = '';
  let aiError: string | null = null;
  let hasAttemptedAiRequest = false;

  try {
    hasAttemptedAiRequest = true;
    replyText = await askAI(`You are an English tutor for a Ukrainian-speaking learner.
Reply mostly in English, but after the main reply add a short block "Пояснення українською:" with 1-2 short Ukrainian sentences.
Student level: ${profile.level}
Student goal: ${profile.goal}
Preferred focus: ${profile.preferredFocus}
Weak topics: ${progress.weakTopics.join(', ') || 'none'}

Conversation:
${transcript}

Respond naturally, keep it under 220 words unless the student explicitly asks for a very short reply.`);
  } catch (error) {
    aiError =
      error instanceof Error
        ? error.message
        : 'Тимчасово не вдалося звернутися до AI.';
    replyText =
      error instanceof Error
        ? `Let's keep practicing. I could not reach AI right now. Пояснення українською: Тимчасово немає відповіді від AI. Причина: ${error.message}`
        : `Let's keep practicing. Пояснення українською: Тимчасово AI недоступний.`;
  }

  const assistantMessage: ChatMessage = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    text: replyText.trim(),
    createdAt: formatLocalDateTime(),
  };

  const nextHistory = [...history, userMessage, assistantMessage].slice(-20);
  await saveChatHistory(nextHistory);
  if (hasAttemptedAiRequest) {
    await consumeFeatureUsage('aiChatMessages');
  }

  return {
    messages: nextHistory,
    aiError,
  };
}

export async function getBadges(
  progress: UserProgress,
  sessions: Session[]
): Promise<Badge[]> {
  const [wordStats, courses] = await Promise.all([getWordStats(), getCoursesWithProgress()]);
  const completedLessons = courses.reduce(
    (sum, course) => sum + course.progress.completedLessonIds.length,
    0
  );

  const badges: Badge[] = [
    {
      id: 'first-steps',
      title: 'Перші кроки',
      description: 'Виконати перші 10 вправ.',
      unlocked: progress.totalExercises >= 10,
      unlockedAt: progress.totalExercises >= 10 ? formatLocalDateTime() : undefined,
    },
    {
      id: 'streak-keeper',
      title: 'Streak Keeper',
      description: 'Навчатись 7 днів поспіль.',
      unlocked: progress.streakRecord !== undefined && progress.streakRecord >= 7,
      unlockedAt:
        progress.streakRecord !== undefined && progress.streakRecord >= 7
          ? formatLocalDateTime()
          : undefined,
    },
    {
      id: 'word-collector',
      title: 'Word Collector',
      description: 'Зібрати 25 слів у словнику.',
      unlocked: wordStats.total >= 25,
      unlockedAt: wordStats.total >= 25 ? formatLocalDateTime() : undefined,
    },
    {
      id: 'word-master',
      title: 'Word Master',
      description: 'Позначити 10 слів як освоєні.',
      unlocked: wordStats.mastered >= 10,
      unlockedAt: wordStats.mastered >= 10 ? formatLocalDateTime() : undefined,
    },
    {
      id: 'course-runner',
      title: 'Course Runner',
      description: 'Закінчити 3 уроки з курсів.',
      unlocked: completedLessons >= 3,
      unlockedAt: completedLessons >= 3 ? formatLocalDateTime() : undefined,
    },
    {
      id: 'practice-machine',
      title: 'Practice Machine',
      description: 'Завершити 5 сесій.',
      unlocked: sessions.length >= 5,
      unlockedAt: sessions.length >= 5 ? formatLocalDateTime() : undefined,
    },
  ];

  return badges;
}

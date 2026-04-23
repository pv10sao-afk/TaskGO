import AsyncStorage from '@react-native-async-storage/async-storage';

import { USER_LEVEL } from '../constants/config';
import { getFallbackTemplates } from './fallbackExercises';
import type { Exercise, PracticeFocus, Session, UserProgress } from '../types';
import { isExerciseContentValidForReuse } from '../utils/exerciseContent';
import {
  buildExerciseSignature,
  normalizeExerciseSignature,
} from '../utils/exerciseSignature';

const USER_PROGRESS_KEY = 'langai:user-progress';
const SESSIONS_KEY = 'langai:sessions';
const ONBOARDING_KEY = 'langai:onboarding-complete';
const EXERCISE_CACHE_KEY = 'langai:exercise-cache';
const EXERCISE_CACHE_LIMIT = 120;

export type CachedExerciseRecord = {
  exercise: Exercise;
  focus: PracticeFocus;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
  favorite: boolean;
  userRating: -1 | 0 | 1;
};

const defaultUserProgress: UserProgress = {
  level: USER_LEVEL,
  totalExercises: 0,
  correctAnswers: 0,
  weakTopics: [],
  streak: 0,
  lastStudyDate: '',
  recentResults: [],
  streakRecord: 0,
  topicMistakes: {},
  xp: 0,
};

function isUserProgress(value: unknown): value is UserProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const progress = value as UserProgress;

  return (
    typeof progress.level === 'string' &&
    typeof progress.totalExercises === 'number' &&
    typeof progress.correctAnswers === 'number' &&
    Array.isArray(progress.weakTopics) &&
    typeof progress.streak === 'number' &&
    typeof progress.lastStudyDate === 'string'
  );
}

function isSessionArray(value: unknown): value is Session[] {
  return Array.isArray(value);
}

function normalizeTopicKey(value: string) {
  return value.trim().toLowerCase();
}

function buildStarterExerciseRecords(): CachedExerciseRecord[] {
  const now = new Date().toISOString();

  return getFallbackTemplates('mixed').map((template, index) => ({
    exercise: {
      ...template,
      id: `starter-${index}-${template.type}`,
      userAnswer: '',
      isCorrect: false,
      choices: template.choices ? [...template.choices] : undefined,
    },
    focus: template.category,
    createdAt: now,
    lastUsedAt: now,
    useCount: 0,
    favorite: false,
    userRating: 0 as 0,
  }));
}

function mergeStarterExercises(cache: CachedExerciseRecord[]): CachedExerciseRecord[] {
  const existingSignatures = new Set(
    cache.map((record) => buildExerciseSignature(record.exercise))
  );
  const missingStarterRecords = buildStarterExerciseRecords().filter(
    (record) => !existingSignatures.has(buildExerciseSignature(record.exercise))
  );

  if (missingStarterRecords.length === 0) {
    return cache;
  }

  return [...missingStarterRecords, ...cache].slice(0, EXERCISE_CACHE_LIMIT);
}

async function getExerciseCache(): Promise<CachedExerciseRecord[]> {
  const rawCache = await AsyncStorage.getItem(EXERCISE_CACHE_KEY);
  const fallbackCache = mergeStarterExercises([]);

  if (!rawCache) {
    await saveExerciseCache(fallbackCache);
    return fallbackCache;
  }

  try {
    const parsedCache = JSON.parse(rawCache) as unknown;

    if (!Array.isArray(parsedCache)) {
      await saveExerciseCache(fallbackCache);
      return fallbackCache;
    }

    const normalizedCache = parsedCache.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const record = item as Partial<CachedExerciseRecord>;

      if (
        typeof record.focus !== 'string' ||
        typeof record.createdAt !== 'string' ||
        typeof record.lastUsedAt !== 'string' ||
        typeof record.useCount !== 'number' ||
        record.exercise === undefined
      ) {
        return [];
      }

      return [
        {
          exercise: record.exercise,
          focus: record.focus,
          createdAt: record.createdAt,
          lastUsedAt: record.lastUsedAt,
          useCount: record.useCount,
          favorite: typeof record.favorite === 'boolean' ? record.favorite : false,
          userRating: (
            record.userRating === 1 || record.userRating === -1 || record.userRating === 0
              ? record.userRating
              : 0
          ) as -1 | 0 | 1,
        } satisfies CachedExerciseRecord,
      ];
    });

    const hydratedCache = mergeStarterExercises(normalizedCache);

    if (hydratedCache.length !== normalizedCache.length) {
      await saveExerciseCache(hydratedCache);
    }

    return hydratedCache;
  } catch {
    await saveExerciseCache(fallbackCache);
    return fallbackCache;
  }
}

async function saveExerciseCache(records: CachedExerciseRecord[]): Promise<void> {
  await AsyncStorage.setItem(EXERCISE_CACHE_KEY, JSON.stringify(records));
}

export async function saveUserProgress(data: UserProgress): Promise<void> {
  await AsyncStorage.setItem(USER_PROGRESS_KEY, JSON.stringify(data));
}

export async function getUserProgress(): Promise<UserProgress> {
  const rawProgress = await AsyncStorage.getItem(USER_PROGRESS_KEY);

  if (!rawProgress) {
    return defaultUserProgress;
  }

  try {
    const parsedProgress = JSON.parse(rawProgress) as unknown;

    if (!isUserProgress(parsedProgress)) {
      return defaultUserProgress;
    }

    return {
      ...defaultUserProgress,
      ...parsedProgress,
      recentResults: Array.isArray(parsedProgress.recentResults)
        ? parsedProgress.recentResults.filter((item): item is boolean => typeof item === 'boolean')
        : [],
      streakRecord:
        typeof parsedProgress.streakRecord === 'number'
          ? parsedProgress.streakRecord
          : defaultUserProgress.streakRecord,
      topicMistakes:
        parsedProgress.topicMistakes && typeof parsedProgress.topicMistakes === 'object'
          ? Object.fromEntries(
              Object.entries(parsedProgress.topicMistakes).filter(
                (entry): entry is [string, number] => typeof entry[1] === 'number'
              )
            )
          : {},
    };
  } catch {
    return defaultUserProgress;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getSessions();
  const nextSessions = [...sessions.filter((item) => item.id !== session.id), session];

  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions));
}

export async function getSessions(): Promise<Session[]> {
  const rawSessions = await AsyncStorage.getItem(SESSIONS_KEY);

  if (!rawSessions) {
    return [];
  }

  try {
    const parsedSessions = JSON.parse(rawSessions) as unknown;
    return isSessionArray(parsedSessions) ? parsedSessions : [];
  } catch {
    return [];
  }
}

export async function updateWeakTopics(topic: string, isWeak: boolean): Promise<UserProgress> {
  const progress = await getUserProgress();
  const normalizedTopic = normalizeTopicKey(topic);

  if (!normalizedTopic) {
    return progress;
  }

  const currentMistakes = progress.topicMistakes?.[normalizedTopic] ?? 0;
  const nextMistakeCount = isWeak ? currentMistakes + 1 : Math.max(0, currentMistakes - 1);
  const nextTopicMistakes = {
    ...(progress.topicMistakes ?? {}),
    [normalizedTopic]: nextMistakeCount,
  };

  if (nextMistakeCount === 0) {
    delete nextTopicMistakes[normalizedTopic];
  }

  const nextWeakTopics =
    nextMistakeCount > 0
      ? Array.from(new Set([...progress.weakTopics, normalizedTopic]))
      : progress.weakTopics.filter((item) => item !== normalizedTopic);

  const updatedProgress: UserProgress = {
    ...progress,
    weakTopics: nextWeakTopics,
    topicMistakes: nextTopicMistakes,
  };

  await saveUserProgress(updatedProgress);

  return updatedProgress;
}

export async function clearStoredData(): Promise<void> {
  await AsyncStorage.multiRemove([USER_PROGRESS_KEY, SESSIONS_KEY, ONBOARDING_KEY, EXERCISE_CACHE_KEY]);
}

export async function resetLearningData(): Promise<void> {
  const currentProgress = await getUserProgress();
  const nextProgress: UserProgress = {
    ...defaultUserProgress,
    level: currentProgress.level,
  };

  await AsyncStorage.multiRemove([SESSIONS_KEY, EXERCISE_CACHE_KEY]);
  await saveUserProgress(nextProgress);
}

export async function clearExerciseCache(): Promise<void> {
  await AsyncStorage.removeItem(EXERCISE_CACHE_KEY);
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const [value, rawProgress] = await Promise.all([
    AsyncStorage.getItem(ONBOARDING_KEY),
    AsyncStorage.getItem(USER_PROGRESS_KEY),
  ]);

  if (value !== 'true' || !rawProgress) {
    return false;
  }

  try {
    const parsedProgress = JSON.parse(rawProgress) as unknown;
    return isUserProgress(parsedProgress);
  } catch {
    return false;
  }
}

export async function completeOnboarding(level: UserProgress['level']): Promise<UserProgress> {
  const existingProgress = await getUserProgress();
  const nextProgress: UserProgress = {
    ...existingProgress,
    level,
  };

  await saveUserProgress(nextProgress);
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

  return nextProgress;
}

export async function saveGeneratedExercise(
  exercise: Exercise,
  focus: PracticeFocus
): Promise<void> {
  const cache = await getExerciseCache();
  const signature = buildExerciseSignature(exercise);
  const now = new Date().toISOString();
  const existingRecord = cache.find(
    (record) => buildExerciseSignature(record.exercise) === signature
  );

  if (existingRecord) {
    await saveExerciseCache(
      cache.map((record) =>
        buildExerciseSignature(record.exercise) === signature
          ? { ...record, lastUsedAt: now }
          : record
      )
    );
    return;
  }

  const nextCache = [
    {
      exercise,
      focus,
      createdAt: now,
      lastUsedAt: now,
      useCount: 0,
      favorite: false,
      userRating: 0 as 0,
    },
    ...cache,
  ].slice(0, EXERCISE_CACHE_LIMIT);

  await saveExerciseCache(nextCache);
}

export async function importGrammarExercises(
  jsonText: string,
  topic: string
): Promise<void> {
  const cleanResponse = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  let parsed: Array<{ question?: string; correctAnswer?: string; choices?: string[] }> = [];
  try {
    parsed = JSON.parse(cleanResponse);
    if (!Array.isArray(parsed)) {
      throw new Error('Очікується JSON масив.');
    }
  } catch (error) {
    throw new Error('Неправильний формат JSON. Переконайтеся, що ви вставили правильний масив.');
  }

  const cache = await getExerciseCache();
  const now = new Date().toISOString();
  let addedCount = 0;
  
  const newRecords: CachedExerciseRecord[] = [];

  for (const item of parsed) {
    if (!item.question || !item.correctAnswer || !item.choices || !Array.isArray(item.choices)) {
      continue;
    }
    
    const quest = item.question.trim();
    if (!quest) continue;

    const exercise: Exercise = {
      id: `imported-grammar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'grammar_multiple_choice',
      category: 'grammar',
      title: topic.trim() || 'Граматична вправа',
      instruction: 'Оберіть правильний варіант',
      question: quest,
      correctAnswer: item.correctAnswer.trim(),
      userAnswer: '',
      isCorrect: false,
      topic: topic.trim() || 'grammar_imported',
      answerFormat: 'choice',
      choices: item.choices.map((c: string) => c.trim()),
    };
    
    const signature = buildExerciseSignature(exercise);
    const existing = cache.find(r => buildExerciseSignature(r.exercise) === signature);
    const inNew = newRecords.find(r => buildExerciseSignature(r.exercise) === signature);
    
    if (!existing && !inNew) {
      newRecords.push({
        exercise,
        focus: 'grammar',
        createdAt: now,
        lastUsedAt: now,
        useCount: 0,
        favorite: false,
        userRating: 0 as 0,
      });
      addedCount++;
    }
  }

  if (addedCount === 0) {
    throw new Error('Не знайдено жодної нової валідної вправи. Перевірте формат: [{"question":"", "correctAnswer":"", "choices":[]}]');
  }

  const nextCache = [...newRecords, ...cache].slice(0, EXERCISE_CACHE_LIMIT);
  await saveExerciseCache(nextCache);
}

export async function getReusableExercise(options: {
  focus: PracticeFocus;
  preferredTopic?: string;
  recentSignatures?: string[];
}): Promise<Exercise | null> {
  const cache = await getExerciseCache();
  const recentSet = new Set(
    (options.recentSignatures ?? []).map(normalizeExerciseSignature)
  );
  const recentSessionSignatures = new Set(
    (await getSessions())
      .slice()
      .sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
      )
      .flatMap((session) => [...session.exercises].reverse())
      .filter((exercise) =>
        options.focus === 'mixed' ? true : exercise.category === options.focus
      )
      .slice(0, 24)
      .map((exercise) => buildExerciseSignature(exercise))
  );
  const normalizedTopic = options.preferredTopic ? normalizeTopicKey(options.preferredTopic) : undefined;
  const compatibleRecords = cache.filter((record) => {
    const signature = buildExerciseSignature(record.exercise);
    const focusMatches = options.focus === 'mixed' || record.exercise.category === options.focus;

    return (
      focusMatches &&
      isExerciseContentValidForReuse(record.exercise) &&
      !recentSet.has(signature) &&
      !recentSessionSignatures.has(signature)
    );
  });
  const sessionFallbackRecords =
    compatibleRecords.length > 0
      ? compatibleRecords
      : cache.filter((record) => {
          const signature = buildExerciseSignature(record.exercise);
          const focusMatches =
            options.focus === 'mixed' || record.exercise.category === options.focus;

          return (
            focusMatches &&
            isExerciseContentValidForReuse(record.exercise) &&
            !recentSet.has(signature)
          );
        });

  if (sessionFallbackRecords.length === 0) {
    return null;
  }

  const preferredRecords = sessionFallbackRecords.filter((record) => record.userRating >= 0);
  const candidateRecords =
    preferredRecords.length > 0 ? preferredRecords : sessionFallbackRecords;

  const sortedRecords = [...candidateRecords].sort((left, right) => {
    if (left.favorite !== right.favorite) {
      return left.favorite ? -1 : 1;
    }

    if (left.userRating !== right.userRating) {
      return right.userRating - left.userRating;
    }

    const leftTopicScore =
      normalizedTopic && normalizeTopicKey(left.exercise.topic) === normalizedTopic ? 1 : 0;
    const rightTopicScore =
      normalizedTopic && normalizeTopicKey(right.exercise.topic) === normalizedTopic ? 1 : 0;

    if (leftTopicScore !== rightTopicScore) {
      return rightTopicScore - leftTopicScore;
    }

    if (left.useCount !== right.useCount) {
      return left.useCount - right.useCount;
    }

    return new Date(left.lastUsedAt).getTime() - new Date(right.lastUsedAt).getTime();
  });

  const selectedRecord = sortedRecords[0];
  const now = new Date().toISOString();

  await saveExerciseCache(
    cache.map((record) =>
      buildExerciseSignature(record.exercise) === buildExerciseSignature(selectedRecord.exercise)
        ? {
            ...record,
            lastUsedAt: now,
            useCount: record.useCount + 1,
          }
        : record
    )
  );

  return {
    ...selectedRecord.exercise,
    id: `${selectedRecord.exercise.id}-reuse-${Date.now()}`,
    userAnswer: '',
    isCorrect: false,
  };
}

export async function getExerciseCacheCount(): Promise<number> {
  const cache = await getExerciseCache();
  return cache.length;
}

export async function getCachedExercises(): Promise<CachedExerciseRecord[]> {
  const cache = await getExerciseCache();
  return [...cache].sort(
    (left, right) => new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime()
  );
}

export async function getRecommendedCachedExercises(limit = 3): Promise<CachedExerciseRecord[]> {
  const cache = await getExerciseCache();

  return [...cache]
    .filter((record) => record.userRating >= 0 && isExerciseContentValidForReuse(record.exercise))
    .sort((left, right) => {
      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }

      if (left.userRating !== right.userRating) {
        return right.userRating - left.userRating;
      }

      if (left.useCount !== right.useCount) {
        return left.useCount - right.useCount;
      }

      return new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime();
    })
    .slice(0, limit);
}

export async function getSmartRecommendedCachedExercises(
  progress: UserProgress,
  limit = 3
): Promise<CachedExerciseRecord[]> {
  const cache = await getExerciseCache();
  const weakTopicSet = new Set(progress.weakTopics.map(normalizeTopicKey));
  const topicMistakes = Object.fromEntries(
    Object.entries(progress.topicMistakes ?? {}).map(([topic, mistakes]) => [
      normalizeTopicKey(topic),
      mistakes,
    ])
  );

  return [...cache]
    .filter((record) => record.userRating >= 0 && isExerciseContentValidForReuse(record.exercise))
    .sort((left, right) => {
      const leftWeakBoost = weakTopicSet.has(normalizeTopicKey(left.exercise.topic)) ? 1 : 0;
      const rightWeakBoost = weakTopicSet.has(normalizeTopicKey(right.exercise.topic)) ? 1 : 0;

      if (leftWeakBoost !== rightWeakBoost) {
        return rightWeakBoost - leftWeakBoost;
      }

      const leftMistakes = topicMistakes[normalizeTopicKey(left.exercise.topic)] ?? 0;
      const rightMistakes = topicMistakes[normalizeTopicKey(right.exercise.topic)] ?? 0;

      if (leftMistakes !== rightMistakes) {
        return rightMistakes - leftMistakes;
      }

      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }

      if (left.userRating !== right.userRating) {
        return right.userRating - left.userRating;
      }

      if (left.useCount !== right.useCount) {
        return left.useCount - right.useCount;
      }

      return new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime();
    })
    .slice(0, limit);
}

export async function getWeakTopicCachedExercises(
  progress: UserProgress,
  limit = 3
): Promise<CachedExerciseRecord[]> {
  const cache = await getExerciseCache();
  const topicMistakes = Object.fromEntries(
    Object.entries(progress.topicMistakes ?? {}).map(([topic, mistakes]) => [
      normalizeTopicKey(topic),
      mistakes,
    ])
  );
  const weakTopicSet = new Set(progress.weakTopics.map(normalizeTopicKey));

  return [...cache]
    .filter(
      (record) =>
        weakTopicSet.has(normalizeTopicKey(record.exercise.topic)) &&
        isExerciseContentValidForReuse(record.exercise)
    )
    .sort((left, right) => {
      const leftMistakes = topicMistakes[normalizeTopicKey(left.exercise.topic)] ?? 0;
      const rightMistakes = topicMistakes[normalizeTopicKey(right.exercise.topic)] ?? 0;

      if (leftMistakes !== rightMistakes) {
        return rightMistakes - leftMistakes;
      }

      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }

      if (left.userRating !== right.userRating) {
        return right.userRating - left.userRating;
      }

      if (left.useCount !== right.useCount) {
        return left.useCount - right.useCount;
      }

      return new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime();
    })
    .slice(0, limit);
}

export async function toggleCachedExerciseFavorite(exercise: Exercise): Promise<void> {
  const cache = await getExerciseCache();
  const signature = buildExerciseSignature(exercise);

  await saveExerciseCache(
    cache.map((record) =>
      buildExerciseSignature(record.exercise) === signature
        ? { ...record, favorite: !record.favorite }
        : record
    )
  );
}

export async function rateCachedExercise(
  exercise: Exercise,
  rating: -1 | 0 | 1
): Promise<void> {
  const cache = await getExerciseCache();
  const signature = buildExerciseSignature(exercise);

  await saveExerciseCache(
    cache.map((record) =>
      buildExerciseSignature(record.exercise) === signature
        ? { ...record, userRating: rating }
        : record
      )
  );
}

export async function updateCachedExercise(
  previousExercise: Exercise,
  updates: Partial<
    Pick<
      Exercise,
      'title' | 'instruction' | 'question' | 'correctAnswer' | 'topic' | 'choices' | 'explanation' | 'sampleAnswer'
    >
  >
): Promise<void> {
  const cache = await getExerciseCache();
  const signature = buildExerciseSignature(previousExercise);

  await saveExerciseCache(
    cache.map((record) => {
      if (buildExerciseSignature(record.exercise) !== signature) {
        return record;
      }

      const nextExercise: Exercise = {
        ...record.exercise,
        ...updates,
      };

      return {
        ...record,
        exercise: nextExercise,
      };
    })
  );
}

export async function deleteCachedExercise(exercise: Exercise): Promise<void> {
  const cache = await getExerciseCache();
  const signature = buildExerciseSignature(exercise);

  await saveExerciseCache(
    cache.filter((record) => buildExerciseSignature(record.exercise) !== signature)
  );
}

export async function getMistakeReplayExercises(options?: {
  focus?: PracticeFocus;
  recentSignatures?: string[];
  limit?: number;
}): Promise<Exercise[]> {
  const sessions = await getSessions();
  const focus = options?.focus ?? 'mixed';
  const limit = options?.limit ?? 10;
  const excludedSignatures = new Set(
    (options?.recentSignatures ?? []).map(normalizeExerciseSignature)
  );
  const mistakes = new Map<
    string,
    { exercise: Exercise; wrongCount: number; lastSeenAt: number }
  >();

  const sortedSessions = [...sessions].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  for (const session of sortedSessions) {
    const sessionTime = new Date(session.date).getTime();

    for (const exercise of [...session.exercises].reverse()) {
      if (exercise.isCorrect) {
        continue;
      }

      if (focus !== 'mixed' && exercise.category !== focus) {
        continue;
      }

      if (!isExerciseContentValidForReuse(exercise)) {
        continue;
      }

      const signature = buildExerciseSignature(exercise);

      if (excludedSignatures.has(signature)) {
        continue;
      }

      const existing = mistakes.get(signature);

      if (!existing) {
        mistakes.set(signature, {
          exercise,
          wrongCount: 1,
          lastSeenAt: sessionTime,
        });
        continue;
      }

      existing.wrongCount += 1;

      if (sessionTime > existing.lastSeenAt) {
        existing.exercise = exercise;
        existing.lastSeenAt = sessionTime;
      }
    }
  }

  return [...mistakes.values()]
    .sort((left, right) => {
      if (left.wrongCount !== right.wrongCount) {
        return right.wrongCount - left.wrongCount;
      }

      return right.lastSeenAt - left.lastSeenAt;
    })
    .slice(0, limit)
    .map(({ exercise }, index) => ({
      ...exercise,
      id: `${exercise.id}-mistake-replay-${Date.now()}-${index}`,
      userAnswer: '',
      isCorrect: false,
    }));
}

export { defaultUserProgress, normalizeTopicKey };

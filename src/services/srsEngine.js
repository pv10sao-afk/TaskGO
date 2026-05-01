import AsyncStorage from '@react-native-async-storage/async-storage';
import { VOCABULARY_DB } from '../data/vocabulary';

// Basic SuperMemo-2 algorithm implementation
export const calculateNextReview = (repetition, easeFactor, interval, quality) => {
  let newRepetition = repetition;
  let newInterval = interval;
  let newEaseFactor = easeFactor;

  if (quality >= 3) {
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetition++;
  } else {
    newRepetition = 0;
    newInterval = 1;
  }

  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    repetition: newRepetition,
    easeFactor: newEaseFactor,
    interval: newInterval,
    nextReviewDate: nextReviewDate.toISOString(),
  };
};

export const getVocabularyProgress = async () => {
  try {
    const data = await AsyncStorage.getItem('@vocabProgress');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const saveVocabularyProgress = async (progressMap) => {
  try {
    await AsyncStorage.setItem('@vocabProgress', JSON.stringify(progressMap));
  } catch (e) {}
};

// Gets the session based on user level and SRS
export const getTodaySession = async (userLevel, newLimit, reviewLimit) => {
  const progress = await getVocabularyProgress();
  const now = new Date();

  // Merge static DB with progress
  const mergedDb = VOCABULARY_DB.map(word => ({
    ...word,
    progress: progress[word.id] || {
      repetition: 0,
      easeFactor: 2.5,
      interval: 0,
      nextReviewDate: null,
      isLearned: false
    }
  }));

  // Find reviews: words that have a nextReviewDate in the past
  const reviews = mergedDb.filter(w => 
    w.progress.isLearned && 
    w.progress.nextReviewDate && 
    new Date(w.progress.nextReviewDate) <= now
  );

  // Find new words: words at the user's level that are not yet learned
  // If we run out of words at the user's level, we could fallback, but we'll stick to level matching.
  const newWords = mergedDb.filter(w => 
    !w.progress.isLearned && 
    w.level === userLevel
  );

  return {
    reviews: reviews.slice(0, reviewLimit),
    newWords: newWords.slice(0, newLimit),
  };
};

export const submitWordReview = async (wordId, quality) => {
  const progress = await getVocabularyProgress();
  const currentProgress = progress[wordId] || {
    repetition: 0,
    easeFactor: 2.5,
    interval: 0,
    nextReviewDate: null,
  };

  const nextParams = calculateNextReview(
    currentProgress.repetition,
    currentProgress.easeFactor,
    currentProgress.interval,
    quality // 0-5 rating from user
  );

  progress[wordId] = {
    ...nextParams,
    isLearned: true, // Marked as learned once reviewed
  };

  await saveVocabularyProgress(progress);
};

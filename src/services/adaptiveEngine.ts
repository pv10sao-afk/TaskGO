import type { UserLevel, UserProgress } from '../types';

const LEVEL_ORDER: UserLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export function updateUserLevel(progress: UserProgress): UserLevel {
  const recentResults = progress.recentResults ?? [];

  if (recentResults.length < 20) {
    return progress.level;
  }

  const recentAccuracy =
    recentResults.filter((result) => result).length / Math.max(recentResults.length, 1);
  const currentIndex = LEVEL_ORDER.indexOf(progress.level);

  if (recentAccuracy > 0.85 && currentIndex < LEVEL_ORDER.length - 1) {
    return LEVEL_ORDER[currentIndex + 1];
  }

  if (recentAccuracy < 0.5 && currentIndex > 0) {
    return LEVEL_ORDER[currentIndex - 1];
  }

  return progress.level;
}

export function getTopicWeight(topic: string, progress: UserProgress): number {
  const normalizedTopic = topic.trim().toLowerCase();

  if (!normalizedTopic) {
    return 1;
  }

  const mistakes = progress.topicMistakes?.[normalizedTopic] ?? 0;
  const weakTopicBoost = progress.weakTopics.some((item) => item.toLowerCase() === normalizedTopic)
    ? 1
    : 0;

  return Math.min(5, Math.max(1, 1 + weakTopicBoost + mistakes));
}

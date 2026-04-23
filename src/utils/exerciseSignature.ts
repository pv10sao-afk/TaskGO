import type { Exercise } from '../types';

export function normalizeExerciseSignature(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, '')
    .replace(/\s+/g, ' ');
}

export function buildExerciseSignature(
  exercise: Pick<Exercise, 'type' | 'question' | 'correctAnswer'>
) {
  return normalizeExerciseSignature(
    `${exercise.type}::${exercise.question}::${exercise.correctAnswer}`
  );
}

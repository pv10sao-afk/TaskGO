import type { Exercise, ExerciseType } from '../types';

type ExerciseContentShape = {
  type: ExerciseType;
  question: string;
  answer: string;
  passage?: string;
};

const CYRILLIC_RE = /[А-Яа-яЇїІіЄєҐґ]/;
const LATIN_RE = /[A-Za-z]/g;

function countLatinLetters(value: string) {
  return value.match(LATIN_RE)?.length ?? 0;
}

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ');
}

function countWords(value: string) {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return 0;
  }

  return normalized.split(' ').filter(Boolean).length;
}

function containsOnlyLatinFriendlyText(value: string) {
  return !hasCyrillicText(value) && countLatinLetters(value) > 0;
}

function containsExactPhrase(text: string, phrase: string) {
  const normalizedText = normalizeComparableText(text);
  const normalizedPhrase = normalizeComparableText(phrase);

  if (!normalizedText || !normalizedPhrase) {
    return false;
  }

  return (` ${normalizedText} `).includes(` ${normalizedPhrase} `);
}

export function hasCyrillicText(value: string) {
  return CYRILLIC_RE.test(value);
}

export function isGrammarExerciseContentValid(
  exercise: ExerciseContentShape & { choices?: string[] }
) {
  if (exercise.type !== 'grammar_fill_blank' && exercise.type !== 'grammar_multiple_choice') {
    return true;
  }

  const question = exercise.question.trim();
  const answer = exercise.answer.trim();

  if (!question || !answer) {
    return false;
  }

  if (
    hasCyrillicText(question) ||
    hasCyrillicText(answer) ||
    countLatinLetters(question) < 6 ||
    countLatinLetters(answer) < 1
  ) {
    return false;
  }

  if ((question.match(/_/g) ?? []).length !== 1 || question.length > 140) {
    return false;
  }

  if (exercise.type === 'grammar_fill_blank') {
    return countWords(answer) <= 4 && !answer.includes('?');
  }

  const choices = exercise.choices ?? [];

  if (
    choices.length !== 4 ||
    choices.some((choice) => !containsOnlyLatinFriendlyText(choice) || countWords(choice) > 4)
  ) {
    return false;
  }

  const uniqueChoices = new Set(choices.map(normalizeComparableText));

  if (uniqueChoices.size !== choices.length) {
    return false;
  }

  return containsExactPhrase(choices.join(' '), answer);
}

export function isListeningExerciseContentValid(
  exercise: ExerciseContentShape & { choices?: string[] }
) {
  if (exercise.type !== 'listening_dictation' && exercise.type !== 'listening_choice') {
    return true;
  }

  const question = exercise.question.trim();
  const answer = exercise.answer.trim();

  if (
    !containsOnlyLatinFriendlyText(question) ||
    !containsOnlyLatinFriendlyText(answer) ||
    question.includes('\n') ||
    answer.includes('\n')
  ) {
    return false;
  }

  if (exercise.type === 'listening_dictation') {
    return (
      normalizeComparableText(question) === normalizeComparableText(answer) &&
      countWords(question) >= 5 &&
      countWords(question) <= 18
    );
  }

  const choices = exercise.choices ?? [];

  if (
    choices.length !== 4 ||
    choices.some((choice) => !containsOnlyLatinFriendlyText(choice) || countWords(choice) > 3)
  ) {
    return false;
  }

  const matchingChoices = choices.filter((choice) => containsExactPhrase(question, choice));

  return (
    matchingChoices.length === 1 &&
    containsExactPhrase(question, answer) &&
    normalizeComparableText(matchingChoices[0]) === normalizeComparableText(answer)
  );
}

export function isReadingExerciseContentValid(exercise: ExerciseContentShape) {
  if (exercise.type !== 'reading_comprehension') {
    return true;
  }

  const passage = exercise.passage?.trim() ?? '';
  const question = exercise.question.trim();
  const answer = exercise.answer.trim();

  if (!passage || !question || !answer) {
    return false;
  }

  if (
    hasCyrillicText(passage) ||
    hasCyrillicText(question) ||
    hasCyrillicText(answer)
  ) {
    return false;
  }

  if (
    countLatinLetters(passage) < 80 ||
    countLatinLetters(question) < 8 ||
    countLatinLetters(answer) < 3
  ) {
    return false;
  }

  if (!question.includes('?')) {
    return false;
  }

  return true;
}

export function isExerciseContentValidForReuse(
  exercise: Pick<Exercise, 'type' | 'question' | 'correctAnswer' | 'passage' | 'choices'>
) {
  return (
    isGrammarExerciseContentValid({
      type: exercise.type,
      question: exercise.question,
      answer: exercise.correctAnswer,
      choices: exercise.choices,
    }) &&
    isListeningExerciseContentValid({
      type: exercise.type,
      question: exercise.question,
      answer: exercise.correctAnswer,
      choices: exercise.choices,
    }) &&
    isReadingExerciseContentValid({
      type: exercise.type,
      question: exercise.question,
      answer: exercise.correctAnswer,
      passage: exercise.passage,
    })
  );
}

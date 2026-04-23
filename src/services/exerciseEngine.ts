import { getTopicWeight } from './adaptiveEngine';
import { buildFallbackExercise } from './fallbackExercises';
import { askAI } from './gemini';
import { getReusableExercise, saveGeneratedExercise, updateWeakTopics } from './storage';

import type { Exercise, ExerciseCategory, ExerciseType, PracticeFocus, UserProgress } from '../types';
import {
  isGrammarExerciseContentValid,
  isListeningExerciseContentValid,
  isReadingExerciseContentValid,
} from '../utils/exerciseContent';
import { buildExerciseSignature } from '../utils/exerciseSignature';

type GeneratedExercisePayload = {
  type: ExerciseType;
  category?: ExerciseCategory | string;
  title: string;
  instruction: string;
  question: string;
  answer: string;
  explanation: string;
  topic: string;
  answerFormat: Exercise['answerFormat'];
  choices?: string[];
  sampleAnswer?: string;
  passage?: string;
};

type AnalyzeAnswerResult = {
  isCorrect: boolean;
  feedback: string;
};

export type GenerateExerciseResult = {
  exercise: Exercise;
  aiWarning: string | null;
  source: 'cache' | 'ai' | 'fallback';
};

type SpeakingEvaluation = {
  isCorrect: boolean;
  feedback: string;
};

type ExercisePromptOptions = {
  userProgress: UserProgress;
  focus: PracticeFocus;
  type: ExerciseType;
  topic: string;
  recentTasksSummary: string;
  strict?: boolean;
  previousAttempt?: string;
};

const VALID_EXERCISE_TYPES: ExerciseType[] = [
  'vocabulary_translation',
  'vocabulary_multiple_choice',
  'grammar_fill_blank',
  'grammar_multiple_choice',
  'speaking_text',
  'speaking_voice',
  'listening_dictation',
  'listening_choice',
  'reading_comprehension',
];

const VALID_ANSWER_FORMATS: Exercise['answerFormat'][] = ['text', 'choice', 'long_text'];

const TOPICS_BY_FOCUS: Record<Exclude<PracticeFocus, 'mixed'>, string[]> = {
  vocabulary: ['travel_vocabulary', 'food_vocabulary', 'shopping_vocabulary', 'daily_vocabulary'],
  grammar: [
    'articles',
    'present_simple',
    'past_simple',
    'past_perfect',
    'present_perfect',
    'prepositions',
    'conditionals',
    'passive_voice',
    'word_order',
  ],
  speaking: ['daily_routine_speaking', 'travel_speaking', 'shopping_dialogue', 'future_plans'],
  listening: ['daily_vocabulary', 'travel_vocabulary', 'food_vocabulary', 'shopping_vocabulary'],
  reading: ['daily_life_reading', 'travel_reading', 'work_reading', 'nature_reading'],
};

const TYPES_BY_FOCUS: Record<PracticeFocus, ExerciseType[]> = {
  mixed: [
    'vocabulary_translation',
    'vocabulary_multiple_choice',
    'grammar_fill_blank',
    'grammar_multiple_choice',
    'speaking_text',
    'speaking_voice',
  ],
  vocabulary: ['vocabulary_translation', 'vocabulary_multiple_choice'],
  grammar: ['grammar_fill_blank', 'grammar_multiple_choice'],
  speaking: ['speaking_text', 'speaking_voice'],
  listening: ['listening_dictation', 'listening_choice'],
  reading: ['reading_comprehension'],
};

function getCategoryForType(type: ExerciseType): ExerciseCategory {
  if (type.startsWith('vocabulary_')) {
    return 'vocabulary';
  }

  if (type.startsWith('grammar_')) {
    return 'grammar';
  }

  if (type.startsWith('listening_')) {
    return 'listening';
  }

  if (type === 'reading_comprehension') {
    return 'reading';
  }

  return 'speaking';
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/g, ' ');
}

function normalizeAiJson(rawResponse: string): string {
  const sanitizedResponse = rawResponse
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const trimmedResponse = sanitizedResponse.trim();
  const cleanedResponse = trimmedResponse.startsWith('```')
    ? trimmedResponse
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
    : trimmedResponse;

  if (cleanedResponse.startsWith('{') || cleanedResponse.startsWith('[')) {
    return cleanedResponse;
  }

  const firstObject = cleanedResponse.indexOf('{');
  const lastObject = cleanedResponse.lastIndexOf('}');
  const firstArray = cleanedResponse.indexOf('[');
  const lastArray = cleanedResponse.lastIndexOf(']');

  if (firstArray !== -1 && lastArray !== -1 && firstArray < lastArray) {
    return cleanedResponse.slice(firstArray, lastArray + 1).trim();
  }

  if (firstObject !== -1 && lastObject !== -1 && firstObject < lastObject) {
    return cleanedResponse.slice(firstObject, lastObject + 1).trim();
  }

  return cleanedResponse;
}

function buildAiWarning(error: unknown) {
  if (!(error instanceof Error)) {
    return 'AI тимчасово не відповів, тому показано локальне завдання.';
  }

  if (error.message.includes('invalid exercise format')) {
    return 'AI відповів у незручному форматі, тому показано локальне завдання без зупинки уроку.';
  }

  if (error.message.includes('empty response')) {
    return 'AI повернув порожню відповідь, тому показано локальне завдання.';
  }

  return `AI тимчасово не відповів, тому показано локальне завдання. Причина: ${error.message}`;
}

function pickExerciseType(focus: PracticeFocus) {
  const types = TYPES_BY_FOCUS[focus];
  return types[Math.floor(Math.random() * types.length)];
}

function pickTopic(userProgress: UserProgress, focus: PracticeFocus) {
  if (userProgress.weakTopics.length > 0 && focus !== 'speaking' && Math.random() < 0.65) {
    return userProgress.weakTopics[Math.floor(Math.random() * userProgress.weakTopics.length)];
  }

  const sourceTopics =
    focus === 'mixed'
      ? [...TOPICS_BY_FOCUS.vocabulary, ...TOPICS_BY_FOCUS.grammar, ...TOPICS_BY_FOCUS.speaking]
      : TOPICS_BY_FOCUS[focus];
  const weightedTopics = sourceTopics.flatMap((topic) =>
    Array.from({ length: getTopicWeight(topic, userProgress) }, () => topic)
  );

  return weightedTopics[Math.floor(Math.random() * weightedTopics.length)];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function readStringArrayField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      const items = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);

      if (items.length > 0) {
        return items;
      }
    }
  }

  return [] as string[];
}

function getDefaultTitle(type: ExerciseType) {
  if (type === 'vocabulary_translation') {
    return 'Слова: переклад';
  }

  if (type === 'vocabulary_multiple_choice') {
    return 'Слова: вибір';
  }

  if (type === 'grammar_fill_blank') {
    return 'Граматика: встав слово';
  }

  if (type === 'grammar_multiple_choice') {
    return 'Граматика: обери варіант';
  }

  if (type === 'speaking_voice') {
    return 'Speaking: голос';
  }

  if (type === 'listening_dictation') {
    return 'Слух: диктант';
  }

  if (type === 'listening_choice') {
    return 'Слух: знайди слово';
  }

  if (type === 'reading_comprehension') {
    return 'Читання: розуміння';
  }

  return 'Speaking: практика';
}

function getDefaultInstruction(type: ExerciseType) {
  if (type === 'vocabulary_translation') {
    return 'Прочитай слово або фразу українською і впиши англійський переклад.';
  }

  if (type === 'vocabulary_multiple_choice') {
    return 'Прочитай англійське слово і обери правильний український переклад.';
  }

  if (type === 'grammar_fill_blank') {
    return 'Прочитай речення і впиши англійське слово, яке правильно заповнює пропуск.';
  }

  if (type === 'grammar_multiple_choice') {
    return 'Прочитай речення з пропуском і обери англійський варіант, який граматично підходить.';
  }

  if (type === 'speaking_voice') {
    return 'Скажи фразу англійською вголос і за потреби поправ розпізнаний текст.';
  }

  if (type === 'listening_dictation') {
    return 'Натисни 🔊 щоб прослухати фразу, потім напиши її англійською.';
  }

  if (type === 'listening_choice') {
    return 'Прослухай фразу і обери слово або короткий варіант, який справді звучав у ній.';
  }

  if (type === 'reading_comprehension') {
    return 'Прочитай текст і дай коротку відповідь англійською за його змістом.';
  }

  return 'Напиши 1-2 короткі речення англійською по темі нижче.';
}

function getDefaultExplanation(type: ExerciseType) {
  if (type.startsWith('grammar_')) {
    return 'Зверни увагу на граматичну форму і контекст речення.';
  }

  if (type.startsWith('vocabulary_')) {
    return 'Орієнтуйся на значення слова і контекст завдання.';
  }

  if (type.startsWith('listening_')) {
    return type === 'listening_choice'
      ? 'Тут треба вибрати саме те слово або короткий варіант, який реально прозвучав у фразі.'
      : 'Уважно слухай і намагайся відтворити почуте точно.';
  }

  if (type === 'reading_comprehension') {
    return 'Шукай відповідь безпосередньо в тексті та аналізуй деталі.';
  }

  return 'Сформулюй природну відповідь англійською.';
}

function getDefaultAnswerFormat(type: ExerciseType): Exercise['answerFormat'] {
  if (type === 'vocabulary_multiple_choice' || type === 'grammar_multiple_choice' || type === 'listening_choice') {
    return 'choice';
  }

  if (type === 'speaking_text') {
    return 'long_text';
  }

  return 'text';
}

function coerceExerciseType(value: unknown, fallbackType: ExerciseType): ExerciseType {
  if (typeof value !== 'string') {
    return fallbackType;
  }

  const normalizedValue = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if ((VALID_EXERCISE_TYPES as string[]).includes(normalizedValue)) {
    return normalizedValue as ExerciseType;
  }

  const aliasMap: Record<string, ExerciseType> = {
    grammar_choice: 'grammar_multiple_choice',
    grammar_mcq: 'grammar_multiple_choice',
    grammar_multiple: 'grammar_multiple_choice',
    grammar_blank: 'grammar_fill_blank',
    fill_blank: 'grammar_fill_blank',
    fill_in_the_blank: 'grammar_fill_blank',
    vocab_translation: 'vocabulary_translation',
    translation: 'vocabulary_translation',
    vocab_multiple_choice: 'vocabulary_multiple_choice',
    vocabulary_choice: 'vocabulary_multiple_choice',
    vocabulary_quiz: 'vocabulary_multiple_choice',
    speaking: 'speaking_text',
    speaking_written: 'speaking_text',
    voice: 'speaking_voice',
    speaking_audio: 'speaking_voice',
    listening: 'listening_dictation',
    dictation: 'listening_dictation',
    listening_quiz: 'listening_choice',
    reading: 'reading_comprehension',
    comprehension: 'reading_comprehension',
  };

  return aliasMap[normalizedValue] ?? fallbackType;
}

function coerceAnswerFormat(
  value: unknown,
  type: ExerciseType,
  choices: string[]
): Exercise['answerFormat'] {
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

    if ((VALID_ANSWER_FORMATS as string[]).includes(normalizedValue)) {
      return normalizedValue as Exercise['answerFormat'];
    }

    if (
      normalizedValue === 'multiple_choice' ||
      normalizedValue === 'mcq' ||
      normalizedValue === 'quiz'
    ) {
      return 'choice';
    }

    if (
      normalizedValue === 'textarea' ||
      normalizedValue === 'paragraph' ||
      normalizedValue === 'sentence' ||
      normalizedValue === 'open_text'
    ) {
      return 'long_text';
    }
  }

  if (choices.length > 0) {
    return 'choice';
  }

  return getDefaultAnswerFormat(type);
}

function buildChoicePadding(correctAnswer: string, type: ExerciseType) {
  if (type === 'grammar_multiple_choice') {
    return [
      'is',
      'are',
      'do',
      'does',
      'did',
      'has',
      'have',
      'had',
      'was',
      'were',
      'a',
      'an',
      'the',
      'for',
      'since',
      'to',
    ].filter((choice) => normalizeText(choice) !== normalizeText(correctAnswer));
  }

  if (type === 'vocabulary_multiple_choice') {
    return ['будинок', 'дорога', 'час', 'людина', 'магазин', 'поїздка', 'робота', 'їжа'].filter(
      (choice) => normalizeText(choice) !== normalizeText(correctAnswer)
    );
  }

  return ['option a', 'option b', 'option c', 'option d'].filter(
    (choice) => normalizeText(choice) !== normalizeText(correctAnswer)
  );
}

function coerceGeneratedExercisePayload(
  value: unknown,
  requestedType: ExerciseType,
  requestedTopic: string
): GeneratedExercisePayload | null {
  const arrayValue = Array.isArray(value) ? value[0] : value;
  const outerRecord = toRecord(arrayValue);

  if (!outerRecord) {
    return null;
  }

  const nestedRecord =
    toRecord(outerRecord.exercise) ??
    toRecord(outerRecord.data) ??
    toRecord(outerRecord.item);
  const record = nestedRecord ?? outerRecord;

  if (!record) {
    return null;
  }

  const type = coerceExerciseType(
    record.type ?? record.exerciseType ?? record.exercise_type,
    requestedType
  );
  const choices = readStringArrayField(record, ['choices', 'options', 'variants', 'answers']);
  const answer = readStringField(record, [
    'answer',
    'correctAnswer',
    'correct_answer',
    'solution',
    'correct',
  ]);
  const question = readStringField(record, ['question', 'task', 'prompt', 'sentence']);

  if (!answer || !question) {
    return null;
  }

  const answerFormat = coerceAnswerFormat(
    record.answerFormat ?? record.answer_format,
    type,
    choices
  );
  const sampleAnswer = readStringField(record, [
    'sampleAnswer',
    'sample_answer',
    'exampleAnswer',
    'example_answer',
    'modelAnswer',
    'model_answer',
  ]);

  const passage = readStringField(record, ['passage', 'text', 'readingText', 'reading_text']);

  return {
    type,
    category: getCategoryForType(type),
    title: readStringField(record, ['title', 'name']) || getDefaultTitle(type),
    instruction:
      readStringField(record, ['instruction', 'instructions', 'directions']) ||
      getDefaultInstruction(type),
    question,
    answer,
    explanation:
      readStringField(record, ['explanation', 'reason', 'note']) || getDefaultExplanation(type),
    topic: readStringField(record, ['topic', 'theme', 'grammarTopic']) || requestedTopic,
    answerFormat,
    choices,
    sampleAnswer:
      sampleAnswer || (type === 'speaking_text' || type === 'speaking_voice' ? answer : undefined),
    passage: passage || undefined,
  };
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function sanitizeInlineText(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeBlockText(value: string, maxLength: number) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, maxLength);
}

function sanitizeChoices(
  choices: string[] | undefined,
  correctAnswer: string,
  type: ExerciseType
) {
  const normalizedChoices = (choices ?? [])
    .map((choice) => sanitizeInlineText(choice, 80))
    .filter(Boolean);
  const paddingChoices = buildChoicePadding(correctAnswer, type);

  if (!normalizedChoices.some((choice) => normalizeText(choice) === normalizeText(correctAnswer))) {
    normalizedChoices.unshift(sanitizeInlineText(correctAnswer, 80));
  }

  const uniqueChoices = Array.from(new Set(normalizedChoices));

  for (const paddingChoice of paddingChoices) {
    if (uniqueChoices.length >= 4) {
      break;
    }

    if (!uniqueChoices.some((choice) => normalizeText(choice) === normalizeText(paddingChoice))) {
      uniqueChoices.push(sanitizeInlineText(paddingChoice, 80));
    }
  }

  return uniqueChoices.slice(0, 4);
}

function sanitizeGeneratedPayload(payload: GeneratedExercisePayload): GeneratedExercisePayload {
  const nextPayload: GeneratedExercisePayload = {
    ...payload,
    title: sanitizeInlineText(payload.title, 60),
    instruction: sanitizeBlockText(payload.instruction, 180),
    question: sanitizeBlockText(payload.question, payload.type.startsWith('grammar_') ? 140 : 220),
    answer: sanitizeInlineText(payload.answer, 120),
    explanation: sanitizeBlockText(payload.explanation, 220),
    topic: sanitizeInlineText(payload.topic, 60),
    sampleAnswer: payload.sampleAnswer ? sanitizeBlockText(payload.sampleAnswer, 180) : undefined,
    passage: payload.passage ? sanitizeBlockText(payload.passage, 900) : undefined,
  };

  if (payload.answerFormat === 'choice') {
    nextPayload.choices = sanitizeChoices(payload.choices, nextPayload.answer, payload.type);
  }

  return nextPayload;
}

function isGeneratedExercisePayload(value: GeneratedExercisePayload): value is GeneratedExercisePayload {
  return (
    VALID_EXERCISE_TYPES.includes(value.type) &&
    typeof value.title === 'string' &&
    Boolean(value.title) &&
    typeof value.instruction === 'string' &&
    Boolean(value.instruction) &&
    typeof value.question === 'string' &&
    Boolean(value.question) &&
    typeof value.answer === 'string' &&
    Boolean(value.answer) &&
    typeof value.explanation === 'string' &&
    Boolean(value.explanation) &&
    typeof value.topic === 'string' &&
    Boolean(value.topic) &&
    VALID_ANSWER_FORMATS.includes(value.answerFormat) &&
    (value.answerFormat !== 'choice' ||
      (Array.isArray(value.choices) &&
        value.choices.length === 4 &&
        value.choices.every((choice) => typeof choice === 'string' && Boolean(choice.trim()))))
  );
}

function isQuestionFormatValid(payload: GeneratedExercisePayload) {
  if (
    !isGrammarExerciseContentValid({
      type: payload.type,
      question: payload.question,
      answer: payload.answer,
      choices: payload.choices,
    })
  ) {
    return false;
  }

  if (payload.type === 'vocabulary_multiple_choice') {
    const source = `${payload.question} ${payload.answer} ${(payload.choices ?? []).join(' ')}`;

    if (!/[A-Za-zА-Яа-яЇїІіЄєҐґ]/.test(source)) {
      return false;
    }
  }

  if (
    !isListeningExerciseContentValid({
      type: payload.type,
      question: payload.question,
      answer: payload.answer,
      choices: payload.choices,
    })
  ) {
    return false;
  }

  if (payload.type === 'reading_comprehension') {
    if (
      !isReadingExerciseContentValid({
        type: payload.type,
        question: payload.question,
        answer: payload.answer,
        passage: payload.passage,
      })
    ) {
      return false;
    }
  }

  return true;
}

function matchesChoiceAnswer(answer: string, choices: string[] | undefined) {
  if (!choices || choices.length === 0) {
    return false;
  }

  return choices.some((choice) => normalizeText(choice) === normalizeText(answer));
}

function questionContainsChoice(question: string, choice: string) {
  const normalizedQuestion = ` ${normalizeText(question)} `;
  const normalizedChoice = normalizeText(choice);

  return normalizedQuestion.includes(` ${normalizedChoice} `);
}

function parseGeneratedExercisePayload(
  rawResponse: string,
  requestedType: ExerciseType,
  requestedTopic: string
) {
  const parsedPayload = JSON.parse(normalizeAiJson(rawResponse)) as unknown;
  const coercedPayload = coerceGeneratedExercisePayload(parsedPayload, requestedType, requestedTopic);

  if (!coercedPayload) {
    throw new Error('AI returned an invalid exercise format.');
  }

  const sanitizedPayload = sanitizeGeneratedPayload(coercedPayload);

  if (!isGeneratedExercisePayload(sanitizedPayload) || !isQuestionFormatValid(sanitizedPayload)) {
    throw new Error('AI returned an invalid exercise format.');
  }

  if (
    sanitizedPayload.answerFormat === 'choice' &&
    !matchesChoiceAnswer(sanitizedPayload.answer, sanitizedPayload.choices)
  ) {
    throw new Error('AI returned an invalid exercise format.');
  }

  if (sanitizedPayload.type === 'listening_choice') {
    const matchingChoices = (sanitizedPayload.choices ?? []).filter((choice) =>
      questionContainsChoice(sanitizedPayload.question, choice)
    );

    if (
      matchingChoices.length !== 1 ||
      !questionContainsChoice(sanitizedPayload.question, sanitizedPayload.answer)
    ) {
      throw new Error('AI returned an invalid exercise format.');
    }
  }

  return sanitizedPayload;
}

function getStrictExample(type: ExerciseType, topic: string) {
  if (type === 'grammar_multiple_choice') {
    return `{
  "type": "grammar_multiple_choice",
  "category": "grammar",
  "title": "Граматика: обери варіант",
  "instruction": "Обери правильну форму дієслова.",
  "question": "How long _ you lived here?",
  "answer": "have",
  "explanation": "З займенником you у Present Perfect вживаємо have.",
  "topic": "${topic}",
  "answerFormat": "choice",
  "choices": ["have", "has", "did", "are"]
}`;
  }

  if (type === 'grammar_fill_blank') {
    return `{
  "type": "grammar_fill_blank",
  "category": "grammar",
  "title": "Граматика: встав слово",
  "instruction": "Встав правильне слово англійською у пропуск.",
  "question": "If she _ earlier, she would catch the bus.",
  "answer": "left",
  "explanation": "У second conditional після if вживаємо Past Simple.",
  "topic": "${topic}",
  "answerFormat": "text"
}`;
  }

  if (type === 'vocabulary_multiple_choice') {
    return `{
  "type": "vocabulary_multiple_choice",
  "category": "vocabulary",
  "title": "Слова: обери значення",
  "instruction": "Прочитай англійське слово і обери правильний український переклад.",
  "question": "What does \\"borrow\\" mean?",
  "answer": "позичати",
  "explanation": "Borrow означає взяти щось на певний час.",
  "topic": "${topic}",
  "answerFormat": "choice",
  "choices": ["позичати", "забувати", "купувати", "продавати"]
}`;
  }

  if (type === 'vocabulary_translation') {
    return `{
  "type": "vocabulary_translation",
  "category": "vocabulary",
  "title": "Слова: переклад",
  "instruction": "Прочитай слово українською і впиши англійський переклад.",
  "question": "валіза",
  "answer": "suitcase",
  "explanation": "Suitcase означає валіза.",
  "topic": "${topic}",
  "answerFormat": "text"
}`;
  }

  if (type === 'speaking_voice') {
    return `{
  "type": "speaking_voice",
  "category": "speaking",
  "title": "Speaking: голос",
  "instruction": "Скажи речення англійською вголос і за потреби поправ текст.",
  "question": "Say aloud: \\"I usually study English in the evening.\\"",
  "answer": "I usually study English in the evening.",
  "explanation": "Головне чітко вимовити речення і звірити транскрипт.",
  "topic": "${topic}",
  "answerFormat": "text",
  "sampleAnswer": "I usually study English in the evening."
}`;
  }

  if (type === 'listening_dictation') {
    return `{
  "type": "listening_dictation",
  "category": "listening",
  "title": "Слух: диктант",
  "instruction": "Натисни 🔊 щоб прослухати фразу, потім напиши її англійською.",
  "question": "She goes to the market every Saturday morning.",
  "answer": "She goes to the market every Saturday morning.",
  "explanation": "Слухай уважно і відтворюй почуте слово за словом.",
  "topic": "${topic}",
  "answerFormat": "text"
}`;
  }

  if (type === 'listening_choice') {
    return `{
  "type": "listening_choice",
  "category": "listening",
  "title": "Слух: знайди слово",
  "instruction": "Прослухай фразу і обери слово, яке справді звучало в ній.",
  "question": "I need to buy some bread and milk.",
  "answer": "buy",
  "explanation": "У цій вправі треба вибрати слово, яке реально є у фразі на слух.",
  "topic": "${topic}",
  "answerFormat": "choice",
  "choices": ["buy", "sell", "lose", "find"]
}`;
  }

  if (type === 'reading_comprehension') {
    return `{
  "type": "reading_comprehension",
  "category": "reading",
  "title": "Читання: розуміння",
  "instruction": "Прочитай текст і дай відповідь на питання нижче.",
  "passage": "Tom wakes up at 7 am every day. He drinks coffee and reads the news before going to work. He works in a small office near the park. After work, he usually goes for a short walk.",
  "question": "What does Tom do after work?",
  "answer": "He goes for a short walk.",
  "explanation": "Відповідь знаходиться в останньому реченні тексту.",
  "topic": "${topic}",
  "answerFormat": "text"
}`;
  }

  return `{
  "type": "speaking_text",
  "category": "speaking",
  "title": "Speaking: коротка відповідь",
  "instruction": "Напиши 1-2 короткі речення англійською по темі нижче.",
  "question": "Describe your usual morning in English.",
  "answer": "I usually wake up early and make coffee before work.",
  "explanation": "Достатньо 1-2 простих природних речень.",
  "topic": "${topic}",
  "answerFormat": "long_text",
  "sampleAnswer": "I usually wake up early and make coffee before work."
}`;
}

function buildExercisePrompt(options: ExercisePromptOptions) {
  const strictMode = options.strict ?? false;
  const commonRules = [
    '- Return ONLY valid JSON.',
    '- All title, instruction and explanation text must be in Ukrainian.',
    '- Make the task clear, beginner-friendly and meaningfully different from recent tasks.',
    '- The student must immediately understand what action to take without guessing.',
    '- Keep title under 7 words, instruction under 140 characters, explanation under 180 characters.',
    '- Avoid line breaks inside question unless it is a very short two-line prompt.',
  ];

  const typeSpecificRules =
    options.type === 'grammar_multiple_choice'
      ? [
          '- question must be ONLY English, one short sentence with exactly one blank "_".',
          '- instruction must clearly say in Ukrainian that the student should choose the option that best fills the blank.',
          '- choices must contain exactly 4 short English options.',
          '- answer must be exactly equal to one of choices.',
          '- Do not use Ukrainian inside question or choices.',
          '- Do not return a full sentence as answer for multiple choice.',
        ]
      : options.type === 'grammar_fill_blank'
        ? [
            '- question must be ONLY English, one short sentence with exactly one blank "_".',
            '- instruction must clearly say in Ukrainian that the student should type the missing English word.',
            '- answer must be one short English word or phrase that fits the blank.',
            '- Do not use Ukrainian inside question.',
          ]
        : options.type === 'vocabulary_multiple_choice'
          ? [
              '- Show only one English word or short phrase in the question.',
              '- instruction must clearly say in Ukrainian that the student should choose the Ukrainian translation.',
              '- choices must contain exactly 4 short answer options.',
              '- answer must be exactly equal to one of choices.',
            ]
          : options.type === 'vocabulary_translation'
            ? [
                '- Show only one Ukrainian word or one short Ukrainian phrase in the question.',
                '- instruction must clearly say in Ukrainian that the student should type the English translation.',
                '- answer must be a short direct translation, not an explanation.',
              ]
            : options.type === 'speaking_voice'
              ? [
                  '- question should ask the learner to say one English sentence aloud.',
                  '- Include sampleAnswer.',
                ]
              : options.type === 'listening_dictation'
                ? [
                    '- question must be a single natural English sentence (10-15 words) the student will hear and write.',
                    '- answer must be the exact same sentence as question.',
                    '- Do NOT include Ukrainian in question or answer.',
                  ]
                : options.type === 'listening_choice'
                  ? [
                      '- question must be a single natural English sentence the student will hear.',
                      '- instruction must clearly say in Ukrainian that the student should choose the word or short option that really appears in the sentence.',
                      '- choices must contain exactly 4 short English options.',
                      '- Exactly one choice must appear in the sentence question verbatim.',
                      '- The other three choices must NOT appear in the sentence.',
                      '- answer must be exactly equal to one of choices and must appear in question.',
                    ]
                  : options.type === 'reading_comprehension'
                    ? [
                        '- Include a "passage" field: a short English text of 4-7 sentences on the topic.',
                        '- instruction must clearly say in Ukrainian that the student should read the text and answer in English.',
                        '- question must be ONLY in simple English and must end with a question mark.',
                        '- question must ask about one specific detail IN the passage.',
                        '- Prefer direct question forms like "Who...?", "Where...?", "What...?" or "When...?".',
                        '- answer must be found directly in the passage (short phrase or sentence).',
                        '- Do NOT include Ukrainian in passage, question, or answer.',
                      ]
                    : [
                        '- Ask for 1-2 short English sentences.',
                        '- instruction must clearly say in Ukrainian that the student should answer in English.',
                        '- Include sampleAnswer.',
                      ];

  const repairBlock =
    strictMode && options.previousAttempt
      ? `The previous AI output was unusable. Fix the format completely and if needed create a new task from scratch.\nPrevious invalid output:\n${options.previousAttempt}\n`
      : '';

  return `You are creating an English exercise for a Ukrainian-speaking student.
Student level: ${options.userProgress.level}
Focus: ${options.focus}
Exercise type: ${options.type}
Topic: ${options.topic}
Weak topics: ${options.userProgress.weakTopics.join(', ') || 'none'}
Recently used tasks, avoid repeating them or making near-duplicates:
${options.recentTasksSummary}

${repairBlock}Hard rules:
${[...commonRules, ...typeSpecificRules].join('\n')}

Use this output shape exactly:
${getStrictExample(options.type, options.topic)}`;
}

async function evaluateSpeakingAnswer(exercise: Exercise, userAnswer: string): Promise<SpeakingEvaluation> {
  try {
    const prompt = `You are checking an English learning task. Respond in Ukrainian and return ONLY valid JSON.
Task type: ${exercise.type}
Instruction shown to the student: ${exercise.instruction}
Prompt shown to the student: ${exercise.question}
Expected answer or sample answer: ${exercise.sampleAnswer ?? exercise.correctAnswer}
Student answer: ${userAnswer}

Return:
{
  "isCorrect": true or false,
  "feedback": "короткий фідбек українською, 2-3 речення максимум"
}`;

    const rawResponse = await askAI(prompt);
    const parsed = JSON.parse(normalizeAiJson(rawResponse)) as unknown;

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as SpeakingEvaluation).isCorrect === 'boolean' &&
      typeof (parsed as SpeakingEvaluation).feedback === 'string'
    ) {
      return parsed as SpeakingEvaluation;
    }
  } catch {}

  const normalizedUserAnswer = normalizeText(userAnswer);
  const normalizedSample = normalizeText(exercise.sampleAnswer ?? exercise.correctAnswer);
  const isCorrect =
    normalizedUserAnswer.length >= Math.max(10, Math.floor(normalizedSample.length * 0.55));

  return {
    isCorrect,
    feedback: isCorrect
      ? 'Відповідь виглядає достатньо повною. Добре, що ти сформулював(ла) думку англійською.'
      : 'Спробуй дати трохи повнішу відповідь англійською. Орієнтуйся на зразок і ключові слова з теми.',
  };
}

export async function generateExercise(
  userProgress: UserProgress,
  focus: PracticeFocus = 'mixed',
  recentExercises: Exercise[] = []
): Promise<GenerateExerciseResult> {
  const topic = pickTopic(userProgress, focus);
  const type = pickExerciseType(focus);
  const recentSignatures = recentExercises.slice(-6).map(buildExerciseSignature);
  const recentTasksSummary =
    recentExercises.slice(-4).map((exercise) => `- ${exercise.title}: ${exercise.question}`).join('\n') ||
    'none';

  const cachedExercise = await getReusableExercise({
    focus,
    preferredTopic: topic,
    recentSignatures,
  });

  if (cachedExercise) {
    return {
      exercise: cachedExercise,
      aiWarning: null,
      source: 'cache',
    };
  }

  const prompt = buildExercisePrompt({
    userProgress,
    focus,
    type,
    topic,
    recentTasksSummary,
  });

  try {
    const rawResponse = await askAI(prompt);
    let sanitizedPayload: GeneratedExercisePayload;

    try {
      sanitizedPayload = parseGeneratedExercisePayload(rawResponse, type, topic);
    } catch {
      const repairPrompt = buildExercisePrompt({
        userProgress,
        focus,
        type,
        topic,
        recentTasksSummary,
        strict: true,
        previousAttempt: rawResponse.slice(0, 1200),
      });
      const repairedResponse = await askAI(repairPrompt);
      sanitizedPayload = parseGeneratedExercisePayload(repairedResponse, type, topic);
    }

    const nextExercise: Exercise = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: sanitizedPayload.type,
      category: getCategoryForType(sanitizedPayload.type),
      title: sanitizedPayload.title,
      instruction: sanitizedPayload.instruction,
      question: sanitizedPayload.question,
      correctAnswer: sanitizedPayload.answer,
      userAnswer: '',
      isCorrect: false,
      topic: sanitizedPayload.topic,
      answerFormat: sanitizedPayload.answerFormat,
      explanation: sanitizedPayload.explanation,
      choices: sanitizedPayload.choices,
      sampleAnswer: sanitizedPayload.sampleAnswer,
      passage: sanitizedPayload.passage,
    };

    if (recentSignatures.includes(buildExerciseSignature(nextExercise))) {
      return {
        exercise: buildFallbackExercise(topic, focus, recentSignatures),
        aiWarning: 'AI згенерував повторюване завдання, тому показано локальний запасний варіант.',
        source: 'fallback',
      };
    }

    await saveGeneratedExercise(nextExercise, focus);

    return {
      exercise: nextExercise,
      aiWarning: null,
      source: 'ai',
    };
  } catch (error) {
    return {
      exercise: buildFallbackExercise(topic, focus, recentSignatures),
      aiWarning: buildAiWarning(error),
      source: 'fallback',
    };
  }
}

export async function analyzeAnswer(
  exercise: Exercise,
  userAnswer: string
): Promise<AnalyzeAnswerResult> {
  let isCorrect = false;
  let feedback = '';

  if (exercise.type === 'speaking_text' || exercise.type === 'speaking_voice' || exercise.type === 'reading_comprehension') {
    const speakingEvaluation = await evaluateSpeakingAnswer(exercise, userAnswer);
    isCorrect = speakingEvaluation.isCorrect;
    feedback = speakingEvaluation.feedback;
  } else {
    const normalizedUserAnswer = normalizeText(userAnswer);
    const normalizedCorrectAnswer = normalizeText(exercise.correctAnswer);
    isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
    feedback = isCorrect
      ? `Правильно. ${exercise.explanation ?? 'Чудово впорався(лась).'}`
      : `Поки що ні. Правильна відповідь: ${exercise.correctAnswer}. ${exercise.explanation ?? ''}`.trim();
  }

  await updateWeakTopics(exercise.topic, !isCorrect);

  return {
    isCorrect,
    feedback,
  };
}

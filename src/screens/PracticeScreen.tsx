import { startTransition, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Sound from 'react-native-sound';
import * as Haptics from '../utils/haptics';
import * as Speech from '../utils/tts';
import Voice, { type SpeechResultsEvent, type SpeechErrorEvent } from '@react-native-voice/voice';
import { PermissionsAndroid, Platform } from 'react-native';

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { ExerciseCard } from '../components/ExerciseCard';
import type { AppTabParamList } from '../navigation/AppNavigator';
import { consumeFeatureUsage, getAccessStatus } from '../services/access';
import { updateUserLevel } from '../services/adaptiveEngine';
import { analyzeAnswer, generateExercise } from '../services/exerciseEngine';
import { askAI } from '../services/gemini';
import { markDailyPlanItemsCompleted } from '../services/learningHub';
import {
  deleteCachedExercise,
  defaultUserProgress,
  getMistakeReplayExercises,
  getUserProgress,
  saveSession,
  saveUserProgress,
  updateCachedExercise,
} from '../services/storage';
import type {
  AccessStatus,
  Exercise,
  PracticeFocus,
  PracticeSessionSource,
  Session,
  UserProgress,
} from '../types';
import { buildExerciseSignature } from '../utils/exerciseSignature';
import { formatLocalDateKey, formatLocalDateTime } from '../utils/date';

type PracticeScreenProps = BottomTabScreenProps<AppTabParamList, 'Practice'>;
type PracticeState = 'loading' | 'question' | 'checking' | 'result' | 'sessionEnd';

const FOCUS_OPTIONS: Array<{ key: PracticeFocus; label: string }> = [
  { key: 'mixed', label: 'Мікс' },
  { key: 'vocabulary', label: 'Слова' },
  { key: 'grammar', label: 'Граматика' },
  { key: 'speaking', label: 'Speaking' },
  { key: 'listening', label: '🔊 Слух' },
  { key: 'reading', label: '📖 Читання' },
];

function getTodayKey() {
  return formatLocalDateKey();
}

function getYesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatLocalDateKey(date);
}

function getNextStreak(previousDate: string, currentStreak: number) {
  const today = getTodayKey();

  if (previousDate === today) {
    return currentStreak;
  }

  if (previousDate === getYesterdayKey()) {
    return currentStreak + 1;
  }

  return 1;
}

function getAnswerLabel(exercise: Exercise) {
  if (exercise.type === 'vocabulary_translation') {
    return 'Впиши переклад англійською';
  }

  if (exercise.type === 'vocabulary_multiple_choice') {
    return 'Обери правильний переклад';
  }

  if (exercise.type === 'grammar_fill_blank') {
    return 'Впиши слово для пропуску';
  }

  if (exercise.type === 'grammar_multiple_choice') {
    return 'Обери правильну форму';
  }

  if (exercise.type === 'speaking_voice') {
    return 'Розпізнаний текст або твоя правка';
  }

  if (exercise.type === 'listening_choice') {
    return 'Обери слово, яке було у фразі';
  }

  if (exercise.type === 'listening_dictation') {
    return 'Впиши фразу англійською';
  }

  if (exercise.type === 'reading_comprehension') {
    return 'Коротка відповідь за текстом';
  }

  if (exercise.type === 'speaking_text') {
    return 'Напиши відповідь англійською';
  }

  if (exercise.answerFormat === 'long_text') {
    return 'Твоя відповідь англійською';
  }

  if (exercise.answerFormat === 'choice') {
    return 'Обери один варіант';
  }

  return 'Відповідь';
}

function getAnswerPlaceholder(exercise: Exercise) {
  if (exercise.type === 'vocabulary_translation') {
    return 'Наприклад: travel';
  }

  if (exercise.type === 'grammar_fill_blank') {
    return 'Впиши слово, яке підходить у пропуск';
  }

  if (exercise.type === 'speaking_voice') {
    return 'Скажи фразу в мікрофон. Текст підтягнеться сюди автоматично.';
  }

  if (exercise.type === 'listening_dictation') {
    return 'Після прослуховування впиши всю фразу англійською';
  }

  if (exercise.type === 'reading_comprehension') {
    const normalizedQuestion = exercise.question.trim().toLowerCase();

    if (normalizedQuestion.startsWith('who ')) {
      return 'Наприклад: Sarah works as a freelance writer.';
    }

    if (normalizedQuestion.startsWith('where ')) {
      return 'Наприклад: She works in a coffee shop near her home.';
    }

    if (normalizedQuestion.startsWith('when ') || normalizedQuestion.startsWith('what time ')) {
      return 'Наприклад: She starts at 6 am.';
    }

    if (normalizedQuestion.startsWith('how many ') || normalizedQuestion.startsWith('how long ')) {
      return 'Наприклад: She works for a few hours.';
    }

    return 'Наприклад: She checks her emails during a short break.';
  }

  if (exercise.answerFormat === 'long_text') {
    return 'Напиши 1-3 речення англійською';
  }

  return 'Введи відповідь англійською';
}

function getAnswerSupportText(exercise: Exercise) {
  if (exercise.type === 'reading_comprehension') {
    const normalizedQuestion = exercise.question.trim().toLowerCase();

    if (normalizedQuestion.startsWith('who ')) {
      return 'Відповідай коротким повним реченням англійською: хто це або хто щось робить.';
    }

    if (normalizedQuestion.startsWith('where ')) {
      return 'Відповідай коротким реченням англійською і назви місце, а не лише одне слово.';
    }

    if (normalizedQuestion.startsWith('when ') || normalizedQuestion.startsWith('what time ')) {
      return 'Відповідай коротким реченням англійською і вкажи час або момент із тексту.';
    }

    return 'Відповідай коротким повним реченням англійською за текстом, не одним словом.';
  }

  return '';
}

function getListeningAudioHint(exercise: Exercise) {
  if (exercise.type === 'listening_choice') {
    return 'Натисни кнопку нижче, прослухай фразу і вибери слово або короткий варіант, який справді звучав у ній.';
  }

  return 'Натисни кнопку нижче, прослухай фразу і впиши її англійською якомога точніше.';
}

function getPlanItemIdsForFocus(focus: PracticeFocus) {
  if (focus === 'grammar') {
    return ['grammar-practice'];
  }

  if (focus === 'speaking') {
    return ['speaking-practice'];
  }

  if (focus === 'vocabulary') {
    return ['review-words', 'new-words'];
  }

  return ['grammar-practice', 'speaking-practice'];
}

function getPlanItemIdsForSession(focus: PracticeFocus, source: PracticeSessionSource) {
  if (source === 'mistakes') {
    return ['mistake-repeat'];
  }

  return getPlanItemIdsForFocus(focus);
}

function createExerciseDraft(exercise: Exercise) {
  return {
    title: exercise.title,
    instruction: exercise.instruction,
    question: exercise.question,
    correctAnswer: exercise.correctAnswer,
    topic: exercise.topic,
    explanation: exercise.explanation ?? '',
    sampleAnswer: exercise.sampleAnswer ?? '',
    choicesText: (exercise.choices ?? []).join('\n'),
  };
}

function getPracticeAccessText(accessStatus: AccessStatus | null) {
  if (!accessStatus) {
    return 'Перевіряємо доступ до практики...';
  }

  if (accessStatus.tier === 'vip') {
    return 'VIP активний: вправи без денного ліміту.';
  }

  return `Звичайний доступ: сьогодні залишилось ${accessStatus.remaining.practiceExercises ?? 0} вправ.`;
}

export function PracticeScreen({ navigation, route }: PracticeScreenProps) {
  const [screenState, setScreenState] = useState<PracticeState>('loading');
  const [practiceFocus, setPracticeFocus] = useState<PracticeFocus>(route.params?.focus ?? 'mixed');
  const [sessionSource, setSessionSource] = useState<PracticeSessionSource>(
    route.params?.source ?? 'default'
  );
  const [userProgress, setUserProgress] = useState<UserProgress>(defaultUserProgress);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [aiNotice, setAiNotice] = useState('');
  const [sessionEndReason, setSessionEndReason] = useState('');
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>([]);
  const [explanationModalVisible, setExplanationModalVisible] = useState(false);
  const [exerciseEditorVisible, setExerciseEditorVisible] = useState(false);
  const [detailedExplanation, setDetailedExplanation] = useState('');
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState<boolean | null>(null);
  const [speechRecognitionAvailable, setSpeechRecognitionAvailable] = useState<boolean | null>(null);
  const [speechRecordingSupported, setSpeechRecordingSupported] = useState(false);
  const [isRecognizingSpeech, setIsRecognizingSpeech] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechTranscriptFinal, setSpeechTranscriptFinal] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [flashColor, setFlashColor] = useState('#14532D');
  const [sessionTarget, setSessionTarget] = useState(route.params?.quickStart ? 1 : 10);
  const [sessionLaunchToken, setSessionLaunchToken] = useState(0);
  const [exerciseEditorDraft, setExerciseEditorDraft] = useState({
    title: '',
    instruction: '',
    question: '',
    correctAnswer: '',
    topic: '',
    explanation: '',
    sampleAnswer: '',
    choicesText: '',
  });
  const flashAnimation = useRef(new Animated.Value(0)).current;
  const recordingPlayerRef = useRef<Sound | null>(null);
  const manualExerciseModeRef = useRef(false);

  useEffect(() => {
    const incomingFocus = route.params?.focus;
    const incomingQuickStart = route.params?.quickStart;
    const incomingPresetExercise = route.params?.presetExercise;
    const incomingSource = route.params?.source;

    if (
      incomingFocus === undefined &&
      incomingQuickStart === undefined &&
      incomingPresetExercise === undefined &&
      incomingSource === undefined
    ) {
      return;
    }

    if (incomingFocus) {
      manualExerciseModeRef.current = false;
      setPracticeFocus(incomingFocus);
    }

    if (incomingSource) {
      setSessionSource(incomingSource);
    }

    try {
      void Voice.destroy();
    } catch {}

    setSessionTarget(incomingQuickStart ? 1 : 10);

    if (incomingPresetExercise) {
      manualExerciseModeRef.current = true;
      setCurrentExercise({
        ...incomingPresetExercise,
        id: `${incomingPresetExercise.id}-manual-${Date.now()}`,
        userAnswer: '',
        isCorrect: false,
      });
      setAnswer('');
      setFeedback('');
      setDetailedExplanation('');
      setExerciseEditorVisible(false);
      setExplanationModalVisible(false);
      setErrorMessage('');
      setAiNotice('');
      setSessionEndReason('');
      setSpeechTranscript('');
      setSpeechTranscriptFinal(false);
      setRecordingUri(null);
      setIsRecognizingSpeech(false);
      setSessionExercises([]);
      setScreenState('question');
      setPracticeFocus(incomingFocus ?? incomingPresetExercise.category);
    } else {
      manualExerciseModeRef.current = false;
      setSessionExercises([]);
      setErrorMessage('');
      setAiNotice('');
      setSessionEndReason('');
      setSessionLaunchToken((value) => value + 1);
    }

    navigation.setParams({
      focus: undefined,
      presetExercise: undefined,
      quickStart: undefined,
      source: undefined,
    });
  }, [
    navigation,
    route.params?.focus,
    route.params?.presetExercise,
    route.params?.quickStart,
    route.params?.source,
  ]);

  useEffect(() => {
    let isActive = true;

    async function prepareAudio() {
      try {
        // react-native-sound: set category so audio plays even in silent mode
        Sound.setCategory('Playback');

        // Check microphone permission
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (isActive) setMicrophoneGranted(granted);
        } else {
          if (isActive) setMicrophoneGranted(true);
        }

        // Check voice recognition availability
        const available = await Voice.isAvailable();
        if (isActive) {
          setSpeechRecognitionAvailable(available === 1 || available === true);
          setSpeechRecordingSupported(false); // @react-native-voice/voice не підтримує запис файлу
        }
      } catch {
        if (isActive) {
          setMicrophoneGranted(false);
          setSpeechRecognitionAvailable(false);
          setSpeechRecordingSupported(false);
        }
      }
    }

    void prepareAudio();

    return () => {
      isActive = false;
      Speech.stop();
      try { void Voice.destroy(); } catch {}
      recordingPlayerRef.current?.release();
      recordingPlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    Voice.onSpeechStart = () => {
      if (!isMounted) return;
      setIsRecognizingSpeech(true);
      setSpeechTranscript('');
      setSpeechTranscriptFinal(false);
      setRecordingUri(null);
      setErrorMessage('');
    };

    Voice.onSpeechEnd = () => {
      if (!isMounted) return;
      setIsRecognizingSpeech(false);
    };

    Voice.onSpeechResults = (event: SpeechResultsEvent) => {
      if (!isMounted) return;
      const bestTranscript = event.value?.[0]?.trim() ?? '';
      if (!bestTranscript) return;
      setSpeechTranscript(bestTranscript);
      setSpeechTranscriptFinal(true);
      setAnswer(bestTranscript);
    };

    Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      if (!isMounted) return;
      const partial = event.value?.[0]?.trim() ?? '';
      if (!partial) return;
      setSpeechTranscript(partial);
      setSpeechTranscriptFinal(false);
      setAnswer(partial);
    };

    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      if (!isMounted) return;
      setIsRecognizingSpeech(false);
      const code = event.error?.code ?? '';
      if (code === '7' || code === 'no-speech') {
        setErrorMessage('Не вдалося почути голос. Спробуй сказати фразу голосніше й ближче до мікрофона.');
        return;
      }
      if (code === '9' || code === 'permissions') {
        setMicrophoneGranted(false);
        setErrorMessage('Без дозволу на мікрофон голосовий режим не працює.');
        return;
      }
      setErrorMessage(event.error?.message || 'Сталася помилка під час розпізнавання мовлення.');
    };

    return () => {
      isMounted = false;
      Voice.onSpeechStart = undefined;
      Voice.onSpeechEnd = undefined;
      Voice.onSpeechResults = undefined;
      Voice.onSpeechPartialResults = undefined;
      Voice.onSpeechError = undefined;
      void Voice.destroy();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function bootstrapPractice() {
      if (manualExerciseModeRef.current) {
        return;
      }

      setScreenState('loading');
      setErrorMessage('');
      setAiNotice('');
      setSessionEndReason('');

      try {
        const storedProgress = await getUserProgress();
        const nextAccessStatus = await getAccessStatus();

        if (!isActive) {
          return;
        }

        setUserProgress(storedProgress);
        setAccessStatus(nextAccessStatus);
        setSessionExercises([]);
        await loadExercise(storedProgress, practiceFocus, [], isActive);
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Не вдалося почати практику.'
          );
          setScreenState('question');
        }
      }
    }

    void bootstrapPractice();

    return () => {
      isActive = false;
    };
  }, [practiceFocus, sessionLaunchToken, sessionSource, sessionTarget]);

  async function loadExercise(
    progress: UserProgress,
    focus: PracticeFocus,
    previousExercises: Exercise[] = [],
    isActive = true,
    excludedExercises: Exercise[] = []
  ) {
    setScreenState('loading');
    setErrorMessage('');
    setSessionEndReason('');

    try {
      const nextAccessStatus = await getAccessStatus();

      if (!isActive) {
        return;
      }

      setAccessStatus(nextAccessStatus);

      if (nextAccessStatus.tier !== 'vip' && (nextAccessStatus.remaining.practiceExercises ?? 0) <= 0) {
        startTransition(() => {
          setCurrentExercise(null);
          setAiNotice('');
          setSessionEndReason(
            'Ліміт звичайного доступу на вправи на сьогодні вичерпано. Відкрий меню Підписка, щоб активувати VIP і продовжити без обмежень.'
          );
          setScreenState('sessionEnd');
        });
        return;
      }

      Speech.stop();
      try { void Voice.destroy(); } catch {}
      setIsRecognizingSpeech(false);
      setSpeechTranscript('');
      setSpeechTranscriptFinal(false);
      setRecordingUri(null);
      setIsPlayingRecording(false);
      const excludedSignatures = [...previousExercises, ...excludedExercises].map(
        buildExerciseSignature
      );
      const seenSignatures = new Set(excludedSignatures);
      let nextExerciseResult:
        | Awaited<ReturnType<typeof generateExercise>>
        | { exercise: Exercise; aiWarning: string | null };

      if (sessionSource === 'mistakes') {
        const replayExercises = await getMistakeReplayExercises({
          focus,
          recentSignatures: excludedSignatures,
          limit: 1,
        });

        if (replayExercises.length === 0) {
          await markDailyPlanItemsCompleted(getPlanItemIdsForSession(focus, sessionSource));

          if (previousExercises.length > 0) {
            const correctCount = previousExercises.filter((exercise) => exercise.isCorrect).length;
            const session: Session = {
              id: `${Date.now()}-${focus}-mistakes-exhausted`,
              date: formatLocalDateTime(),
              exercises: previousExercises,
              score: Math.round((correctCount / Math.max(previousExercises.length, 1)) * 100),
            };

            await saveSession(session);
          }

          if (!isActive) {
            return;
          }

          startTransition(() => {
            setCurrentExercise(null);
            setAiNotice('');
            setSessionEndReason(
              previousExercises.length > 0
                ? 'Ти вже пройшов(ла) всі доступні вправи зі своїх помилок у цьому режимі.'
                : 'Поки що немає збережених помилок для повторення. Спочатку зроби кілька вправ.'
            );
            setScreenState('sessionEnd');
          });
          return;
        }

        nextExerciseResult = {
          exercise: replayExercises[0],
          aiWarning:
            'Режим "Мої помилки": зараз повторюємо вправи, де раніше була помилка.',
        };
      } else {
        let attemptExercises = [...previousExercises];
        nextExerciseResult = await generateExercise(progress, focus, attemptExercises);
        let attempts = 0;

        while (
          seenSignatures.has(buildExerciseSignature(nextExerciseResult.exercise)) &&
          attempts < 5
        ) {
          attempts += 1;
          attemptExercises = [...attemptExercises, nextExerciseResult.exercise];
          nextExerciseResult = await generateExercise(progress, focus, attemptExercises);
        }
      }

      if (seenSignatures.has(buildExerciseSignature(nextExerciseResult.exercise))) {
        await markDailyPlanItemsCompleted(getPlanItemIdsForSession(focus, sessionSource));

        if (previousExercises.length > 0) {
          const correctCount = previousExercises.filter((exercise) => exercise.isCorrect).length;
          const session: Session = {
            id: `${Date.now()}-${focus}-exhausted`,
            date: formatLocalDateTime(),
            exercises: previousExercises,
            score: Math.round((correctCount / Math.max(previousExercises.length, 1)) * 100),
          };

          await saveSession(session);
        }

        if (!isActive) {
          return;
        }

        startTransition(() => {
          setCurrentExercise(null);
          setAiNotice('');
          setSessionEndReason(
            sessionSource === 'mistakes'
              ? 'Доступні вправи з твоїх помилок у цій сесії вже закінчилися.'
              : 'На сьогодні нові завдання в цьому режимі вже закінчилися. День зараховано автоматично.'
          );
          setScreenState('sessionEnd');
        });
        return;
      }

      if (!isActive) {
        return;
      }

      startTransition(() => {
        setCurrentExercise(nextExerciseResult.exercise);
        setAnswer('');
        setFeedback('');
        setDetailedExplanation('');
        setExplanationModalVisible(false);
        setAiNotice(nextExerciseResult.aiWarning ?? '');
        setSessionEndReason('');
        setScreenState('question');
      });
    } catch (error) {
      if (!isActive) {
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : 'Не вдалося згенерувати завдання.'
      );
      setScreenState('question');
    }
  }

  async function handleCheckAnswer() {
    if (!currentExercise || !answer.trim()) {
      return;
    }

    setErrorMessage('');

    if (currentExercise.type === 'speaking_voice' && !speechTranscript.trim() && !recordingUri) {
      setErrorMessage(
        'Для голосової практики спочатку скажи фразу в мікрофон, щоб додаток розпізнав текст.'
      );
      return;
    }

    setScreenState('checking');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const nextAccessStatus = await getAccessStatus();
      setAccessStatus(nextAccessStatus);

      if (nextAccessStatus.tier !== 'vip' && (nextAccessStatus.remaining.practiceExercises ?? 0) <= 0) {
        setSessionEndReason(
          'Ліміт звичайного доступу на вправи на сьогодні вичерпано. Відкрий меню Підписка, щоб активувати VIP і продовжити без обмежень.'
        );
        setScreenState('sessionEnd');
        return;
      }

      const result = await analyzeAnswer(currentExercise, answer);
      const progressAfterWeakTopicUpdate = await getUserProgress();
      const recentResults = [...(progressAfterWeakTopicUpdate.recentResults ?? []), result.isCorrect].slice(
        -20
      );
      const streak = getNextStreak(
        progressAfterWeakTopicUpdate.lastStudyDate,
        progressAfterWeakTopicUpdate.streak
      );
      const completedExercise: Exercise = {
        ...currentExercise,
        userAnswer: answer.trim(),
        isCorrect: result.isCorrect,
      };

      const nextSessionExercises = [...sessionExercises, completedExercise];

      const baseXP = 10;
      const perfectXP = result.isCorrect ? 5 : 0;
      const sessionBonusXP = nextSessionExercises.length === sessionTarget ? 50 : 0;
      const earnedXP = baseXP + perfectXP + sessionBonusXP;
      const nextXp = (progressAfterWeakTopicUpdate.xp ?? 0) + earnedXP;

      const updatedProgress: UserProgress = {
        ...progressAfterWeakTopicUpdate,
        totalExercises: progressAfterWeakTopicUpdate.totalExercises + 1,
        correctAnswers: progressAfterWeakTopicUpdate.correctAnswers + (result.isCorrect ? 1 : 0),
        streak,
        lastStudyDate: getTodayKey(),
        recentResults,
        streakRecord: Math.max(progressAfterWeakTopicUpdate.streakRecord ?? 0, streak),
        xp: nextXp,
      };
      updatedProgress.level = updateUserLevel(updatedProgress);

      await saveUserProgress(updatedProgress);
      const nextFeatureStatus = await consumeFeatureUsage('practiceExercises');
      runFlash(result.isCorrect);
      await Haptics.notificationAsync(
        result.isCorrect
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );

      setAccessStatus(nextFeatureStatus);
      setUserProgress(updatedProgress);
      setCurrentExercise(completedExercise);
      setSessionExercises(nextSessionExercises);
      setFeedback(result.feedback);

      // Feature 4: auto-explain for failed speaking_voice
      if (currentExercise.type === 'speaking_voice' && !result.isCorrect) {
        setScreenState('result');
        setExplanationModalVisible(false);
        setIsExplanationLoading(true);
        setDetailedExplanation('');
        const prompt = `Поясни українською, чому відповідь "${answer.trim()}" є неправильною або слабкою для цього завдання.
Завдання: ${currentExercise.title}
Інструкція: ${currentExercise.instruction}
Питання: ${currentExercise.question}
Правильна або еталонна відповідь: ${currentExercise.correctAnswer}
Дай коротке, дуже зрозуміле пояснення максимум у 3 реченнях.`;
        try {
          const explanation = await askAI(prompt);
          setDetailedExplanation(explanation.trim());
        } catch {
          setDetailedExplanation('Не вдалося отримати AI-пояснення зараз.');
        } finally {
          setIsExplanationLoading(false);
        }

        if (nextSessionExercises.length >= sessionTarget) {
          const correctCount = nextSessionExercises.filter((exercise) => exercise.isCorrect).length;
          const session: Session = {
            id: `${Date.now()}-${sessionTarget}`,
            date: formatLocalDateTime(),
            exercises: nextSessionExercises,
            score: Math.round((correctCount / nextSessionExercises.length) * 100),
          };
          await saveSession(session);
          await markDailyPlanItemsCompleted(getPlanItemIdsForSession(practiceFocus, sessionSource));
          setSessionEndReason('План по цій практиці на сьогодні виконано.');
          setScreenState('sessionEnd');
        } else if (
          nextFeatureStatus.tier !== 'vip' &&
          (nextFeatureStatus.remaining.practiceExercises ?? 0) <= 0
        ) {
          setSessionEndReason(
            'На сьогодні ліміт вправ для звичайного доступу вичерпано. Завтра лічильник оновиться, або активуй VIP.'
          );
          setScreenState('sessionEnd');
        }
        return;
      }

      if (nextSessionExercises.length >= sessionTarget) {
        const correctCount = nextSessionExercises.filter((exercise) => exercise.isCorrect).length;
        const session: Session = {
          id: `${Date.now()}-${sessionTarget}`,
          date: formatLocalDateTime(),
          exercises: nextSessionExercises,
          score: Math.round((correctCount / nextSessionExercises.length) * 100),
        };

        await saveSession(session);
        await markDailyPlanItemsCompleted(getPlanItemIdsForSession(practiceFocus, sessionSource));
        setSessionEndReason('План по цій практиці на сьогодні виконано.');
        setScreenState('sessionEnd');
        return;
      }

      if (nextFeatureStatus.tier !== 'vip' && (nextFeatureStatus.remaining.practiceExercises ?? 0) <= 0) {
        setSessionEndReason(
          'На сьогодні ліміт вправ для звичайного доступу вичерпано. Завтра лічильник оновиться, або активуй VIP.'
        );
        setScreenState('sessionEnd');
        return;
      }

      setScreenState('result');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не вдалося перевірити відповідь.');
      setScreenState('question');
    }
  }

  async function handleNextExercise() {
    await Haptics.selectionAsync();
    manualExerciseModeRef.current = false;
    await loadExercise(userProgress, practiceFocus, sessionExercises);
  }

  async function handleReportBadExercise() {
    if (!currentExercise || screenState === 'checking') {
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteCachedExercise(currentExercise);
    manualExerciseModeRef.current = false;
    setErrorMessage('');
    setDetailedExplanation('');
    setExplanationModalVisible(false);
    setExerciseEditorVisible(false);
    setAiNotice('Погане завдання прибрано. Показуємо інше.');

    await loadExercise(userProgress, practiceFocus, sessionExercises, true, [currentExercise]);
  }

  async function handleRestartSession() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    manualExerciseModeRef.current = false;
    setSessionExercises([]);
    setErrorMessage('');
    setAiNotice('');
    setSessionEndReason('');
    await loadExercise(userProgress, practiceFocus, []);
  }

  async function handleFocusChange(focus: PracticeFocus) {
    await Haptics.selectionAsync();
    manualExerciseModeRef.current = false;
    setSessionExercises([]);
    setErrorMessage('');
    setAiNotice('');
    setSessionEndReason('');
    setPracticeFocus(focus);
  }

  async function handleStartRecording() {
    if (speechRecognitionAvailable === false) {
      setErrorMessage(
        'Розпізнавання мовлення недоступне в цьому запуску. Для повного speech-to-text потрібен development build.'
      );
      return;
    }

    if (!microphoneGranted) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Доступ до мікрофона',
            message: 'Дозволь доступ до мікрофона для голосової практики.',
            buttonPositive: 'Дозволити',
          }
        );
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        setMicrophoneGranted(isGranted);
        if (!isGranted) {
          setErrorMessage('Без доступу до мікрофона голосова практика не запуститься.');
          return;
        }
      } catch {
        setErrorMessage('Не вдалося запросити дозвіл на мікрофон.');
        return;
      }
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setErrorMessage('');
    setAnswer('');
    setSpeechTranscript('');
    setSpeechTranscriptFinal(false);
    setRecordingUri(null);

    try {
      await Voice.start('en-US');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Не вдалося запустити розпізнавання мовлення.'
      );
    }
  }

  async function handleStopRecording() {
    await Haptics.selectionAsync();
    try {
      await Voice.stop();
      setIsRecognizingSpeech(false);
    } catch {
      setIsRecognizingSpeech(false);
    }
  }

  async function handlePlayRecording() {
    if (!recordingUri) {
      return;
    }

    await Haptics.selectionAsync();

    // Release previous player if exists
    recordingPlayerRef.current?.release();
    recordingPlayerRef.current = null;

    const player = new Sound(recordingUri, '', (error) => {
      if (error) {
        setIsPlayingRecording(false);
        return;
      }
      setIsPlayingRecording(true);
      player.play((success) => {
        setIsPlayingRecording(false);
        if (!success) player.release();
      });
    });
    recordingPlayerRef.current = player;
  }

  async function handleSpeakTask() {
    if (!currentExercise) {
      return;
    }

    await Haptics.selectionAsync();
    Speech.stop();
    Speech.speak(`${currentExercise.instruction}. ${currentExercise.question}`, {
      language: 'uk-UA',
      pitch: 1,
      rate: 0.95,
    });
  }

  async function handleSpeakModelAnswer() {
    if (!currentExercise) {
      return;
    }

    await Haptics.selectionAsync();
    Speech.stop();
    Speech.speak(currentExercise.sampleAnswer ?? currentExercise.correctAnswer, {
      language: 'en-US',
      pitch: 1,
      rate: 0.9,
    });
  }

  async function handleExplainMore() {
    if (!currentExercise || currentExercise.isCorrect) {
      return;
    }

    await Haptics.selectionAsync();
    setExplanationModalVisible(true);
    setIsExplanationLoading(true);
    setDetailedExplanation('');

    const prompt = `Поясни українською, чому відповідь "${currentExercise.userAnswer}" є неправильною або слабкою для цього завдання.
Завдання: ${currentExercise.title}
Інструкція: ${currentExercise.instruction}
Питання: ${currentExercise.question}
Правильна або еталонна відповідь: ${currentExercise.correctAnswer}
Дай коротке, дуже зрозуміле пояснення максимум у 3 реченнях.`;

    try {
      const explanation = await askAI(prompt);
      setDetailedExplanation(explanation.trim());
    } catch (error) {
      setDetailedExplanation(
        error instanceof Error
          ? `Не вдалося отримати AI-пояснення. ${error.message}`
          : 'Не вдалося отримати AI-пояснення зараз.'
      );
    } finally {
      setIsExplanationLoading(false);
    }
  }

  function openExerciseEditor() {
    if (!currentExercise) {
      return;
    }

    setExerciseEditorDraft(createExerciseDraft(currentExercise));
    setExerciseEditorVisible(true);
  }

  function closeExerciseEditor() {
    setExerciseEditorVisible(false);
    setExerciseEditorDraft({
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
    if (!currentExercise) {
      return;
    }

    if (
      !exerciseEditorDraft.title.trim() ||
      !exerciseEditorDraft.instruction.trim() ||
      !exerciseEditorDraft.question.trim() ||
      !exerciseEditorDraft.correctAnswer.trim() ||
      !exerciseEditorDraft.topic.trim()
    ) {
      Alert.alert('Не вистачає даних', 'Заповни заголовок, інструкцію, питання, відповідь і тему.');
      return;
    }

    const choices = exerciseEditorDraft.choicesText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    if (currentExercise.answerFormat === 'choice' && choices.length < 2) {
      Alert.alert('Замало варіантів', 'Для тесту додай хоча б 2 варіанти відповіді окремими рядками.');
      return;
    }

    const updates = {
      title: exerciseEditorDraft.title.trim(),
      instruction: exerciseEditorDraft.instruction.trim(),
      question: exerciseEditorDraft.question.trim(),
      correctAnswer: exerciseEditorDraft.correctAnswer.trim(),
      topic: exerciseEditorDraft.topic.trim(),
      explanation: exerciseEditorDraft.explanation.trim() || undefined,
      sampleAnswer: exerciseEditorDraft.sampleAnswer.trim() || undefined,
      choices: currentExercise.answerFormat === 'choice' ? choices : undefined,
    };

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateCachedExercise(currentExercise, updates);
    setCurrentExercise((prev) => (prev ? { ...prev, ...updates } : prev));
    setAnswer('');
    setFeedback('');
    setDetailedExplanation('');
    setExplanationModalVisible(false);
    setErrorMessage('');
    setScreenState('question');
    closeExerciseEditor();
    Alert.alert('Готово', 'Завдання оновлено.');
  }

  function runFlash(isCorrect: boolean) {
    flashAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnimation, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnimation, {
        delay: 120,
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    setFlashColor(isCorrect ? '#14532D' : '#7F1D1D');
  }

  const correctCount = sessionExercises.filter((exercise) => exercise.isCorrect).length;
  const canSubmit = Boolean(answer.trim());

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flashOverlay,
          {
            backgroundColor: flashColor,
            opacity: flashAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.24],
            }),
          },
        ]}
      />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Практика</Text>
        <Text style={styles.title}>
          {sessionSource === 'mistakes'
            ? 'Повтор твоїх помилок'
            : 'Різні типи вправ з чіткими поясненнями'}
        </Text>
        <Text style={styles.counter}>
          {correctCount} правильних / {sessionExercises.length} виконано в цій сесії
        </Text>
      </View>

      <View style={styles.accessCard}>
        <Text style={styles.accessTitle}>
          {accessStatus?.tier === 'vip' ? 'VIP доступ' : 'Звичайний доступ'}
        </Text>
        <Text style={styles.accessText}>{getPracticeAccessText(accessStatus)}</Text>
      </View>

      <View style={styles.focusRow}>
        {FOCUS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={() => void handleFocusChange(option.key)}
            style={[
              styles.focusChip,
              practiceFocus === option.key && styles.focusChipActive,
            ]}
          >
            <Text
              style={[
                styles.focusChipText,
                practiceFocus === option.key && styles.focusChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {screenState === 'loading' ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#7C3AED" size="large" />
          <Text style={styles.stateText}>Готується нове завдання...</Text>
        </View>
      ) : null}

      {screenState === 'sessionEnd' && !currentExercise ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>На сьогодні досить</Text>
          <Text style={styles.summaryText}>
            {sessionEndReason || 'Поточний ліміт на вправи вже вичерпано.'}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.primaryButtonText}>Відкрити статистику</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {screenState !== 'loading' && screenState !== 'sessionEnd' && !currentExercise ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorTitle}>Практика поки що недоступна</Text>
          <Text style={styles.errorText}>
            {errorMessage || 'Не вдалося завантажити вправу. Спробуй ще раз.'}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRestartSession}>
            <Text style={styles.primaryButtonText}>Спробувати ще раз</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {currentExercise && screenState !== 'loading' ? (
        <View style={styles.content}>
          {aiNotice ? (
            <View style={styles.aiNoticeCard}>
              <Text style={styles.aiNoticeTitle}>
                {sessionSource === 'mistakes' ? 'Режим практики' : 'AI тимчасово не спрацював'}
              </Text>
              <Text style={styles.aiNoticeText}>{aiNotice}</Text>
            </View>
          ) : null}

          {/* Reading passage block */}
          {currentExercise.passage ? (
            <View style={styles.passageCard}>
              <Text style={styles.passageLabel}>📖 Текст для читання</Text>
              <Text style={styles.passageText}>{currentExercise.passage}</Text>
            </View>
          ) : null}

          <ExerciseCard exercise={currentExercise} />

          {/* Listening: speak the question aloud */}
          {(currentExercise.type === 'listening_dictation' || currentExercise.type === 'listening_choice') && screenState !== 'result' && screenState !== 'sessionEnd' ? (
            <View style={styles.audioCard}>
              <Text style={styles.audioCardTitle}>🔊 Аудіо</Text>
              <Text style={styles.audioCardText}>
                {getListeningAudioHint(currentExercise)}
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  void Haptics.selectionAsync();
                  Speech.stop();
                  Speech.speak(currentExercise.question, { language: 'en-US', rate: 0.85, pitch: 1 });
                }}
              >
                <Text style={styles.primaryButtonText}>🔊 Прослухати фразу</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.audioCard}>
            <Text style={styles.audioCardTitle}>Редагування завдання</Text>
            <Text style={styles.audioCardText}>
              Якщо в тексті є помилка або хочеш підправити формулювання, це можна змінити прямо тут.
            </Text>
            <View style={styles.audioButtonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={openExerciseEditor}>
                <Text style={styles.secondaryButtonText}>Редагувати це завдання</Text>
              </TouchableOpacity>
              {screenState !== 'result' && screenState !== 'sessionEnd' ? (
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.warningButton]}
                  onPress={handleReportBadExercise}
                >
                  <Text style={[styles.secondaryButtonText, styles.warningButtonText]}>
                    Погане завдання
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.audioCard}>
            <Text style={styles.audioCardTitle}>Озвучка від бота</Text>
            <Text style={styles.audioCardText}>
              Бот може озвучити завдання і правильний зразок, щоб ти чув(ла) природну англійську.
            </Text>
            <View style={styles.audioButtonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSpeakTask}>
                <Text style={styles.secondaryButtonText}>Озвучити завдання</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSpeakModelAnswer}>
                <Text style={styles.secondaryButtonText}>Озвучити зразок</Text>
              </TouchableOpacity>
            </View>
          </View>

          {currentExercise.type === 'speaking_voice' ? (
            <View style={styles.audioCard}>
              <Text style={styles.audioCardTitle}>Голосова практика</Text>
              <Text style={styles.audioCardText}>
                Натисни кнопку, скажи фразу англійською і дочекайся транскрипту. Додаток
                автоматично підставить розпізнаний текст, а ти за потреби зможеш його поправити
                перед перевіркою.
              </Text>
              <Text style={styles.audioStatus}>
                {isRecognizingSpeech
                  ? 'Слухаю тебе... говори англійською.'
                  : speechTranscriptFinal
                    ? 'Фінальний транскрипт отримано. Можна перевіряти.'
                    : speechTranscript
                      ? 'Є попередній транскрипт. Можна поправити текст або повторити ще раз.'
                      : speechRecognitionAvailable === false
                        ? 'Speech-to-text недоступний у цьому запуску.'
                        : microphoneGranted === false
                          ? 'Доступ до мікрофона не надано.'
                          : 'Можна починати розпізнавання голосу.'}
              </Text>
              {speechTranscript ? (
                <View style={styles.transcriptCard}>
                  <Text style={styles.transcriptLabel}>Розпізнано з голосу</Text>
                  <Text style={styles.transcriptText}>{speechTranscript}</Text>
                </View>
              ) : null}
              <View style={styles.audioButtonRow}>
                <TouchableOpacity
                  onPress={isRecognizingSpeech ? handleStopRecording : handleStartRecording}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>
                    {isRecognizingSpeech ? 'Зупинити розпізнавання' : 'Почати говорити'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!recordingUri || !speechRecordingSupported}
                  onPress={handlePlayRecording}
                  style={[
                    styles.secondaryButton,
                    (!recordingUri || !speechRecordingSupported) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isPlayingRecording ? 'Програється...' : 'Прослухати себе'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!speechRecordingSupported ? (
                <Text style={styles.audioCardText}>
                  Збереження аудіо на цьому пристрої недоступне, але сам транскрипт може працювати.
                </Text>
              ) : null}
              {speechRecognitionAvailable === false ? (
                <Text style={styles.audioCardText}>
                  Щоб справжній voice-to-text працював стабільно, після цих змін треба зібрати
                  development build.
                </Text>
              ) : null}
            </View>
          ) : null}

          {screenState !== 'sessionEnd' ? (
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>{getAnswerLabel(currentExercise)}</Text>
              {getAnswerSupportText(currentExercise) ? (
                <Text style={styles.inputSupportText}>{getAnswerSupportText(currentExercise)}</Text>
              ) : null}

              {currentExercise.answerFormat === 'choice' && currentExercise.choices ? (
                <View style={styles.choiceList}>
                  {currentExercise.choices.map((choice) => {
                    const isSelected = answer === choice;

                    return (
                      <TouchableOpacity
                        key={choice}
                        onPress={() => setAnswer(choice)}
                        style={[styles.choiceButton, isSelected && styles.choiceButtonActive]}
                      >
                        <Text
                          style={[styles.choiceText, isSelected && styles.choiceTextActive]}
                        >
                          {choice}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  autoCapitalize="none"
                  editable={screenState !== 'checking' && screenState !== 'result'}
                  multiline={currentExercise.answerFormat === 'long_text'}
                  numberOfLines={currentExercise.answerFormat === 'long_text' ? 4 : 1}
                  onChangeText={setAnswer}
                  placeholder={getAnswerPlaceholder(currentExercise)}
                  placeholderTextColor="#6B7280"
                  style={[
                    styles.input,
                    currentExercise.answerFormat === 'long_text' && styles.inputTall,
                  ]}
                  textAlignVertical={currentExercise.answerFormat === 'long_text' ? 'top' : 'center'}
                  value={answer}
                />
              )}

              {screenState === 'question' || screenState === 'checking' ? (
                <TouchableOpacity
                  disabled={screenState === 'checking' || !canSubmit}
                  onPress={handleCheckAnswer}
                  style={[
                    styles.primaryButton,
                    (!canSubmit || screenState === 'checking') && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {screenState === 'checking' ? 'Перевіряю...' : 'Перевірити'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {screenState === 'result' ? (
                <View style={styles.feedbackCard}>
                  <Text
                    style={[
                      styles.feedbackTitle,
                      currentExercise.isCorrect ? styles.successText : styles.errorAccent,
                    ]}
                  >
                    {currentExercise.isCorrect ? 'Правильно' : 'Потрібно ще трохи попрацювати'}
                  </Text>
                  <Text style={styles.feedbackText}>{feedback}</Text>
                  {/* Auto inline explanation for failed speaking_voice */}
                  {currentExercise.type === 'speaking_voice' && !currentExercise.isCorrect ? (
                    <View style={styles.explanationBox}>
                      <Text style={styles.explanationLabel}>🤖 AI-пояснення</Text>
                      {isExplanationLoading ? (
                        <ActivityIndicator color="#A78BFA" size="small" />
                      ) : (
                        <Text style={styles.explanationText}>
                          {detailedExplanation || 'Завантажуємо пояснення...'}
                        </Text>
                      )}
                    </View>
                  ) : null}
                  {currentExercise.explanation ? (
                    <View style={styles.explanationBox}>
                      <Text style={styles.explanationLabel}>Пояснення</Text>
                      <Text style={styles.explanationText}>{currentExercise.explanation}</Text>
                    </View>
                  ) : null}
                  {!currentExercise.isCorrect ? (
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleExplainMore}>
                      <Text style={styles.secondaryButtonText}>Поясни детальніше</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.primaryButton} onPress={handleNextExercise}>
                    <Text style={styles.primaryButtonText}>Наступне завдання</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}

          {screenState === 'sessionEnd' ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Сесію завершено</Text>
              <Text style={styles.summaryValue}>
                {correctCount} / {sessionExercises.length} правильно
              </Text>
              <Text style={styles.summaryText}>
                Результат: {Math.round((correctCount / Math.max(sessionExercises.length, 1)) * 100)}%
              </Text>
              <Text style={styles.summaryText}>Поточний стрик: {userProgress.streak} днів</Text>
              {sessionEndReason ? (
                <Text style={styles.summaryText}>{sessionEndReason}</Text>
              ) : null}
              <TouchableOpacity style={styles.primaryButton} onPress={handleRestartSession}>
                <Text style={styles.primaryButtonText}>Почати нову сесію</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {errorMessage && screenState !== 'sessionEnd' && currentExercise ? (
            <Text style={styles.inlineError}>{errorMessage}</Text>
          ) : null}
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={closeExerciseEditor}
        transparent
        visible={exerciseEditorVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Редагувати завдання</Text>
            <TextInput
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, title: value }))}
              placeholder="Заголовок"
              placeholderTextColor="#6B7280"
              style={styles.modalInput}
              value={exerciseEditorDraft.title}
            />
            <TextInput
              multiline
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, instruction: value }))}
              placeholder="Інструкція"
              placeholderTextColor="#6B7280"
              style={[styles.modalInput, styles.modalInputTall]}
              value={exerciseEditorDraft.instruction}
            />
            <TextInput
              multiline
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, question: value }))}
              placeholder="Питання"
              placeholderTextColor="#6B7280"
              style={[styles.modalInput, styles.modalInputTall]}
              value={exerciseEditorDraft.question}
            />
            <TextInput
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, correctAnswer: value }))}
              placeholder="Правильна відповідь"
              placeholderTextColor="#6B7280"
              style={styles.modalInput}
              value={exerciseEditorDraft.correctAnswer}
            />
            <TextInput
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, topic: value }))}
              placeholder="Тема"
              placeholderTextColor="#6B7280"
              style={styles.modalInput}
              value={exerciseEditorDraft.topic}
            />
            {currentExercise?.answerFormat === 'choice' ? (
              <TextInput
                multiline
                onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, choicesText: value }))}
                placeholder="Варіанти відповіді, кожен з нового рядка"
                placeholderTextColor="#6B7280"
                style={[styles.modalInput, styles.modalInputLarge]}
                value={exerciseEditorDraft.choicesText}
              />
            ) : null}
            <TextInput
              multiline
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, explanation: value }))}
              placeholder="Пояснення"
              placeholderTextColor="#6B7280"
              style={[styles.modalInput, styles.modalInputTall]}
              value={exerciseEditorDraft.explanation}
            />
            <TextInput
              multiline
              onChangeText={(value) => setExerciseEditorDraft((current) => ({ ...current, sampleAnswer: value }))}
              placeholder="Зразок відповіді"
              placeholderTextColor="#6B7280"
              style={[styles.modalInput, styles.modalInputTall]}
              value={exerciseEditorDraft.sampleAnswer}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity onPress={closeExerciseEditor} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleSaveExerciseEdit()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setExplanationModalVisible(false)}
        transparent
        visible={explanationModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Детальніше пояснення</Text>
            {isExplanationLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#7C3AED" size="small" />
                <Text style={styles.modalText}>AI готує пояснення...</Text>
              </View>
            ) : (
              <Text style={styles.modalText}>
                {detailedExplanation || 'Пояснення поки що відсутнє.'}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setExplanationModalVisible(false)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Закрити</Text>
            </TouchableOpacity>
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
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    gap: 20,
    padding: 20,
  },
  header: {
    gap: 10,
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
  counter: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '600',
  },
  accessCard: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  accessTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '800',
  },
  accessText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  focusChip: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  focusChipActive: {
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderColor: '#6366F1',
  },
  focusChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  focusChipTextActive: {
    color: '#818CF8',
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 24,
  },
  stateText: {
    color: '#D1D5DB',
    fontSize: 15,
    textAlign: 'center',
  },
  audioCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    gap: 12,
    padding: 18,
  },
  audioCardTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  audioCardText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 21,
  },
  audioStatus: {
    color: '#C4B5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  audioButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  aiNoticeCard: {
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  aiNoticeTitle: {
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '800',
  },
  aiNoticeText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 19,
  },
  transcriptCard: {
    backgroundColor: '#030712',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  transcriptLabel: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  transcriptText: {
    color: '#F9FAFB',
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    gap: 16,
  },
  inputCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    gap: 14,
    padding: 20,
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '700',
  },
  inputSupportText: {
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: '#030712',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    color: '#F9FAFB',
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputTall: {
    minHeight: 120,
  },
  choiceList: {
    gap: 10,
  },
  choiceButton: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  choiceButtonActive: {
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderColor: '#6366F1',
  },
  choiceText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },
  choiceTextActive: {
    color: '#818CF8',
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 18,
    paddingVertical: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.3)',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
  },
  warningButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  secondaryButtonText: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '700',
  },
  warningButtonText: {
    color: '#FCA5A5',
  },
  feedbackCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  feedbackText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 22,
  },
  explanationBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    gap: 8,
    padding: 14,
  },
  explanationLabel: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  explanationText: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 21,
  },
  successText: {
    color: '#86EFAC',
  },
  errorAccent: {
    color: '#FCA5A5',
  },
  summaryCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  summaryTitle: {
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '800',
  },
  summaryValue: {
    color: '#818CF8',
    fontSize: 32,
    fontWeight: '800',
  },
  summaryText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  errorTitle: {
    color: '#FDE68A',
    fontSize: 20,
    fontWeight: '800',
  },
  errorText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  inlineError: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 20,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 7, 18, 0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    maxWidth: 520,
    padding: 20,
    width: '100%',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalInput: {
    backgroundColor: '#030712',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    color: '#F9FAFB',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalInputTall: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  modalInputLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  modalText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 23,
  },
  modalLoading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  passageCard: {
    backgroundColor: '#0C1E33',
    borderColor: '#1D4ED8',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  passageLabel: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  passageText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 24,
  },
});

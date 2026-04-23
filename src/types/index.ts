export type UserLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type ExerciseCategory = 'vocabulary' | 'grammar' | 'speaking' | 'listening' | 'reading';
export type ExerciseType =
  | 'vocabulary_translation'
  | 'vocabulary_multiple_choice'
  | 'grammar_fill_blank'
  | 'grammar_multiple_choice'
  | 'speaking_text'
  | 'speaking_voice'
  | 'listening_dictation'
  | 'listening_choice'
  | 'reading_comprehension';
export type AnswerFormat = 'text' | 'choice' | 'long_text';
export type PracticeFocus = 'mixed' | 'vocabulary' | 'grammar' | 'speaking' | 'listening' | 'reading';
export type PracticeSessionSource = 'default' | 'mistakes';
export type LearningGoal =
  | 'travel'
  | 'work'
  | 'interview'
  | 'daily_communication'
  | 'movies';
export type PlanItemType =
  | 'new_words'
  | 'review_words'
  | 'grammar'
  | 'speaking'
  | 'mistakes'
  | 'chat';
export type ReviewOutcome = 'again' | 'hard' | 'good' | 'easy';
export type AccessTier = 'standard' | 'vip';
export type AccessFeatureKey = 'practiceExercises' | 'wordReviews' | 'aiChatMessages';

export type AccessUsage = {
  date: string;
  practiceExercises: number;
  wordReviews: number;
  aiChatMessages: number;
};

export type AccessLimits = {
  practiceExercises: number | null;
  wordReviews: number | null;
  aiChatMessages: number | null;
};

export type AccessStatus = {
  tier: AccessTier;
  usage: AccessUsage;
  limits: AccessLimits;
  remaining: AccessLimits;
  vipActivatedAt?: string;
};

export type Exercise = {
  id: string;
  type: ExerciseType;
  category: ExerciseCategory;
  title: string;
  instruction: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  topic: string;
  answerFormat: AnswerFormat;
  explanation?: string;
  choices?: string[];
  sampleAnswer?: string;
  passage?: string;
};

export type Session = {
  id: string;
  date: string;
  exercises: Exercise[];
  score: number;
};

export type UserProgress = {
  level: UserLevel;
  totalExercises: number;
  correctAnswers: number;
  weakTopics: string[];
  streak: number;
  lastStudyDate: string;
  recentResults?: boolean[];
  streakRecord?: number;
  topicMistakes?: Record<string, number>;
  xp?: number;
};

export type LearningProfile = {
  level: UserLevel;
  goal: LearningGoal;
  dailyMinutes: 10 | 15 | 20 | 30;
  preferredFocus: PracticeFocus;
  reviewBatchSize: number;
  newWordsPerSession: number;
  remindersEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
};

export type WordEntry = {
  id: string;
  word: string;
  translation: string;
  example: string;
  topic: string;
  source: 'manual' | 'cache' | 'course' | 'seed' | 'ai';
  stage: number;
  nextReviewDate: string;
  lastReviewedAt: string;
  repetitions: number;
  easeScore: number;
  favorite: boolean;
  mastered: boolean;
  incorrectCount: number;
};

export type CourseWordSeed = {
  word: string;
  translation: string;
  example?: string;
};

export type CourseLesson = {
  id: string;
  title: string;
  description: string;
  focus: PracticeFocus;
  topic: string;
  keywords: CourseWordSeed[];
};

export type Course = {
  id: string;
  title: string;
  description: string;
  goal: LearningGoal;
  focus: PracticeFocus;
  accentColor: string;
  lessons: CourseLesson[];
};

export type CourseProgress = {
  enrolled: boolean;
  completedLessonIds: string[];
};

export type CourseWithProgress = Course & {
  progress: CourseProgress;
};

export type DailyPlanItem = {
  id: string;
  type: PlanItemType;
  title: string;
  description: string;
  target: number;
  completed: boolean;
  focus?: PracticeFocus;
};

export type DailyPlan = {
  date: string;
  items: DailyPlanItem[];
};

export type Badge = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

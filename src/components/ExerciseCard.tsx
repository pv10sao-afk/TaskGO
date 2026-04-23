import { StyleSheet, Text, View } from 'react-native';
import { C } from '../constants/theme';
import type { Exercise } from '../types';

type ExerciseCardProps = {
  exercise: Exercise;
};

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  vocabulary: { label: 'Слова', color: '#818CF8', bg: 'rgba(99,102,241,0.15)' },
  grammar:    { label: 'Граматика', color: '#FCD34D', bg: 'rgba(245,158,11,0.15)' },
  speaking:   { label: 'Speaking', color: '#6EE7B7', bg: 'rgba(16,185,129,0.15)' },
  listening:  { label: 'Слух', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)' },
  reading:    { label: 'Читання', color: '#C084FC', bg: 'rgba(192,132,252,0.15)' },
};

const FORMAT_LABEL: Record<string, string> = {
  choice:    'quiz',
  long_text: 'write',
};

function getDisplayCategory(exercise: Exercise) {
  if (exercise.type.startsWith('listening_')) {
    return 'listening';
  }

  if (exercise.type === 'reading_comprehension') {
    return 'reading';
  }

  return exercise.category;
}

function getDisplayInstruction(exercise: Exercise) {
  if (exercise.type === 'vocabulary_translation') {
    return 'Прочитай слово або фразу українською і впиши англійський переклад.';
  }

  if (exercise.type === 'vocabulary_multiple_choice') {
    return 'Прочитай англійське слово і обери правильний український переклад.';
  }

  if (exercise.type === 'grammar_fill_blank') {
    return 'Прочитай речення і впиши англійське слово, яке правильно заповнює пропуск.';
  }

  if (exercise.type === 'grammar_multiple_choice') {
    return 'Прочитай речення з пропуском і обери англійський варіант, який граматично підходить.';
  }

  if (exercise.type === 'speaking_text') {
    return 'Напиши 1-2 короткі речення англійською по темі нижче.';
  }

  if (exercise.type === 'speaking_voice') {
    return 'Прочитай речення вголос, дочекайся транскрипту і за потреби виправ його перед перевіркою.';
  }

  if (exercise.type === 'listening_choice') {
    return 'Прослухай фразу і обери слово або короткий варіант, який справді звучав у ній.';
  }

  if (exercise.type === 'listening_dictation') {
    return 'Прослухай фразу і впиши її англійською якомога точніше.';
  }

  if (exercise.type === 'reading_comprehension') {
    return 'Прочитай текст вище і дай коротку відповідь англійською за його змістом.';
  }

  return exercise.instruction;
}

function getQuestionPanelContent(exercise: Exercise) {
  if (exercise.type === 'vocabulary_translation') {
    return {
      label: 'Слово або фраза',
      text: exercise.question,
    };
  }

  if (exercise.type === 'vocabulary_multiple_choice') {
    return {
      label: 'Англійське слово',
      text: exercise.question,
    };
  }

  if (exercise.type === 'grammar_fill_blank' || exercise.type === 'grammar_multiple_choice') {
    return {
      label: 'Речення з пропуском',
      text: exercise.question,
    };
  }

  if (exercise.type === 'speaking_text') {
    return {
      label: 'Тема відповіді',
      text: exercise.question,
    };
  }

  if (exercise.type === 'speaking_voice') {
    return {
      label: 'Фраза для вимови',
      text: exercise.question,
    };
  }

  if (exercise.type === 'listening_choice' || exercise.type === 'listening_dictation') {
    return {
      label: 'Аудіофраза',
      text: 'Фраза прихована спеціально. Натисни кнопку нижче й сприймай її на слух.',
    };
  }

  if (exercise.type === 'reading_comprehension') {
    return {
      label: 'Питання до тексту',
      text: exercise.question,
    };
  }

  return {
    label: 'Завдання',
    text: exercise.question,
  };
}

function getAnswerHint(exercise: Exercise) {
  if (exercise.type === 'vocabulary_translation') {
    return 'Впиши англійський переклад.';
  }

  if (exercise.type === 'vocabulary_multiple_choice') {
    return 'Обери правильний український переклад.';
  }

  if (exercise.type === 'grammar_fill_blank') {
    return 'Впиши слово, яке підходить у пропуск.';
  }

  if (exercise.type === 'grammar_multiple_choice') {
    return 'Обери варіант, який граматично підходить у пропуск.';
  }

  if (exercise.type === 'speaking_text') {
    return 'Напиши 1-3 речення англійською.';
  }

  if (exercise.type === 'speaking_voice') {
    return 'Скажи речення вголос і перевір розпізнаний текст.';
  }

  if (exercise.type === 'listening_choice') {
    return 'Обери слово або короткий варіант, який був у фразі.';
  }

  if (exercise.type === 'listening_dictation') {
    return 'Після прослуховування впиши всю фразу англійською.';
  }

  if (exercise.type === 'reading_comprehension') {
    return 'Дай коротку відповідь англійською, наприклад: Sarah works as a freelance writer.';
  }

  return exercise.answerFormat === 'choice'
    ? 'Оберіть один варіант.'
    : exercise.answerFormat === 'long_text'
      ? 'Напишіть 1–3 речення англійською.'
      : 'Введіть коротку відповідь.';
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const displayCategory = getDisplayCategory(exercise);
  const cat = CATEGORY_MAP[displayCategory] ?? { label: displayCategory, color: C.accentLight, bg: C.accentDim };
  const formatLabel = FORMAT_LABEL[exercise.answerFormat] ?? 'short';
  const answerHint = getAnswerHint(exercise);
  const questionPanel = getQuestionPanelContent(exercise);

  return (
    <View style={styles.card}>
      {/* Accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: cat.color }]} />

      <View style={styles.header}>
        <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
          <Text style={[styles.categoryText, { color: cat.color }]}>{cat.label}</Text>
        </View>
        <Text style={styles.topic}>{exercise.topic.replace(/_/g, ' ')}</Text>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{exercise.title}</Text>
        <Text style={styles.instruction}>{getDisplayInstruction(exercise)}</Text>
      </View>

      <View style={styles.questionPanel}>
        <Text style={styles.questionLabel}>{questionPanel.label}</Text>
        <Text style={styles.question}>{questionPanel.text}</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.hint}>{answerHint}</Text>
        <View style={[styles.formatBadge, { backgroundColor: cat.bg }]}>
          <Text style={[styles.formatBadgeText, { color: cat.color }]}>{formatLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderRadius: C.r.xl,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 22,
    position: 'relative',
  },
  accentStrip: {
    borderRadius: 999,
    height: 130,
    opacity: 0.15,
    position: 'absolute',
    right: -30,
    top: -40,
    width: 130,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryPill: {
    borderRadius: C.r.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  topic: {
    color: C.textSub,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  titleWrap: { gap: 6 },
  title: { color: C.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  instruction: { color: C.textSub, fontSize: 14, lineHeight: 20 },
  questionPanel: {
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderRadius: C.r.lg,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  questionLabel: {
    color: C.accentLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  question: { color: C.text, fontSize: 24, fontWeight: '700', lineHeight: 32 },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  hint: { color: C.textMuted, fontSize: 13, lineHeight: 19, flex: 1 },
  formatBadge: {
    borderRadius: C.r.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  formatBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});

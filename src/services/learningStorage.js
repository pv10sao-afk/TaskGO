import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_SESSIONS_KEY = '@chatSessions';
const SCANNED_TASKS_KEY = '@scannedTasks';
const MISTAKES_KEY = '@mistakesBank';
const CUSTOM_WORDS_KEY = '@customVocabulary';

const readList = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(`Failed to read ${key}`, error);
    return [];
  }
};

const writeList = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key}`, error);
  }
};

export const getChatSessions = () => readList(CHAT_SESSIONS_KEY);

export const saveChatSession = async (session) => {
  if (!session?.messages?.length) return;
  const sessions = await getChatSessions();
  const nextSession = {
    ...session,
    id: session.id || Date.now().toString(),
    updatedAt: new Date().toISOString(),
  };
  const filtered = sessions.filter(item => item.id !== nextSession.id);
  await writeList(CHAT_SESSIONS_KEY, [nextSession, ...filtered].slice(0, 12));
};

export const getScannedTasks = () => readList(SCANNED_TASKS_KEY);

export const saveScannedTask = async (task) => {
  const tasks = await getScannedTasks();
  const nextTask = {
    ...task,
    id: task.id || Date.now().toString(),
    updatedAt: new Date().toISOString(),
  };
  const filtered = tasks.filter(item => item.id !== nextTask.id);
  await writeList(SCANNED_TASKS_KEY, [nextTask, ...filtered].slice(0, 20));
};

export const getMistakes = () => readList(MISTAKES_KEY);

export const saveMistake = async (mistake) => {
  if (!mistake?.source && !mistake?.prompt) return;
  const mistakes = await getMistakes();
  const nextMistake = {
    ...mistake,
    id: mistake.id || Date.now().toString(),
    createdAt: mistake.createdAt || new Date().toISOString(),
  };
  await writeList(MISTAKES_KEY, [nextMistake, ...mistakes].slice(0, 50));
};

export const clearMistake = async (mistakeId) => {
  const mistakes = await getMistakes();
  await writeList(MISTAKES_KEY, mistakes.filter(item => item.id !== mistakeId));
};

export const getCustomVocabulary = () => readList(CUSTOM_WORDS_KEY);

export const saveCustomVocabulary = async (word) => {
  if (!word?.word) return;
  const words = await getCustomVocabulary();
  const normalisedWord = word.word.trim();
  const nextWord = {
    id: word.id || `custom-${Date.now()}`,
    word: normalisedWord,
    meaning: word.meaning || 'Imported by you',
    translation: word.translation || '',
    level: word.level || 'Custom',
    difficulty: word.difficulty || 2,
    examples: word.examples || [],
    learned: false,
    importedAt: word.importedAt || new Date().toISOString(),
  };
  const filtered = words.filter(item => item.word.toLowerCase() !== normalisedWord.toLowerCase());
  await writeList(CUSTOM_WORDS_KEY, [nextWord, ...filtered].slice(0, 100));
};

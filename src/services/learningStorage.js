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

const normaliseVocabularyCard = (word, defaults = {}) => {
  const normalisedWord = String(word?.word || '').trim();
  if (!normalisedWord) return null;

  return {
    id: word.id || `custom-${Date.now()}-${normalisedWord.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    word: normalisedWord,
    meaning: word.meaning || word.definition || 'Imported by you',
    translation: word.translation || word.ukrainian || '',
    level: word.level || defaults.level || 'Custom',
    difficulty: Number(word.difficulty || defaults.difficulty || 2),
    examples: Array.isArray(word.examples) ? word.examples : [],
    partOfSpeech: word.partOfSpeech || word.part_of_speech || '',
    ipa: word.ipa || word.pronunciation || '',
    imageUrl: word.imageUrl || word.image_url || '',
    imagePrompt: word.imagePrompt || word.image_prompt || '',
    deck: word.deck || defaults.deck || 'AI Import',
    tags: Array.isArray(word.tags) ? word.tags : [],
    learned: false,
    importedAt: word.importedAt || new Date().toISOString(),
  };
};

export const saveCustomVocabulary = async (word) => {
  const nextWord = normaliseVocabularyCard(word);
  if (!nextWord) return;

  const words = await getCustomVocabulary();
  const filtered = words.filter(item => item.word.toLowerCase() !== nextWord.word.toLowerCase());
  await writeList(CUSTOM_WORDS_KEY, [nextWord, ...filtered].slice(0, 300));
};

export const importVocabularyDeck = async (rawDeck) => {
  const parsed = typeof rawDeck === 'string' ? JSON.parse(rawDeck) : rawDeck;
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) {
    throw new Error('Vocabulary JSON must be an array or an object with a cards array.');
  }

  const defaults = {
    deck: parsed.deck || parsed.title || 'AI Import',
    level: parsed.level || 'Custom',
    difficulty: parsed.difficulty || 2,
  };
  const normalisedCards = cards
    .map(card => normaliseVocabularyCard(card, defaults))
    .filter(Boolean);

  if (normalisedCards.length === 0) {
    throw new Error('No valid cards found. Each card needs at least a word field.');
  }

  const existingWords = await getCustomVocabulary();
  const merged = [...normalisedCards, ...existingWords].reduce((acc, item) => {
    const key = item.word.toLowerCase();
    if (!acc.some(existing => existing.word.toLowerCase() === key)) {
      acc.push(item);
    }
    return acc;
  }, []);

  await writeList(CUSTOM_WORDS_KEY, merged.slice(0, 300));
  return normalisedCards.length;
};

export const LESSONS_DB = [
  {
    id: 1,
    title: 'Basic Introductions',
    level: 'A1',
    description: 'Learn how to introduce yourself and others in simple English.',
    prompt: 'You are a friendly neighbor meeting the user for the first time. Keep your language very simple, using only present simple tense and basic greetings. Ask for their name and where they are from.',
    vocabIds: [1],
    category: 'Roleplay'
  },
  {
    id: 2,
    title: 'Grammar Basics',
    level: 'A1',
    description: 'Learn basic grammar rules.',
    category: 'Grammar',
    exercises: [
      {
        type: 'multiple_choice',
        question: 'I ___ an apple every morning.',
        options: ['eat', 'eats', 'eating'],
        correct_answer: 'eat'
      },
      {
        type: 'sentence_builder',
        question: 'Translate: Я люблю каву.',
        words: ['coffee.', 'I', 'love', 'tea.'],
        correct_order: ['I', 'love', 'coffee.']
      },
      {
        type: 'translation',
        question: 'Translate: Яблуко',
        correct_answer: 'Apple'
      }
    ]
  },
  {
    id: 3,
    title: 'At the Coffee Shop',
    level: 'A2',
    description: 'Practice ordering coffee and interacting with a barista.',
    prompt: 'You are a busy barista in a popular London coffee shop. Act a bit rushed but polite. Use coffee-related vocabulary (latte, espresso, take-away, etc.). Ask the user what they want and if they want any snacks.',
    vocabIds: [2],
    category: 'Roleplay'
  }
];

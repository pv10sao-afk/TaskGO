import { AI_MODEL, AI_PROVIDER, GROQ_API_KEY } from '../constants/config';

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function askAI(prompt: string): Promise<string> {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new Error('Prompt for AI cannot be empty.');
  }

  if (!GROQ_API_KEY) {
    throw new Error('Set EXPO_PUBLIC_GROQ_API_KEY before calling askAI.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: normalizedPrompt,
        },
      ],
    }),
  });

  const data = (await response.json()) as GroqResponse;

  if (!response.ok) {
    const errorMessage =
      data.error?.message ??
      `${AI_PROVIDER} request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error(`${AI_PROVIDER} returned an empty response.`);
  }

  return text;
}

export const askGemini = askAI;

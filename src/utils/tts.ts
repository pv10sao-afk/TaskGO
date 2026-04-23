/**
 * Thin wrapper навколо react-native-tts
 * з тим самим API що expo-speech — щоб мінімально змінювати код екранів.
 */
import Tts from 'react-native-tts';

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  try {
    await Tts.getInitStatus();
    initialized = true;
  } catch {
    // Деякі пристрої ініціалізуються автоматично — ігноруємо
    initialized = true;
  }
}

export interface SpeakOptions {
  language?: string;
  rate?: number;
  pitch?: number;
}

/**
 * Читає текст голосом.
 * language — напр. 'en-US'
 * rate — 0.0–1.0 (expo-speech) → 0.0–0.5 (react-native-tts uses a different scale)
 */
export async function speak(text: string, options?: SpeakOptions): Promise<void> {
  try {
    await ensureInit();

    if (options?.language) {
      Tts.setDefaultLanguage(options.language);
    }

    // expo-speech rate: 0.85 → react-native-tts defaultRate ~0.5
    if (options?.rate !== undefined) {
      Tts.setDefaultRate(options.rate * 0.6);
    }

    if (options?.pitch !== undefined) {
      Tts.setDefaultPitch(options.pitch);
    }

    Tts.speak(text);
  } catch {
    // ігноруємо — TTS може бути недоступний на пристрої
  }
}

/**
 * Зупиняє поточне озвучення.
 */
export function stop(): void {
  try {
    Tts.stop();
  } catch {
    // ігноруємо
  }
}

/**
 * Thin wrapper навколо react-native-haptic-feedback
 * з тим самим API що expo-haptics — щоб мінімально змінювати код екранів.
 */
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ── Enums (імітуємо expo-haptics) ──────────────────────────────────────────

export const ImpactFeedbackStyle = {
  Light: 'impactLight',
  Medium: 'impactMedium',
  Heavy: 'impactHeavy',
} as const;

export const NotificationFeedbackType = {
  Success: 'notificationSuccess',
  Warning: 'notificationWarning',
  Error: 'notificationError',
} as const;

type ImpactStyle = (typeof ImpactFeedbackStyle)[keyof typeof ImpactFeedbackStyle];
type NotificationType = (typeof NotificationFeedbackType)[keyof typeof NotificationFeedbackType];

// ── Functions ───────────────────────────────────────────────────────────────

export function impactAsync(style: ImpactStyle = ImpactFeedbackStyle.Medium): Promise<void> {
  try {
    ReactNativeHapticFeedback.trigger(style, OPTIONS);
  } catch {
    // Ігноруємо — деякі пристрої не підтримують вібрацію
  }
  return Promise.resolve();
}

export function selectionAsync(): Promise<void> {
  try {
    ReactNativeHapticFeedback.trigger('selection', OPTIONS);
  } catch {
    // ігноруємо
  }
  return Promise.resolve();
}

export function notificationAsync(type: NotificationType = NotificationFeedbackType.Success): Promise<void> {
  try {
    ReactNativeHapticFeedback.trigger(type, OPTIONS);
  } catch {
    // ігноруємо
  }
  return Promise.resolve();
}

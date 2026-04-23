import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

import type { AccessFeatureKey, AccessStatus, AccessTier, AccessUsage } from '../types';
import { formatLocalDateKey, formatLocalDateTime } from '../utils/date';

const ACCESS_STATE_KEY = 'langai:access-state';
export const ACCESS_STATUS_EVENT = 'access-status-updated';

export const VIP_ACCESS_CODE = 'LANGAI-VIP-ORBIT-2026';
export const FREE_DAILY_LIMITS = {
  practiceExercises: 12,
  wordReviews: 20,
  aiChatMessages: 8,
} as const;

type StoredAccessState = {
  tier?: AccessTier;
  usage?: Partial<AccessUsage>;
  vipActivatedAt?: string;
};

type NormalizedAccessState = {
  tier: AccessTier;
  usage: AccessUsage;
  vipActivatedAt?: string;
};

function createEmptyUsage(date = formatLocalDateKey()): AccessUsage {
  return {
    date,
    practiceExercises: 0,
    wordReviews: 0,
    aiChatMessages: 0,
  };
}

function normalizeUsage(value: Partial<AccessUsage> | undefined): AccessUsage {
  const today = formatLocalDateKey();

  if (!value || value.date !== today) {
    return createEmptyUsage(today);
  }

  return {
    date: today,
    practiceExercises:
      typeof value.practiceExercises === 'number' ? Math.max(0, Math.round(value.practiceExercises)) : 0,
    wordReviews:
      typeof value.wordReviews === 'number' ? Math.max(0, Math.round(value.wordReviews)) : 0,
    aiChatMessages:
      typeof value.aiChatMessages === 'number' ? Math.max(0, Math.round(value.aiChatMessages)) : 0,
  };
}

async function readAccessState(): Promise<NormalizedAccessState> {
  const raw = await AsyncStorage.getItem(ACCESS_STATE_KEY);

  if (!raw) {
    return {
      tier: 'standard',
      usage: createEmptyUsage(),
      vipActivatedAt: undefined,
    };
  }

  try {
    const parsed = JSON.parse(raw) as StoredAccessState;
    return {
      tier: parsed.tier === 'vip' ? 'vip' : 'standard',
      usage: normalizeUsage(parsed.usage),
      vipActivatedAt: typeof parsed.vipActivatedAt === 'string' ? parsed.vipActivatedAt : undefined,
    };
  } catch {
    return {
      tier: 'standard',
      usage: createEmptyUsage(),
      vipActivatedAt: undefined,
    };
  }
}

async function saveAccessState(state: StoredAccessState) {
  await AsyncStorage.setItem(ACCESS_STATE_KEY, JSON.stringify(state));
  DeviceEventEmitter.emit(ACCESS_STATUS_EVENT);
}

function getRemainingValue(tier: AccessTier, feature: AccessFeatureKey, usage: AccessUsage) {
  if (tier === 'vip') {
    return null;
  }

  return Math.max(0, FREE_DAILY_LIMITS[feature] - usage[feature]);
}

function buildAccessStatus(state: NormalizedAccessState): AccessStatus {
  return {
    tier: state.tier,
    usage: state.usage,
    limits: {
      practiceExercises: state.tier === 'vip' ? null : FREE_DAILY_LIMITS.practiceExercises,
      wordReviews: state.tier === 'vip' ? null : FREE_DAILY_LIMITS.wordReviews,
      aiChatMessages: state.tier === 'vip' ? null : FREE_DAILY_LIMITS.aiChatMessages,
    },
    remaining: {
      practiceExercises: getRemainingValue(state.tier, 'practiceExercises', state.usage),
      wordReviews: getRemainingValue(state.tier, 'wordReviews', state.usage),
      aiChatMessages: getRemainingValue(state.tier, 'aiChatMessages', state.usage),
    },
    vipActivatedAt: state.vipActivatedAt,
  };
}

export async function getAccessStatus(): Promise<AccessStatus> {
  const state = await readAccessState();

  if (state.usage.date !== formatLocalDateKey()) {
    const nextState: NormalizedAccessState = {
      ...state,
      usage: createEmptyUsage(),
    };
    await saveAccessState(nextState);
    return buildAccessStatus(nextState);
  }

  return buildAccessStatus(state);
}

export function getFeatureLimitMessage(feature: AccessFeatureKey) {
  if (feature === 'practiceExercises') {
    return 'Ліміт звичайного доступу на вправи на сьогодні вичерпано. Відкрий меню Підписка, щоб активувати VIP і зняти ліміти.';
  }

  if (feature === 'wordReviews') {
    return 'Ліміт звичайного доступу на повторення слів на сьогодні вичерпано. Відкрий меню Підписка, щоб активувати VIP і зняти ліміти.';
  }

  return 'Ліміт звичайного доступу на AI-чат на сьогодні вичерпано. Відкрий меню Підписка, щоб активувати VIP і зняти ліміти.';
}

export async function ensureFeatureAvailable(feature: AccessFeatureKey) {
  const status = await getAccessStatus();

  if (status.tier === 'vip') {
    return status;
  }

  const remaining = status.remaining[feature] ?? 0;

  if (remaining <= 0) {
    throw new Error(getFeatureLimitMessage(feature));
  }

  return status;
}

export async function consumeFeatureUsage(feature: AccessFeatureKey, amount = 1): Promise<AccessStatus> {
  const state = await readAccessState();

  if (state.tier === 'vip') {
    return buildAccessStatus(state);
  }

  const nextUsage: AccessUsage = {
    ...state.usage,
    [feature]: state.usage[feature] + Math.max(1, Math.round(amount)),
  };
  const nextState: NormalizedAccessState = {
    ...state,
    usage: nextUsage,
  };

  await saveAccessState(nextState);
  return buildAccessStatus(nextState);
}

export async function unlockVipAccess(code: string): Promise<AccessStatus> {
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    throw new Error('Введи код-слово, щоб активувати VIP.');
  }

  if (normalized !== VIP_ACCESS_CODE) {
    throw new Error('Неправильний код-слово. Перевір написання ще раз.');
  }

  const current = await readAccessState();
  const nextState: StoredAccessState = {
    tier: 'vip',
    usage: normalizeUsage(current.usage),
    vipActivatedAt: current.vipActivatedAt ?? formatLocalDateTime(),
  };

  await saveAccessState(nextState);
  return buildAccessStatus({
    tier: 'vip',
    usage: normalizeUsage(nextState.usage),
    vipActivatedAt: nextState.vipActivatedAt,
  });
}

import { useEffect, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from '../utils/haptics';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';

import { ACCESS_STATUS_EVENT, getAccessStatus, unlockVipAccess } from '../services/access';
import type { AccessFeatureKey, AccessStatus } from '../types';

type AccessCardConfig = {
  key: AccessFeatureKey;
  title: string;
  icon: string;
  accent: string;
  tint: string;
};

const ACCESS_CARDS: AccessCardConfig[] = [
  {
    key: 'practiceExercises',
    title: 'Практика',
    icon: 'lightning-bolt',
    accent: '#58CC02',
    tint: '#F0FCD2',
  },
  {
    key: 'wordReviews',
    title: 'Флеш-картки',
    icon: 'cards-outline',
    accent: '#1CB0F6',
    tint: '#DFF6FF',
  },
  {
    key: 'aiChatMessages',
    title: 'AI-чат',
    icon: 'chat-processing-outline',
    accent: '#FF9600',
    tint: '#FFF0D7',
  },
];

const VIP_BENEFITS = [
  {
    title: 'Безлімітна практика',
    text: 'Роби вправи хоч серіями, хоч довгими сесіями без щоденного стопа.',
    icon: 'rocket-launch-outline' as const,
    accent: '#58CC02',
  },
  {
    title: 'Безлімітні слова',
    text: 'Гортай картки жестами і повторюй словник стільки, скільки хочеш.',
    icon: 'cards-heart-outline' as const,
    accent: '#1CB0F6',
  },
  {
    title: 'Живі діалоги з AI',
    text: 'Спілкуйся довше і без думок про те, що ліміт повідомлень уже близько.',
    icon: 'message-badge-outline' as const,
    accent: '#FF9600',
  },
];

function getFeatureValue(accessStatus: AccessStatus | null, key: AccessFeatureKey) {
  if (!accessStatus) {
    return '...';
  }

  if (accessStatus.tier === 'vip') {
    return '∞';
  }

  return `${accessStatus.remaining[key] ?? 0}`;
}

function getFeatureUsage(accessStatus: AccessStatus | null, key: AccessFeatureKey) {
  if (!accessStatus) {
    return { used: 0, limit: 1, progress: 0 };
  }

  if (accessStatus.tier === 'vip') {
    return { used: 0, limit: 1, progress: 1 };
  }

  const limit = accessStatus.limits[key] ?? 1;
  const used = accessStatus.usage[key];
  const progress = Math.max(0, Math.min(1, 1 - used / Math.max(limit, 1)));

  return { used, limit, progress };
}

export function SubscriptionScreen() {
  const isFocused = useIsFocused();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [vipCode, setVipCode] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadAccessStatus() {
      const nextAccessStatus = await getAccessStatus();

      if (isActive) {
        setAccessStatus(nextAccessStatus);
      }
    }

    if (isFocused) {
      void loadAccessStatus();
    }

    const subscription = DeviceEventEmitter.addListener(ACCESS_STATUS_EVENT, () => {
      void loadAccessStatus();
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [isFocused]);

  async function handleUnlockVip() {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const nextAccessStatus = await unlockVipAccess(vipCode);
      setAccessStatus(nextAccessStatus);
      setVipCode('');
      Alert.alert('VIP активовано', 'Безлімітний доступ успішно розблоковано на цьому пристрої.');
    } catch (error) {
      Alert.alert('Не вдалося активувати VIP', error instanceof Error ? error.message : 'Спробуй ще раз.');
    }
  }

  const isVip = accessStatus?.tier === 'vip';

  return (
    <ScrollView contentContainerStyle={styles.container} style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{isVip ? 'VIP ACTIVE' : 'FREE PLAN'}</Text>
        </View>

        <View style={styles.heroTopRow}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.eyebrow}>Super LangAI</Text>
            <Text style={styles.title}>Керуй доступом як у грі, а не як у сухому меню</Text>
            <Text style={styles.subtitle}>
              Великі картки, зрозумілі ліміти і окремий VIP-екран, який не звалює все в один ряд.
            </Text>
          </View>

          <View style={styles.mascotBubble}>
            <Text style={styles.mascotEmoji}>{isVip ? '👑' : '🚀'}</Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <Text style={styles.heroFooterTitle}>
            {isVip ? 'У тебе безлімітний доступ' : 'На сьогодні доступ ще відкритий'}
          </Text>
          <Text style={styles.heroFooterText}>
            {isVip
              ? accessStatus?.vipActivatedAt
                ? `VIP активовано з ${accessStatus.vipActivatedAt}`
                : 'Ліміти для вправ, слів і чату вже зняті.'
              : 'Нижче видно, скільки залишилось для практики, карток і AI-чату.'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Щоденний доступ</Text>
        <Text style={styles.sectionText}>Тепер усе показано вертикально, щоб було легко читати на телефоні.</Text>

        <View style={styles.accessCardList}>
          {ACCESS_CARDS.map((item) => {
            const usage = getFeatureUsage(accessStatus, item.key);

            return (
              <View key={item.key} style={styles.accessCard}>
                <View style={styles.accessCardTop}>
                  <View style={[styles.accessIconWrap, { backgroundColor: item.tint }]}>
                    <MaterialCommunityIcons color={item.accent} name={item.icon as any} size={24} />
                  </View>

                  <View style={styles.accessTextWrap}>
                    <Text style={styles.accessTitle}>{item.title}</Text>
                    <Text style={styles.accessSubtext}>
                      {isVip ? 'Без денного обмеження' : `Залишилось сьогодні: ${getFeatureValue(accessStatus, item.key)}`}
                    </Text>
                  </View>

                  <View style={[styles.accessCountPill, { backgroundColor: item.tint }]}>
                    <Text style={[styles.accessCountText, { color: item.accent }]}>{getFeatureValue(accessStatus, item.key)}</Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${usage.progress * 100}%`, backgroundColor: item.accent }]} />
                </View>

                <Text style={styles.progressMeta}>
                  {isVip ? 'З VIP ця активність доступна без денного ліміту.' : `Використано ${usage.used} з ${usage.limit} на сьогодні.`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Що дає VIP</Text>
        <View style={styles.benefitStack}>
          {VIP_BENEFITS.map((benefit, index) => (
            <View
              key={benefit.title}
              style={[
                styles.benefitCard,
                index === 0 ? styles.benefitCardGreen : index === 1 ? styles.benefitCardBlue : styles.benefitCardOrange,
              ]}
            >
              <View style={[styles.benefitIconWrap, { backgroundColor: benefit.accent }]}>
                <MaterialCommunityIcons color="#FFFFFF" name={benefit.icon} size={22} />
              </View>
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaEyebrow}>{isVip ? 'Unlocked' : 'Unlock VIP'}</Text>
        <Text style={styles.ctaTitle}>
          {isVip ? 'Усе вже відкрито' : 'Введи код і відкрий безлімітний режим'}
        </Text>
        <Text style={styles.ctaText}>
          {isVip
            ? 'Екран підписки залишається окремим центром керування доступом.'
            : 'Одна дія і більше не треба дивитися, скільки ще лишилось на сьогодні.'}
        </Text>

        {isVip ? (
          <View style={styles.vipActiveBox}>
            <MaterialCommunityIcons color="#58CC02" name="check-decagram" size={24} />
            <View style={styles.vipActiveTextWrap}>
              <Text style={styles.vipActiveTitle}>VIP уже працює</Text>
              <Text style={styles.vipActiveText}>Вправи, слова і AI-чат зараз без денних лімітів.</Text>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              autoCapitalize="characters"
              onChangeText={setVipCode}
              placeholder="Введи код-слово для VIP"
              placeholderTextColor="#94A3B8"
              style={styles.vipInput}
              value={vipCode}
            />
            <TouchableOpacity activeOpacity={0.9} style={styles.primaryButton} onPress={() => void handleUnlockVip()}>
              <Text style={styles.primaryButtonText}>Активувати VIP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#111B21',
    flex: 1,
  },
  container: {
    gap: 18,
    padding: 18,
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: '#58CC02',
    borderBottomWidth: 6,
    borderColor: '#46A302',
    borderRadius: 30,
    gap: 18,
    overflow: 'hidden',
    padding: 22,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  heroTextWrap: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: '#E8FFD2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 33,
  },
  subtitle: {
    color: '#F3FFE8',
    fontSize: 15,
    lineHeight: 22,
  },
  mascotBubble: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  mascotEmoji: {
    fontSize: 34,
  },
  heroFooter: {
    backgroundColor: 'rgba(10,54,0,0.16)',
    borderRadius: 22,
    gap: 6,
    padding: 16,
  },
  heroFooterTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  heroFooterText: {
    color: '#F3FFE8',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#1F2A33',
    borderBottomWidth: 5,
    borderColor: '#161F26',
    borderRadius: 26,
    gap: 14,
    padding: 18,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  sectionText: {
    color: '#B6C2CF',
    fontSize: 14,
    lineHeight: 20,
  },
  accessCardList: {
    gap: 12,
  },
  accessCard: {
    backgroundColor: '#131C24',
    borderRadius: 22,
    gap: 12,
    padding: 16,
  },
  accessCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  accessIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  accessTextWrap: {
    flex: 1,
    gap: 3,
  },
  accessTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  accessSubtext: {
    color: '#AEB9C6',
    fontSize: 13,
    lineHeight: 18,
  },
  accessCountPill: {
    borderRadius: 999,
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accessCountText: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  progressTrack: {
    backgroundColor: '#2E3A45',
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  progressMeta: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  benefitStack: {
    gap: 12,
  },
  benefitCard: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  benefitCardGreen: {
    backgroundColor: '#15311F',
  },
  benefitCardBlue: {
    backgroundColor: '#112737',
  },
  benefitCardOrange: {
    backgroundColor: '#33220F',
  },
  benefitIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  benefitCopy: {
    flex: 1,
    gap: 4,
  },
  benefitTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  benefitText: {
    color: '#D7E0E8',
    fontSize: 14,
    lineHeight: 20,
  },
  ctaCard: {
    backgroundColor: '#FFF7E7',
    borderBottomWidth: 6,
    borderColor: '#E7D4A9',
    borderRadius: 28,
    gap: 14,
    padding: 20,
  },
  ctaEyebrow: {
    color: '#A35F00',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  ctaTitle: {
    color: '#4B2E04',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
  },
  ctaText: {
    color: '#7C5A21',
    fontSize: 14,
    lineHeight: 20,
  },
  vipInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7D4A9',
    borderRadius: 18,
    borderWidth: 2,
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#58CC02',
    borderBottomWidth: 4,
    borderColor: '#46A302',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  vipActiveBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  vipActiveTextWrap: {
    flex: 1,
    gap: 2,
  },
  vipActiveTitle: {
    color: '#224B08',
    fontSize: 16,
    fontWeight: '900',
  },
  vipActiveText: {
    color: '#4F5B67',
    fontSize: 14,
    lineHeight: 19,
  },
});

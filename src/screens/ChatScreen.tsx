import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from '../utils/haptics';
import Voice from '@react-native-voice/voice';
import { PermissionsAndroid } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { getAccessStatus } from '../services/access';
import {
  clearChatHistory,
  getChatHistory,
  getLearningProfile,
  sendChatMessage,
} from '../services/learningHub';
import { getUserProgress } from '../services/storage';
import type { AccessStatus, ChatMessage, LearningProfile, UserProgress } from '../types';
import { C } from '../constants/theme';

const QUICK_PROMPTS = [
  'Let us talk about my day.',
  'Ask me 3 interview questions.',
  'Practice travel English with me.',
];

function getChatAccessText(accessStatus: AccessStatus | null) {
  if (!accessStatus) return 'Перевіряємо доступ до AI-чату...';
  if (accessStatus.tier === 'vip') return 'VIP активний: AI-чат без денного ліміту.';
  return `Залишилось AI-запитів сьогодні: ${accessStatus.remaining.aiChatMessages ?? 0}`;
}

export function ChatScreen() {
  const isFocused = useIsFocused();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;
  const micPulseAnim = useRef(new Animated.Value(1)).current;

  // Mic pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(micPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      micPulseAnim.setValue(1);
    }
  }, [isRecording, micPulseAnim]);

  // Auto-scroll to bottom when new messages arrive or AI starts typing
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (isLoading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isLoading, dotAnim]);

  useEffect(() => {
    let isActive = true;

    async function load() {
      const [nextProfile, nextProgress, nextMessages] = await Promise.all([
        getLearningProfile(),
        getUserProgress(),
        getChatHistory(),
      ]);
      const nextAccessStatus = await getAccessStatus();

      if (!isActive) return;
      setProfile(nextProfile);
      setProgress(nextProgress);
      setAccessStatus(nextAccessStatus);
      setMessages(nextMessages);
      setAiError(null);
    }

    if (isFocused) void load();
    return () => { isActive = false; };
  }, [isFocused]);

  // Check mic availability once on mount
  useEffect(() => {
    let mounted = true;

    async function checkMic() {
      try {
        const available = await Voice.isAvailable();
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (mounted) setMicAvailable(Boolean(available) && granted);
        } else {
          if (mounted) setMicAvailable(Boolean(available));
        }
      } catch {
        if (mounted) setMicAvailable(false);
      }
    }

    void checkMic();

    // Register speech listeners
    Voice.onSpeechResults = (event: any) => {
      const text = event.value?.[0]?.trim() ?? '';
      if (text) setDraft(text);
    };
    Voice.onSpeechPartialResults = (event: any) => {
      const text = event.value?.[0]?.trim() ?? '';
      if (text) setDraft(text);
    };
    Voice.onSpeechEnd = () => setIsRecording(false);
    Voice.onSpeechError = () => setIsRecording(false);

    return () => {
      mounted = false;
      try { void Voice.destroy(); } catch {}
    };
  }, []);

    const isLimited = Boolean(
      accessStatus &&
      accessStatus.tier !== 'vip' &&
      (accessStatus.remaining.aiChatMessages ?? 0) <= 0
    );

  async function handleToggleMic() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isRecording) {
      try { await Voice.stop(); } catch {}
      setIsRecording(false);
      return;
    }

    // Request permission if not yet granted
    if (!micAvailable) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Доступ до мікрофона',
            message: 'Дозволь доступ до мікрофона для голосового вводу.',
            buttonPositive: 'Дозволити',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Мікрофон', 'Дозволь доступ до мікрофона у налаштуваннях.');
          return;
        }
        setMicAvailable(true);
      } catch {
        Alert.alert('Мікрофон', 'Голосовий ввід недоступний на цьому пристрої.');
        return;
      }
    }

    try {
      setDraft('');
      setIsRecording(true);
      await Voice.start('en-US');
    } catch {
      setIsRecording(false);
      Alert.alert('Помилка', 'Не вдалося запустити розпізнавання.');
    }
  }

  async function handleSendMessage(text = draft) {
    if (!text.trim() || !profile || !progress || isLoading || isLimited) return;

    await Haptics.selectionAsync();
    setIsLoading(true);
    setDraft('');
    setAiError(null);

    try {
      const result = await sendChatMessage(text, profile, progress);
      setMessages(result.messages);
      setAiError(result.aiError);
      setAccessStatus(await getAccessStatus());
    } catch (error) {
      setDraft(text);
      setAiError(error instanceof Error ? error.message : 'Не вдалося відправити повідомлення.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClearHistory() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Очистити чат?', 'Історія діалогу буде видалена.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Очистити',
        style: 'destructive',
        onPress: async () => {
          await clearChatHistory();
          setMessages([]);
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        style={styles.scroll}
      >

        {/* ── HERO ── */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>AI Chat</Text>
          <Text style={styles.heroTitle}>Практикуй живий діалог</Text>
          <Text style={styles.heroSub}>Бот відповідає англійською та пояснює українською.</Text>
        </View>

        {/* ── ACCESS STATUS ── */}
        <View style={[
          styles.accessCard,
          accessStatus?.tier === 'vip'
            ? { borderColor: 'rgba(192,132,252,0.4)', backgroundColor: 'rgba(192,132,252,0.08)' }
            : { borderColor: C.cardBorder, backgroundColor: C.card },
        ]}>
          <View style={styles.accessRow}>
            <MaterialCommunityIcons
              name={accessStatus?.tier === 'vip' ? 'crown' : 'information-outline'}
              size={18}
              color={accessStatus?.tier === 'vip' ? '#C084FC' : C.textMuted}
            />
            <Text style={[
              styles.accessText,
              accessStatus?.tier === 'vip' ? { color: '#E9D5FF' } : {},
            ]}>
              {getChatAccessText(accessStatus)}
            </Text>
          </View>
        </View>

        {/* ── QUICK PROMPTS ── */}
        <View style={styles.promptRow}>
          {QUICK_PROMPTS.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={[styles.promptChip, (isLoading || isLimited) && styles.promptChipDisabled]}
              disabled={isLoading || isLimited}
              onPress={() => void handleSendMessage(prompt)}
            >
              <Text style={styles.promptChipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── ERROR ── */}
        {aiError ? (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.redLight} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>AI не відповів</Text>
              <Text style={styles.errorText}>{aiError}</Text>
            </View>
          </View>
        ) : null}

        {/* ── MESSAGES ── */}
        <View style={styles.messagesWrap}>
          {messages.length > 0 ? (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  message.role === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={[
                  styles.bubbleRole,
                  message.role === 'user' ? { color: C.accentLight } : { color: C.greenLight },
                ]}>
                  {message.role === 'user' ? 'Ти' : 'AI-викладач'}
                </Text>
                <Text style={styles.bubbleText}>{message.text}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chat-outline" size={40} color={C.textDim} />
              <Text style={styles.emptyText}>Почни з короткого повідомлення або обери підказку вище.</Text>
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingBubble}>
              <Animated.Text style={[styles.loadingDots, { opacity: dotAnim }]}>
                AI друкує відповідь...
              </Animated.Text>
            </View>
          )}
        </View>

        {/* ── CLEAR BUTTON ── */}
        {messages.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => void handleClearHistory()}>
            <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={C.textMuted} />
            <Text style={styles.clearBtnText}>Очистити чат</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── COMPOSER ── */}
      <View style={styles.composer}>
        {/* Mic button */}
        <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={() => void handleToggleMic()}
            disabled={isLoading}
          >
            <MaterialCommunityIcons
              name={isRecording ? 'microphone' : 'microphone-outline'}
              size={22}
              color={isRecording ? '#fff' : C.accentLight}
            />
          </TouchableOpacity>
        </Animated.View>

        <TextInput
          placeholder={isRecording ? '🔴 Слухаю...' : 'Напиши або називай англійською...'}
          placeholderTextColor={isRecording ? C.greenLight : C.textDim}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          multiline
          onSubmitEditing={() => void handleSendMessage()}
          editable={!isRecording}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (isLimited || isLoading) && styles.sendBtnDisabled]}
          disabled={isLimited || isLoading}
          onPress={() => void handleSendMessage()}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <MaterialCommunityIcons name="send" size={22} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, flex: 1 },
  scroll: { flex: 1 },
  container: { gap: 14, padding: 16, paddingBottom: 16 },

  // HERO
  hero: { gap: 6 },
  eyebrow: {
    color: C.accentLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: { color: C.text, fontSize: 26, fontWeight: '800', lineHeight: 32 },
  heroSub: { color: C.textSub, fontSize: 14, lineHeight: 20 },

  // ACCESS
  accessCard: {
    borderRadius: C.r.md,
    borderWidth: 1,
    padding: 12,
  },
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accessText: { color: C.textSub, flex: 1, fontSize: 13, lineHeight: 18 },

  // PROMPTS
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: {
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
    borderRadius: C.r.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptChipDisabled: { opacity: 0.4 },
  promptChipText: { color: C.accentLight, fontSize: 13, fontWeight: '600' },

  // ERROR
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: C.redDim,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: C.r.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  errorTitle: { color: C.redLight, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  errorText: { color: C.textSub, fontSize: 13, lineHeight: 18 },

  // MESSAGES
  messagesWrap: { gap: 10 },
  bubble: {
    borderRadius: C.r.md,
    gap: 6,
    padding: 14,
  },
  userBubble: {
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
    borderWidth: 1,
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  aiBubble: {
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  bubbleRole: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  bubbleText: { color: C.text, fontSize: 15, lineHeight: 22 },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { color: C.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  loadingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    borderColor: C.cardBorder,
    borderRadius: C.r.md,
    borderWidth: 1,
    padding: 14,
  },
  loadingDots: { color: C.textMuted, fontSize: 14 },

  // CLEAR
  clearBtn: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  clearBtnText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

  // COMPOSER
  composer: {
    alignItems: 'flex-end',
    backgroundColor: C.surface,
    borderTopColor: C.cardBorder,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  input: {
    backgroundColor: C.bg,
    borderColor: C.cardBorder,
    borderRadius: C.r.lg,
    borderWidth: 1,
    color: C.text,
    flex: 1,
    maxHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
  },
  sendBtn: {
    alignItems: 'center',
    backgroundColor: C.accent,
    borderRadius: C.r.full,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendBtnDisabled: { backgroundColor: C.surfaceAlt, opacity: 0.5 },

  // MIC
  micBtn: {
    alignItems: 'center',
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
    borderRadius: C.r.full,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: 'rgba(239,68,68,0.5)',
  },
});

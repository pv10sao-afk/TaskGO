import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from '../utils/haptics';
import * as Speech from '../utils/tts';

import { getAccessStatus } from '../services/access';
import { getLearningProfile, getStudyQueue, reviewWord } from '../services/learningHub';
import type { AccessStatus, WordEntry } from '../types';

export function FlashcardScreen({ navigation }: { navigation: any }) {
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function load() {
      const profile = await getLearningProfile();
      const words = await getStudyQueue(profile);
      const nextAccessStatus = await getAccessStatus();
      setQueue(words);
      setTotalCount(words.length);
      setIndex(0);
      setFlipped(false);
      setDone(words.length === 0);
      setAccessStatus(nextAccessStatus);
    }

    void load();

    return () => {
      Speech.stop();
    };
  }, []);

  const currentWord = queue[index] ?? null;

  // Flip animation values
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  function animateFlip(toFlipped: boolean) {
    Animated.spring(flipAnim, {
      toValue: toFlipped ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }

  function handleTap() {
    void Haptics.selectionAsync();
    const next = !flipped;
    setFlipped(next);
    animateFlip(next);

    if (!next && currentWord) {
      Speech.stop();
      Speech.speak(currentWord.word, { language: 'en-US', rate: 0.85 });
    }
  }

  async function handleOutcome(outcome: 'good' | 'again') {
    if (!currentWord) return;
    try {
      await Haptics.impactAsync(
        outcome === 'good' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
      await reviewWord(currentWord.id, outcome);
      setAccessStatus(await getAccessStatus());
    } catch (error) {
      Alert.alert('Ліміт на сьогодні', error instanceof Error ? error.message : 'Не вдалося зберегти повторення.');
      setAccessStatus(await getAccessStatus());
      return;
    }

    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      setDone(true);
      return;
    }

    // Reset card
    setFlipped(false);
    flipAnim.setValue(0);
    swipeX.setValue(0);
    setIndex(nextIndex);
  }

  function animateSwipeBack() {
    Animated.spring(swipeX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }

  async function handleSwipeOutcome(outcome: 'good' | 'again') {
    const targetX = outcome === 'again' ? -240 : 240;

    Animated.timing(swipeX, {
      toValue: targetX,
      duration: 180,
      useNativeDriver: true,
    }).start(async () => {
      swipeX.setValue(0);
      await handleOutcome(outcome);
    });
  }

  const swipeLabelLeftOpacity = swipeX.interpolate({
    inputRange: [-180, -40, 0],
    outputRange: [1, 0.35, 0],
  });
  const swipeLabelRightOpacity = swipeX.interpolate({
    inputRange: [0, 40, 180],
    outputRange: [0, 0.35, 1],
  });
  const cardRotate = swipeX.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      flipped && Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderMove: (_, gestureState) => {
      swipeX.setValue(gestureState.dx);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -120) {
        void handleSwipeOutcome('again');
        return;
      }

      if (gestureState.dx >= 120) {
        void handleSwipeOutcome('good');
        return;
      }

      animateSwipeBack();
    },
    onPanResponderTerminate: () => {
      animateSwipeBack();
    },
  });

  if (done) {
    return (
      <View style={styles.doneScreen}>
        <View style={styles.doneGlow} />
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>Сесія завершена!</Text>
        <Text style={styles.doneSubtitle}>
          {totalCount > 0
            ? `Ти пройшов(ла) ${totalCount} ${totalCount === 1 ? 'слово' : totalCount < 5 ? 'слова' : 'слів'}.`
            : accessStatus?.tier !== 'vip' && (accessStatus?.remaining.wordReviews ?? 0) <= 0
              ? 'На сьогодні ліміт повторення слів вичерпано. Активуй VIP у меню Підписка або повертайся завтра.'
              : 'У черзі немає слів для повторення зараз.'}
        </Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Назад до словника</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentWord) {
    return (
      <View style={styles.doneScreen}>
        <Text style={styles.doneTitle}>Завантаження...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index) / Math.max(totalCount, 1)) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{index + 1} / {totalCount}</Text>

      {/* Flip card container */}
      <View style={styles.cardArea}>
        {flipped ? (
          <>
            <Animated.Text style={[styles.swipeBadge, styles.swipeBadgeLeft, { opacity: swipeLabelLeftOpacity }]}>
              Не знаю
            </Animated.Text>
            <Animated.Text style={[styles.swipeBadge, styles.swipeBadgeRight, { opacity: swipeLabelRightOpacity }]}>
              Знаю
            </Animated.Text>
          </>
        ) : null}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.cardStack,
            {
              transform: [{ translateX: swipeX }, { rotate: cardRotate }],
            },
          ]}
        >
          {/* Front side (word) */}
          <Animated.View
            style={[
              styles.card,
              styles.cardFront,
              { transform: [{ rotateY: frontRotate }] },
            ]}
            pointerEvents={flipped ? 'none' : 'box-none'}
          >
            <TouchableOpacity style={styles.cardTouchable} activeOpacity={0.85} onPress={handleTap}>
              <Text style={styles.cardTag}>{currentWord.topic.replace(/_/g, ' ')}</Text>
              <Text style={styles.wordText}>{currentWord.word}</Text>
              <Text style={styles.tapHint}>Натисни щоб побачити переклад</Text>
              <View style={styles.speakBadge}>
                <Text style={styles.speakBadgeText}>🔊 Проговорити при відкритті</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Back side (translation) */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              { transform: [{ rotateY: backRotate }] },
            ]}
            pointerEvents={flipped ? 'box-none' : 'none'}
          >
            <TouchableOpacity style={styles.cardTouchable} activeOpacity={0.85} onPress={handleTap}>
              <Text style={styles.cardTag}>{currentWord.topic.replace(/_/g, ' ')}</Text>
              <Text style={styles.wordTextBack}>{currentWord.word}</Text>
              <Text style={styles.translationText}>{currentWord.translation}</Text>
              {currentWord.example ? (
                <Text style={styles.exampleText}>"{currentWord.example}"</Text>
              ) : null}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Action buttons — only visible when flipped */}
      {flipped ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.buttonAgain}
            onPress={() => void handleOutcome('again')}
          >
            <Text style={styles.buttonAgainText}>✗ Не знаю</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonGood}
            onPress={() => void handleOutcome('good')}
          >
            <Text style={styles.buttonGoodText}>✓ Знаю</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Text style={styles.flipPrompt}>Натисни на картку, щоб перевернути</Text>
        </View>
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={styles.backLinkText}>← Вийти зі сесії</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#030712',
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  progressBar: {
    backgroundColor: '#1F2937',
    borderRadius: 999,
    height: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    height: '100%',
  },
  progressText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  cardArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  cardStack: {
    height: 360,
    width: '100%',
  },
  card: {
    backfaceVisibility: 'hidden',
    borderRadius: 28,
    height: 360,
    position: 'absolute',
    width: '100%',
  },
  cardFront: {
    backgroundColor: '#101826',
    borderColor: '#1B2A41',
    borderWidth: 1,
  },
  cardBack: {
    backgroundColor: '#13102A',
    borderColor: '#3B2A5A',
    borderWidth: 1,
  },
  cardTouchable: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 28,
  },
  cardTag: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderRadius: 12,
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  wordText: {
    color: '#F9FAFB',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  wordTextBack: {
    color: '#C4B5FD',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  translationText: {
    color: '#F9FAFB',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  exampleText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    textAlign: 'center',
  },
  tapHint: {
    color: '#4B5563',
    fontSize: 13,
    marginTop: 8,
  },
  speakBadge: {
    backgroundColor: 'rgba(15,118,110,0.2)',
    borderColor: '#0F766E',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  speakBadgeText: {
    color: '#5EEAD4',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 28,
  },
  buttonAgain: {
    alignItems: 'center',
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 16,
  },
  buttonAgainText: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonGood: {
    alignItems: 'center',
    backgroundColor: '#0E2520',
    borderColor: '#064E3B',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 16,
  },
  buttonGoodText: {
    color: '#6EE7B7',
    fontSize: 16,
    fontWeight: '800',
  },
  flipPrompt: {
    color: '#4B5563',
    fontSize: 14,
    textAlign: 'center',
  },
  swipeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    textTransform: 'uppercase',
    top: 20,
    zIndex: 2,
  },
  swipeBadgeLeft: {
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    color: '#FCA5A5',
    left: 8,
  },
  swipeBadgeRight: {
    backgroundColor: '#0E2520',
    borderColor: '#064E3B',
    color: '#6EE7B7',
    right: 8,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 18,
  },
  backLinkText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  doneScreen: {
    alignItems: 'center',
    backgroundColor: '#030712',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 32,
  },
  doneGlow: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    height: 200,
    opacity: 0.1,
    position: 'absolute',
    width: 200,
  },
  doneEmoji: {
    fontSize: 56,
  },
  doneTitle: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  doneSubtitle: {
    color: '#9CA3AF',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    marginTop: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  doneButtonText: {
    color: '#F5F3FF',
    fontSize: 16,
    fontWeight: '800',
  },
});

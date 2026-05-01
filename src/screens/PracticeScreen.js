import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { getTodaySession, submitWordReview } from '../services/srsEngine';
import { SettingsContext } from '../context/SettingsContext';
import { ProgressContext } from '../context/ProgressContext';

export default function PracticeScreen() {
  const navigation = useNavigation();
  const { userLevel, dailyNewLimit, dailyReviewLimit } = useContext(SettingsContext);
  const { addXp } = useContext(ProgressContext);

  const [sessionWords, setSessionWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const session = await getTodaySession(userLevel, dailyNewLimit, dailyReviewLimit);
      // Combine reviews and new words, randomize them a bit
      const combined = [...session.reviews, ...session.newWords].sort(() => Math.random() - 0.5);
      setSessionWords(combined);
      setLoading(false);
    };
    loadSession();
  }, [userLevel, dailyNewLimit, dailyReviewLimit]);

  const handleRate = async (quality) => {
    const word = sessionWords[currentIndex];
    await submitWordReview(word.id, quality);
    
    // Reward XP per word
    addXp(5);

    setShowAnswer(false);
    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Finished session
      addXp(20); // Bonus XP
      setCurrentIndex(prev => prev + 1); // Move past end to show completion screen
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  if (sessionWords.length === 0 || currentIndex >= sessionWords.length) {
    return (
      <View className="flex-1 bg-slate-950 p-6 justify-center items-center">
        <CheckCircle2 size={64} color="#a3e635" className="mb-6" />
        <Text className="text-2xl font-bold text-slate-100 mb-2">You're all caught up!</Text>
        <Text className="text-slate-400 text-center mb-8">
          You've completed your daily goal. Great job!
        </Text>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="bg-lime-400 px-8 py-3 rounded-full"
        >
          <Text className="text-slate-950 font-bold text-lg">Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentWord = sessionWords[currentIndex];

  return (
    <View className="flex-1 bg-slate-950 p-6">
      <View className="flex-row items-center mb-8 mt-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-slate-900 rounded-full">
          <ArrowLeft size={24} color="#f8fafc" />
        </TouchableOpacity>
        <View className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
          <View 
            className="bg-lime-400 h-full" 
            style={{ width: `${(currentIndex / sessionWords.length) * 100}%` }} 
          />
        </View>
        <Text className="text-slate-400 ml-4 font-bold">
          {currentIndex + 1} / {sessionWords.length}
        </Text>
      </View>

      <View className="flex-1 justify-center items-center mb-8">
        <Text className="text-slate-400 text-sm font-bold uppercase mb-2">
          {currentWord.progress?.isLearned ? 'Review' : 'New Word'} • Level {currentWord.level}
        </Text>
        <Text className="text-5xl font-bold text-slate-100 mb-6 text-center">
          {currentWord.word}
        </Text>
        
        {showAnswer ? (
          <View className="items-center w-full">
            <Text className="text-2xl font-bold text-lime-400 mb-4">{currentWord.translation}</Text>
            <Text className="text-slate-300 text-center italic mb-8">{currentWord.meaning}</Text>
            
            {currentWord.examples && currentWord.examples.length > 0 && (
              <View className="bg-slate-900 p-4 rounded-xl w-full border border-slate-800">
                <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Examples</Text>
                {currentWord.examples.map((ex, i) => (
                  <Text key={i} className="text-slate-300 mb-1">• {ex}</Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text className="text-slate-500 italic mt-8 text-center">
            Think of the meaning, then tap to reveal.
          </Text>
        )}
      </View>

      <View className="pb-8">
        {!showAnswer ? (
          <TouchableOpacity 
            onPress={() => setShowAnswer(true)}
            className="bg-slate-800 py-4 rounded-xl border border-slate-700 items-center"
          >
            <Text className="text-slate-100 font-bold text-lg">Show Answer</Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row justify-between gap-2">
            <TouchableOpacity 
              onPress={() => handleRate(1)}
              className="flex-1 bg-slate-800 py-4 rounded-xl border border-rose-500 items-center"
            >
              <Text className="text-rose-400 font-bold">Forgot (1)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => handleRate(3)}
              className="flex-1 bg-slate-800 py-4 rounded-xl border border-orange-500 items-center"
            >
              <Text className="text-orange-400 font-bold">Hard (3)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => handleRate(5)}
              className="flex-1 bg-slate-800 py-4 rounded-xl border border-lime-500 items-center"
            >
              <Text className="text-lime-400 font-bold">Easy (5)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

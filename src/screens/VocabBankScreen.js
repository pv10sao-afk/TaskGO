import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Volume2, BookOpen, Clock, CheckCircle } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { useIsFocused } from '@react-navigation/native';
import { VOCABULARY_DB } from '../data/vocabulary';
import { getVocabularyProgress } from '../services/srsEngine';
import { getCustomVocabulary } from '../services/learningStorage';

const FILTERS = ['All', 'New', 'Learning', 'Mastered'];

export default function VocabBankScreen() {
  const isFocused = useIsFocused();
  const [vocabData, setVocabData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    const progress = await getVocabularyProgress();
    const customWords = await getCustomVocabulary();
    
    const merged = [...customWords, ...VOCABULARY_DB].map(word => ({
      ...word,
      progress: progress[word.id] || { repetition: 0, isLearned: false }
    }));

    // Sort: Learned first, then by level
    const sorted = merged.sort((a, b) => {
      if (a.progress.isLearned && !b.progress.isLearned) return -1;
      if (!a.progress.isLearned && b.progress.isLearned) return 1;
      return String(a.level).localeCompare(String(b.level));
    });

    setVocabData(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  const handlePlay = (word) => {
    Speech.stop();
    Speech.speak(word, { language: 'en-US' });
  };

  const getMasteryColor = (repetition) => {
    if (repetition === 0) return 'bg-slate-800';
    if (repetition < 3) return 'bg-indigo-500';
    if (repetition < 6) return 'bg-orange-500';
    return 'bg-lime-400';
  };

  const getMasteryText = (repetition) => {
    if (repetition === 0) return 'New';
    if (repetition < 3) return 'Learning';
    if (repetition < 6) return 'Familiar';
    return 'Mastered';
  };

  const filteredVocab = vocabData.filter(item => {
    const status = getMasteryText(item.progress.repetition);
    return filter === 'All' || status === filter;
  });

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="mb-8">
          <Text className="text-3xl font-bold text-slate-100 mb-2">Vocab Bank</Text>
          <Text className="text-slate-400">Track your progress and mastery of English words.</Text>
        </View>

        <View className="flex-row gap-4 mb-8">
          <View className="flex-1 bg-slate-900 p-4 rounded-2xl border border-slate-800 items-center">
            <BookOpen size={24} color="#a3e635" />
            <Text className="text-slate-100 font-bold text-xl mt-2">
              {vocabData.filter(v => v.progress.isLearned).length}
            </Text>
            <Text className="text-slate-500 text-xs font-bold uppercase">Learned</Text>
          </View>
          <View className="flex-1 bg-slate-900 p-4 rounded-2xl border border-slate-800 items-center">
            <CheckCircle size={24} color="#818cf8" />
            <Text className="text-slate-100 font-bold text-xl mt-2">
              {vocabData.filter(v => v.progress.repetition >= 6).length}
            </Text>
            <Text className="text-slate-500 text-xs font-bold uppercase">Mastered</Text>
          </View>
        </View>

        <View className="flex-row gap-2 mb-6">
          {FILTERS.map(item => (
            <TouchableOpacity
              key={item}
              onPress={() => setFilter(item)}
              className={`flex-1 py-2 rounded-full border items-center ${filter === item ? 'bg-lime-400 border-lime-400' : 'bg-slate-900 border-slate-800'}`}
            >
              <Text className={`text-xs font-bold ${filter === item ? 'text-slate-950' : 'text-slate-400'}`}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredVocab.length === 0 ? (
          <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center">
            <BookOpen size={32} color="#64748b" />
            <Text className="text-slate-300 font-bold mt-3">No words here yet</Text>
            <Text className="text-slate-500 text-center mt-1">Save words from AI Tutor or scanned tasks.</Text>
          </View>
        ) : filteredVocab.map((item, index) => (
          <View key={index} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-4 shadow-sm">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-3 mb-1">
                  <Text className="text-2xl font-bold text-slate-100">{item.word}</Text>
                  <View className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase">{item.level}</Text>
                  </View>
                </View>
                <Text className="text-slate-400 font-medium">🇺🇦 {item.translation}</Text>
                {!!item.meaning && <Text className="text-slate-500 mt-2">{item.meaning}</Text>}
              </View>
              <TouchableOpacity 
                onPress={() => handlePlay(item.word)} 
                className="p-3 bg-slate-800 rounded-2xl"
              >
                <Volume2 size={24} color="#a3e635" />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-slate-800/50">
              <View className="flex-row items-center gap-2">
                <View className={`w-3 h-3 rounded-full ${getMasteryColor(item.progress.repetition)}`} />
                <Text className="text-slate-300 font-bold">{getMasteryText(item.progress.repetition)}</Text>
              </View>
              {item.progress.nextReviewDate && (
                <View className="flex-row items-center gap-1">
                  <Clock size={14} color="#64748b" />
                  <Text className="text-slate-500 text-xs">
                    Next: {new Date(item.progress.nextReviewDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>

            {item.examples && item.examples.length > 0 && (
              <View className="mt-4 bg-slate-800/60 rounded-xl p-3">
                <Text className="text-slate-500 text-xs font-bold uppercase mb-1">Example</Text>
                <Text className="text-slate-300" numberOfLines={2}>{item.examples[0]}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

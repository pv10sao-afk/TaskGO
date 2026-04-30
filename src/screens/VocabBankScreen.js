import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import * as Speech from 'expo-speech';

import { VOCABULARY_DB } from '../data/vocabulary';

const savedVocab = VOCABULARY_DB;


export default function VocabBankScreen() {
  useEffect(() => {
    return () => Speech.stop();
  }, []);

  const handlePlay = (word) => {
    Speech.stop();
    Speech.speak(word, { language: 'en-US' });
  };

  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-bold text-slate-100 mb-2">My Vocabulary</Text>
      <Text className="text-slate-400 mb-6">Review the words you saved from your chat sessions.</Text>

      {savedVocab.map((item, index) => {
        const textToRead = item.word;
        return (
          <View key={index} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center gap-3">
                <Text className="text-xl font-bold text-lime-400">{textToRead}</Text>
                <View className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase">{item.level}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handlePlay(textToRead)} className="p-2 bg-slate-800 rounded-full">
                <Volume2 size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text className="text-slate-300 italic mb-1">"{item.meaning}"</Text>
            <Text className="text-slate-400 mb-3">🇺🇦 {item.translation}</Text>
            
            {item.examples && item.examples.length > 0 && (
              <View className="mt-2 pt-2 border-t border-slate-800/50">
                <Text className="text-slate-500 text-xs uppercase font-bold mb-1">Example:</Text>
                <Text className="text-slate-300 text-sm italic">{item.examples[0]}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

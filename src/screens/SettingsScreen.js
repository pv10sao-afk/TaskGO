import React, { useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SettingsContext } from '../context/SettingsContext';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function SettingsScreen() {
  const { 
    userLevel, setUserLevel, 
    dailyNewLimit, setDailyNewLimit, 
    dailyReviewLimit, setDailyReviewLimit,
    groqApiKey, setGroqApiKey
  } = useContext(SettingsContext);
  const navigation = useNavigation();

  return (
    <ScrollView className="flex-1 bg-slate-950 p-6">
      <View className="flex-row items-center mb-8">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-slate-900 rounded-full">
          <ArrowLeft size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-slate-100">Settings</Text>
      </View>

      <Text className="text-xl font-bold text-lime-400 mb-4">Your Current Level</Text>
      <View className="flex-row flex-wrap gap-3 mb-8">
        {LEVELS.map(level => (
          <TouchableOpacity 
            key={level} 
            onPress={() => setUserLevel(level)}
            className={`px-4 py-2 rounded-full border ${userLevel === level ? 'bg-lime-400 border-lime-400' : 'bg-slate-800 border-slate-700'}`}
          >
            <Text className={`font-bold ${userLevel === level ? 'text-slate-950' : 'text-slate-300'}`}>{level}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-xl font-bold text-lime-400 mb-4">Daily Goals (Spaced Repetition)</Text>
      
      <View className="bg-slate-900 p-4 rounded-2xl mb-4 border border-slate-800">
        <Text className="text-slate-300 font-bold mb-2">New Words per Session</Text>
        <Text className="text-slate-500 text-sm mb-4">How many completely new words you want to learn.</Text>
        <View className="flex-row items-center justify-between">
          {[5, 10, 15, 20].map(val => (
            <TouchableOpacity 
              key={val} 
              onPress={() => setDailyNewLimit(val)}
              className={`w-14 h-14 rounded-full items-center justify-center border ${dailyNewLimit === val ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-800 border-slate-700'}`}
            >
              <Text className={`font-bold ${dailyNewLimit === val ? 'text-white' : 'text-slate-300'}`}>{val}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="bg-slate-900 p-4 rounded-2xl mb-8 border border-slate-800">
        <Text className="text-slate-300 font-bold mb-2">Review Words per Session</Text>
        <Text className="text-slate-500 text-sm mb-4">How many learned words you want to repeat to not forget them.</Text>
        <View className="flex-row items-center justify-between">
          {[10, 15, 20, 30].map(val => (
            <TouchableOpacity 
              key={val} 
              onPress={() => setDailyReviewLimit(val)}
              className={`w-14 h-14 rounded-full items-center justify-center border ${dailyReviewLimit === val ? 'bg-rose-500 border-rose-400' : 'bg-slate-800 border-slate-700'}`}
            >
              <Text className={`font-bold ${dailyReviewLimit === val ? 'text-white' : 'text-slate-300'}`}>{val}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text className="text-xl font-bold text-lime-400 mb-4">Developer Tools</Text>
      <View className="bg-slate-900 p-4 rounded-2xl mb-12 border border-slate-800">
        <Text className="text-slate-300 font-bold mb-2">Groq API Key</Text>
        <Text className="text-slate-500 text-sm mb-4">Paste your personal Groq API Key to enable the AI Tutor and Image Scanner.</Text>
        <TextInput
          value={groqApiKey}
          onChangeText={setGroqApiKey}
          placeholder="gsk_..."
          placeholderTextColor="#64748b"
          className="bg-slate-800 text-slate-100 p-3 rounded-xl border border-slate-700"
          secureTextEntry={true}
        />
      </View>

      <Text className="text-xl font-bold text-rose-500 mb-4">Danger Zone</Text>
      <TouchableOpacity 
        onPress={async () => {
          await AsyncStorage.clear();
          alert('All progress and settings have been reset.');
        }}
        className="bg-rose-500/10 p-4 rounded-2xl mb-20 border border-rose-500/50 items-center"
      >
        <Text className="text-rose-500 font-bold">Reset All Progress</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import TopBar from '../components/TopBar';
import { AlertTriangle, BookA, CalendarCheck, Gift, Headphones, Mic, Trophy } from 'lucide-react-native';
import { SettingsContext } from '../context/SettingsContext';
import { ProgressContext } from '../context/ProgressContext';
import { getTodaySession, getVocabularyProgress } from '../services/srsEngine';
import { getMistakes } from '../services/learningStorage';
import { LESSONS_DB } from '../data/lessons';

const getIconForCategory = (category) => {
  switch(category) {
    case 'General': return BookA;
    case 'Roleplay': return Mic;
    case 'Grammar': return BookA;
    case 'Listening': return Headphones;
    default: return Trophy;
  }
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { userLevel, dailyNewLimit, dailyReviewLimit } = useContext(SettingsContext);
  const { streak } = useContext(ProgressContext);
  
  const [srsStats, setSrsStats] = useState({ newWords: 0, reviews: 0, learnedToday: 0 });
  const [mistakes, setMistakes] = useState([]);

  useEffect(() => {
    if (isFocused) {
      const loadSrs = async () => {
        const session = await getTodaySession(userLevel, dailyNewLimit, dailyReviewLimit);
        const progress = await getVocabularyProgress();
        const today = new Date().toISOString().split('T')[0];
        
        const learnedTodayCount = Object.values(progress).filter(p => p.lastReviewedDate === today).length;

        setSrsStats({
          newWords: session.newWords.length,
          reviews: session.reviews.length,
          learnedToday: learnedTodayCount
        });
        setMistakes(await getMistakes());
      };
      
      loadSrs();
    }
  }, [isFocused, userLevel, dailyNewLimit, dailyReviewLimit]);

  const dynamicLessons = LESSONS_DB.filter(l => l.level === userLevel).map((lesson, index) => {
    return {
      ...lesson,
      icon: getIconForCategory(lesson.category),
      completed: false,
      locked: false // Unlocked all lessons so you can test them
    };
  });

  const displayLessons = dynamicLessons.length > 0 ? dynamicLessons : [
    { id: 99, title: 'No lessons yet', icon: Trophy, completed: false, locked: true }
  ];

  const dailyGoalTotal = dailyNewLimit + 5;
  const planItems = [
    { label: 'Review', value: `${srsStats.reviews} words`, done: srsStats.reviews === 0 },
    { label: 'Learn', value: `${srsStats.newWords} new`, done: srsStats.newWords === 0 },
    { label: 'Mistakes', value: `${mistakes.length} saved`, done: mistakes.length === 0 },
  ];
  const rewardText = streak >= 7 ? '7-day reward unlocked' : `${Math.max(0, 7 - streak)} days to reward`;

  const openLesson = (lesson, isActive) => {
    if (!isActive) return;
    if (lesson.category === 'Roleplay') {
      navigation.navigate('Chat', { prompt: lesson.prompt, title: lesson.title });
    } else {
      navigation.navigate('Exercise', { lessonId: lesson.id, title: lesson.title });
    }
  };

  const renderLessonButton = (lesson) => {
    const Icon = lesson.icon;
    const isActive = !lesson.completed && !lesson.locked;

    let bgColor = 'bg-slate-800';
    let borderColor = 'border-slate-700';
    let iconColor = '#64748b';

    if (lesson.completed) {
      bgColor = 'bg-lime-400/20';
      borderColor = 'border-lime-400/50';
      iconColor = '#a3e635';
    } else if (isActive) {
      bgColor = 'bg-lime-400';
      borderColor = 'border-lime-500';
      iconColor = '#020617';
    }

    return (
      <View key={lesson.id} className="items-center w-1/2 mb-5">
        <TouchableOpacity
          disabled={lesson.locked}
          onPress={() => openLesson(lesson, isActive)}
          className={`w-24 h-24 rounded-full items-center justify-center border-b-4 ${bgColor} ${borderColor} ${lesson.locked ? 'opacity-50' : ''}`}
        >
          <Icon size={40} color={iconColor} />
        </TouchableOpacity>
        <Text className={`mt-2 font-bold text-center px-2 ${lesson.locked ? 'text-slate-600' : 'text-slate-300'}`}>
          {lesson.title}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-950">
      <TopBar />
      
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <Text className="text-3xl font-bold text-slate-100 mb-2 text-center">
          Level {userLevel}
        </Text>
        
        <View className="flex-row gap-4 mb-4">
          <View className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <Text className="text-slate-400 text-xs font-bold uppercase">To Review</Text>
            <Text className="text-rose-400 font-bold text-lg">{srsStats.reviews} words</Text>
          </View>
          <View className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <Text className="text-slate-400 text-xs font-bold uppercase">New Words</Text>
            <Text className="text-indigo-400 font-bold text-lg">{srsStats.newWords} words</Text>
          </View>
        </View>

        <View className="bg-slate-900 w-full p-4 rounded-3xl border border-slate-800 mb-8">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-slate-100 font-bold">Daily Goal</Text>
            <Text className="text-lime-400 font-bold">{srsStats.learnedToday} / {dailyGoalTotal} words</Text>
          </View>
          <View className="bg-slate-800 h-3 rounded-full overflow-hidden">
            <View
              className="bg-lime-400 h-full"
              style={{ width: `${Math.min(100, (srsStats.learnedToday / dailyGoalTotal) * 100)}%` }}
            />
          </View>
        </View>

        <View className="w-full mb-6">
          <Text className="text-slate-100 font-bold text-xl mb-4">Lessons</Text>
          <View className="flex-row flex-wrap justify-between">
            {displayLessons.map(renderLessonButton)}
          </View>
        </View>

        <View className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-6">
          <View className="flex-row items-center mb-4">
            <CalendarCheck size={20} color="#a3e635" />
            <Text className="text-slate-100 font-bold text-lg ml-2">Today Plan</Text>
          </View>
          <View className="gap-3">
            {planItems.map(item => (
              <View key={item.label} className="flex-row justify-between items-center bg-slate-800/70 rounded-xl px-3 py-3">
                <Text className="text-slate-300 font-bold">{item.label}</Text>
                <Text className={item.done ? 'text-lime-400 font-bold' : 'text-slate-100 font-bold'}>
                  {item.done ? 'Done' : item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Gift size={20} color="#facc15" />
              <Text className="text-slate-100 font-bold text-lg ml-2">Streak Rewards</Text>
            </View>
            <Text className="text-yellow-400 font-bold">{rewardText}</Text>
          </View>
          <View className="flex-row gap-2 mt-4">
            {[1, 3, 7, 14].map(day => (
              <View key={day} className={`flex-1 py-3 rounded-xl items-center border ${streak >= day ? 'bg-yellow-400/20 border-yellow-400' : 'bg-slate-800 border-slate-700'}`}>
                <Text className={streak >= day ? 'text-yellow-300 font-bold' : 'text-slate-500 font-bold'}>{day}d</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <AlertTriangle size={20} color="#fb7185" />
              <Text className="text-slate-100 font-bold text-lg ml-2">Mistakes Bank</Text>
            </View>
            <Text className="text-rose-400 font-bold">{mistakes.length}</Text>
          </View>
          {mistakes.length === 0 ? (
            <Text className="text-slate-500">No saved mistakes yet.</Text>
          ) : (
            mistakes.slice(0, 2).map(item => (
              <View key={item.id} className="bg-slate-800/70 rounded-xl p-3 mb-2">
                <Text className="text-slate-300 font-bold" numberOfLines={1}>{item.prompt || item.source}</Text>
                {!!item.correction && <Text className="text-lime-400 mt-1" numberOfLines={1}>{item.correction}</Text>}
              </View>
            ))
          )}
        </View>

        {(srsStats.reviews > 0 || srsStats.newWords > 0) && (
          <TouchableOpacity 
            onPress={() => navigation.navigate('Practice')}
            className="bg-lime-400 px-8 py-3 rounded-full mb-8"
          >
            <Text className="text-slate-950 font-bold text-lg">Start Review</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

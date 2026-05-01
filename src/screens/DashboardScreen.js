import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import TopBar from '../components/TopBar';
import { BookA, Headphones, Mic, Trophy } from 'lucide-react-native';
import { SettingsContext } from '../context/SettingsContext';
import { LESSONS_DB } from '../data/lessons';
import { getTodaySession } from '../services/srsEngine';

const getIconForCategory = (category) => {
  switch(category) {
    case 'General': return BookA;
    case 'Roleplay': return Mic;
    case 'Listening': return Headphones;
    default: return Trophy;
  }
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { userLevel, dailyNewLimit, dailyReviewLimit } = useContext(SettingsContext);
  
  const [srsStats, setSrsStats] = useState({ newWords: 0, reviews: 0 });

  useEffect(() => {
    if (isFocused) {
      const loadSrs = async () => {
        const session = await getTodaySession(userLevel, dailyNewLimit, dailyReviewLimit);
        setSrsStats({
          newWords: session.newWords.length,
          reviews: session.reviews.length
        });
      };
      loadSrs();
    }
  }, [isFocused, userLevel, dailyNewLimit, dailyReviewLimit]);

  // Filter lessons based on user level
  const dynamicLessons = LESSONS_DB.filter(l => l.level === userLevel).map((lesson, index) => {
    // Make the first lesson always active if none completed, just a mock for now
    return {
      id: lesson.id,
      title: lesson.title,
      icon: getIconForCategory(lesson.category),
      completed: false,
      locked: index !== 0, // only first is unlocked by default for demo
      prompt: lesson.prompt
    };
  });

  // Fallback if no lessons for the current level
  const displayLessons = dynamicLessons.length > 0 ? dynamicLessons : [
    { id: 99, title: 'Coming Soon', icon: Trophy, completed: false, locked: true }
  ];

  return (
    <View className="flex-1 bg-slate-950">
      <TopBar streak={12} xp={1450} />
      
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <Text className="text-3xl font-bold text-slate-100 mb-2 text-center">
          Level {userLevel}
        </Text>
        
        <View className="flex-row gap-4 mb-8">
          <View className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <Text className="text-slate-400 text-xs font-bold uppercase">To Review</Text>
            <Text className="text-rose-400 font-bold text-lg">{srsStats.reviews} words</Text>
          </View>
          <View className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <Text className="text-slate-400 text-xs font-bold uppercase">New Words</Text>
            <Text className="text-indigo-400 font-bold text-lg">{srsStats.newWords} words</Text>
          </View>
        </View>

        {displayLessons.map((lesson, index) => {
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

          // Simple zigzag pattern
          const marginLeft = index % 2 === 0 ? 0 : 60;
          const marginRight = index % 2 === 0 ? 60 : 0;

          return (
            <View key={lesson.id} className="items-center mb-6" style={{ marginLeft, marginRight }}>
              <TouchableOpacity
                disabled={lesson.locked}
                onPress={() => {
                  if (isActive) navigation.navigate('Chat', { prompt: lesson.prompt });
                }}
                className={`w-24 h-24 rounded-full items-center justify-center border-b-4 ${bgColor} ${borderColor} ${lesson.locked ? 'opacity-50' : ''}`}
              >
                <Icon size={40} color={iconColor} />
              </TouchableOpacity>
              <Text className={`mt-2 font-bold ${lesson.locked ? 'text-slate-600' : 'text-slate-300'}`}>
                {lesson.title}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

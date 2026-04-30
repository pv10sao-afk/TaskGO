import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TopBar from '../components/TopBar';
import { BookA, Headphones, Mic, Trophy } from 'lucide-react-native';

const lessons = [
  { id: 1, title: 'Basics 1', icon: BookA, completed: true, locked: false },
  { id: 2, title: 'Listening', icon: Headphones, completed: false, locked: false },
  { id: 3, title: 'Speaking', icon: Mic, completed: false, locked: true },
  { id: 4, title: 'Challenge', icon: Trophy, completed: false, locked: true },
];

export default function DashboardScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-slate-950">
      <TopBar streak={12} xp={1450} />
      
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <Text className="text-3xl font-bold text-slate-100 mb-8 text-center">
          Keep up the good work!
        </Text>

        {lessons.map((lesson, index) => {
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
                  if (isActive) navigation.navigate('Chat');
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

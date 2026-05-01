import React, { useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Flame, Star, Volume2, VolumeX, Settings } from 'lucide-react-native';
import { SettingsContext } from '../context/SettingsContext';

import { useNavigation } from '@react-navigation/native';

export default function TopBar({ streak = 0, xp = 0 }) {
  const { autoPlayAudio, toggleAutoPlay } = useContext(SettingsContext);
  const navigation = useNavigation();

  return (
    <View className="flex-row justify-between items-center px-4 py-4 bg-slate-950 border-b border-slate-800">
      <View className="flex-row gap-2">
        <View className="flex-row items-center bg-slate-900 rounded-full px-3 py-1 border border-slate-800">
          <Flame size={20} color="#f97316" className="mr-1" />
          <Text className="text-orange-500 font-bold text-base">{streak}</Text>
        </View>
        <View className="flex-row items-center bg-slate-900 rounded-full px-3 py-1 border border-slate-800">
          <Star size={20} color="#eab308" className="mr-1" />
          <Text className="text-yellow-500 font-bold text-base">{xp} XP</Text>
        </View>
      </View>
      
      <View className="flex-row gap-2">
        <TouchableOpacity 
          onPress={toggleAutoPlay}
          className="bg-slate-900 p-2 rounded-full border border-slate-800"
        >
          {autoPlayAudio ? (
            <Volume2 size={20} color="#a3e635" />
          ) : (
            <VolumeX size={20} color="#64748b" />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('Settings')}
          className="bg-slate-900 p-2 rounded-full border border-slate-800"
        >
          <Settings size={20} color="#64748b" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

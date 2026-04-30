import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import * as Speech from 'expo-speech';

export default function Bubble({ message, isUser }) {
  const handlePlay = () => {
    Speech.stop();
    Speech.speak(message, { language: isUser ? 'uk-UA' : 'en-US' });
  };

  return (
    <View className={`max-w-[80%] rounded-2xl p-4 my-2 flex-row items-end ${isUser ? 'self-end bg-lime-400 rounded-tr-sm' : 'self-start bg-slate-800 rounded-tl-sm'}`}>
      <Text className={`text-base flex-1 ${isUser ? 'text-slate-950 font-medium' : 'text-slate-100'}`}>
        {message}
      </Text>
      {!isUser && (
        <TouchableOpacity onPress={handlePlay} className="ml-2 bg-slate-700/50 p-1 rounded-full">
          <Volume2 size={16} color="#a3e635" />
        </TouchableOpacity>
      )}
    </View>
  );
}

import React from 'react';
import { View, Text } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

export default function MistakeCorrection({ correction, explanation }) {
  if (!correction && !explanation) return null;
  
  return (
    <View className="bg-slate-900/80 border border-red-400/30 rounded-xl p-3 my-1 ml-4 self-start max-w-[85%]">
      <View className="flex-row items-center mb-1">
        <AlertCircle size={16} color="#ef4444" />
        <Text className="text-red-400 font-bold ml-2 text-sm">Correction</Text>
      </View>
      {!!correction && <Text className="text-slate-200 text-sm italic mb-1">"{correction}"</Text>}
      {!!explanation && <Text className="text-slate-400 text-xs">{explanation}</Text>}
    </View>
  );
}

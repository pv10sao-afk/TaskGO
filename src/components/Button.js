import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

export default function Button({ title, onPress, icon: Icon, variant = 'primary', className = '' }) {
  const baseClasses = "flex-row items-center justify-center py-3 px-6 rounded-full";
  const variants = {
    primary: "bg-lime-400",
    secondary: "bg-slate-800",
    outline: "border-2 border-lime-400",
  };
  
  const textColors = {
    primary: "text-slate-950",
    secondary: "text-lime-400",
    outline: "text-lime-400",
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      className={`${baseClasses} ${variants[variant]} ${className}`}
      activeOpacity={0.8}
    >
      {Icon && <View className="mr-2"><Icon size={20} color={variant === 'primary' ? '#020617' : '#a3e635'} /></View>}
      <Text className={`text-lg font-bold ${textColors[variant]}`}>{title}</Text>
    </TouchableOpacity>
  );
}

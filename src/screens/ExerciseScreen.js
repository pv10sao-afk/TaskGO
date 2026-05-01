import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react-native';
import { ProgressContext } from '../context/ProgressContext';
import * as Speech from 'expo-speech';
import { LESSONS_DB } from '../data/lessons';

export default function ExerciseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { lessonId, title } = route.params;
  const { addXp } = useContext(ProgressContext);

  const [exercises, setExercises] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // State for different exercise types
  const [selectedOption, setSelectedOption] = useState(null);
  const [builtSentence, setBuiltSentence] = useState([]);
  const [availableWords, setAvailableWords] = useState([]);
  const [translationInput, setTranslationInput] = useState('');
  
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    const fetchExercises = async () => {
      // Find the lesson in our local DB
      const lesson = LESSONS_DB.find(l => l.id === lessonId);
      const data = lesson && lesson.exercises ? lesson.exercises : [];
        
      setExercises(data);
      if (data.length > 0 && data[0].type === 'sentence_builder') {
        setAvailableWords([...(data[0].words || [])].sort(() => Math.random() - 0.5));
      }
      setLoading(false);
    };
    fetchExercises();
  }, [lessonId]);

  const handleCheck = () => {
    const exercise = exercises[currentIndex];
    let correct = false;

    if (exercise.type === 'multiple_choice') {
      correct = selectedOption === exercise.correct_answer;
    } else if (exercise.type === 'sentence_builder') {
      const built = builtSentence.join(' ');
      const target = (exercise.correct_order || []).join(' ');
      correct = built === target;
    } else if (exercise.type === 'translation') {
      // Basic fuzzy check (case insensitive)
      correct = translationInput.trim().toLowerCase() === (exercise.correct_answer || '').toLowerCase();
    }

    setIsCorrect(correct);
    setIsChecked(true);

    if (correct) {
      Speech.speak("Correct", { language: 'en-US' });
    } else {
      Speech.speak("Incorrect", { language: 'en-US' });
    }
  };

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextEx = exercises[nextIndex];
      setCurrentIndex(nextIndex);
      
      // Reset states
      setIsChecked(false);
      setIsCorrect(false);
      setSelectedOption(null);
      setTranslationInput('');
      setBuiltSentence([]);
      if (nextEx.type === 'sentence_builder') {
        setAvailableWords([...(nextEx.words || [])].sort(() => Math.random() - 0.5));
      }
    } else {
      // Finished all exercises in the lesson
      addXp(50); // Big reward for finishing a lesson
      setCurrentIndex(currentIndex + 1); // Move to completion screen
    }
  };

  // Sentence Builder Handlers
  const handleWordSelect = (word, index) => {
    if (isChecked) return;
    setBuiltSentence([...builtSentence, word]);
    const newAvailable = [...availableWords];
    newAvailable.splice(index, 1);
    setAvailableWords(newAvailable);
  };

  const handleWordRemove = (word, index) => {
    if (isChecked) return;
    const newBuilt = [...builtSentence];
    newBuilt.splice(index, 1);
    setBuiltSentence(newBuilt);
    setAvailableWords([...availableWords, word]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#a3e635" />
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View className="flex-1 bg-slate-950 p-6 justify-center items-center">
        <Text className="text-xl text-slate-400 mb-6">No exercises found for this lesson.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="bg-slate-800 px-6 py-3 rounded-full">
          <Text className="text-slate-100 font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentIndex >= exercises.length) {
    return (
      <View className="flex-1 bg-slate-950 p-6 justify-center items-center">
        <CheckCircle2 size={80} color="#a3e635" className="mb-6" />
        <Text className="text-3xl font-bold text-slate-100 mb-2">Lesson Complete!</Text>
        <Text className="text-slate-400 text-lg mb-8">+50 XP Earned</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} className="bg-lime-400 px-10 py-4 rounded-full">
          <Text className="text-slate-950 font-bold text-lg">Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentExercise = exercises[currentIndex];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View className="flex-1 bg-slate-950 p-6 pt-12">
        
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <ArrowLeft size={24} color="#64748b" />
          </TouchableOpacity>
          <View className="flex-1 bg-slate-800 h-3 rounded-full overflow-hidden">
            <View className="bg-lime-400 h-full" style={{ width: `${(currentIndex / exercises.length) * 100}%` }} />
          </View>
        </View>

        <Text className="text-2xl font-bold text-slate-100 mb-8">{currentExercise.question}</Text>

        <View className="flex-1">
          {/* Multiple Choice */}
          {currentExercise.type === 'multiple_choice' && (
            <View className="gap-4">
              {(currentExercise.options || []).map((option, idx) => (
                <TouchableOpacity 
                  key={idx}
                  disabled={isChecked}
                  onPress={() => setSelectedOption(option)}
                  className={`p-4 rounded-2xl border-2 ${
                    selectedOption === option 
                      ? isChecked 
                        ? isCorrect ? 'bg-lime-400/20 border-lime-400' : 'bg-rose-500/20 border-rose-500'
                        : 'bg-indigo-500/20 border-indigo-500' 
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <Text className={`text-lg font-bold ${selectedOption === option && !isChecked ? 'text-indigo-400' : 'text-slate-300'}`}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Sentence Builder */}
          {currentExercise.type === 'sentence_builder' && (
            <View className="flex-1">
              <View className="min-h-24 border-b-2 border-slate-800 pb-4 mb-8 flex-row flex-wrap gap-2">
                {builtSentence.map((word, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    onPress={() => handleWordRemove(word, idx)}
                    className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700"
                  >
                    <Text className="text-slate-100 font-bold text-lg">{word}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View className="flex-row flex-wrap gap-3 justify-center">
                {availableWords.map((word, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    onPress={() => handleWordSelect(word, idx)}
                    className="bg-slate-900 px-4 py-3 rounded-xl border border-slate-700"
                  >
                    <Text className="text-slate-300 font-bold text-lg">{word}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Translation */}
          {currentExercise.type === 'translation' && (
            <View>
              <TextInput
                editable={!isChecked}
                value={translationInput}
                onChangeText={setTranslationInput}
                placeholder="Type in English"
                placeholderTextColor="#64748b"
                className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 text-lg min-h-32"
                multiline
              />
            </View>
          )}
        </View>

        {/* Footer Area */}
        <View className="pt-6">
          {isChecked && (
            <View className={`p-4 rounded-2xl mb-4 flex-row items-center ${isCorrect ? 'bg-lime-400/20' : 'bg-rose-500/20'}`}>
              {isCorrect ? <CheckCircle2 color="#a3e635" size={24} /> : <XCircle color="#fb7185" size={24} />}
              <View className="ml-3">
                <Text className={`font-bold ${isCorrect ? 'text-lime-400' : 'text-rose-400'}`}>
                  {isCorrect ? "Excellent!" : "Not quite right"}
                </Text>
                {!isCorrect && currentExercise.correct_answer && (
                  <Text className="text-slate-300 mt-1">Correct answer: {currentExercise.correct_answer}</Text>
                )}
                {!isCorrect && currentExercise.correct_order && (
                  <Text className="text-slate-300 mt-1">Correct answer: {currentExercise.correct_order.join(' ')}</Text>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity 
            onPress={isChecked ? handleNext : handleCheck}
            disabled={
              !isChecked && 
              (currentExercise.type === 'multiple_choice' && !selectedOption) ||
              (currentExercise.type === 'translation' && !translationInput.trim()) ||
              (currentExercise.type === 'sentence_builder' && builtSentence.length === 0)
            }
            className={`py-4 rounded-full items-center ${
              (!isChecked && (
                (currentExercise.type === 'multiple_choice' && !selectedOption) ||
                (currentExercise.type === 'translation' && !translationInput.trim()) ||
                (currentExercise.type === 'sentence_builder' && builtSentence.length === 0)
              )) ? 'bg-slate-800' : isChecked ? isCorrect ? 'bg-lime-400' : 'bg-rose-500' : 'bg-indigo-500'
            }`}
          >
            <Text className={`font-bold text-lg ${
              (!isChecked && (
                (currentExercise.type === 'multiple_choice' && !selectedOption) ||
                (currentExercise.type === 'translation' && !translationInput.trim()) ||
                (currentExercise.type === 'sentence_builder' && builtSentence.length === 0)
              )) ? 'text-slate-500' : isChecked ? 'text-slate-950' : 'text-white'
            }`}>
              {isChecked ? "Continue" : "Check Answer"}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

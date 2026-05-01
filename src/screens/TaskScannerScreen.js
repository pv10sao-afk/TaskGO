import React, { useState, useContext, useEffect } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, Image as ImageIcon, Volume2, RotateCw, Save, Clock, RefreshCw, BookPlus } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { useIsFocused } from '@react-navigation/native';
import Button from '../components/Button';
import { analyzeTaskImage } from '../services/groqService';
import { SettingsContext } from '../context/SettingsContext';
import { getScannedTasks, saveCustomVocabulary, saveScannedTask } from '../services/learningStorage';

const FOLLOW_UPS = [
  { label: 'Explain simpler', prompt: 'Explain this exercise more simply for an A1-A2 Ukrainian-speaking student.' },
  { label: 'Give answer', prompt: 'Give only the correct answer first, then a short explanation.' },
  { label: 'Check my answer', prompt: 'Check the student answer if it is visible. If not visible, ask me to type my answer.' },
];

const extractWords = (text) => {
  const matches = (text || '').match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || [];
  return [...new Set(matches.map(word => word.toLowerCase()))]
    .filter(word => !['this', 'that', 'with', 'from', 'your', 'have', 'will', 'answer', 'explain', 'correct'].includes(word))
    .slice(0, 8);
};

export default function TaskScannerScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [base64, setBase64] = useState(null);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [savedTasks, setSavedTasks] = useState([]);
  const isFocused = useIsFocused();
  
  const { autoPlayAudio } = useContext(SettingsContext);

  useEffect(() => {
    return () => Speech.stop();
  }, []);

  useEffect(() => {
    if (!isFocused) {
      Speech.stop();
    } else {
      loadSavedTasks();
    }
  }, [isFocused]);

  const loadSavedTasks = async () => {
    const tasks = await getScannedTasks();
    setSavedTasks(tasks);
  };

  const pickImage = async (useCamera = false) => {
    let permissionResult;
    if (useCamera) {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (permissionResult.granted === false) {
      alert("Permission to access camera/gallery is required!");
      return;
    }

    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    };

    let result = useCamera 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setBase64(result.assets[0].base64);
      setResult('');
      setRotation(0);
      Speech.stop();
    }
  };

  const handleAnalyze = async (prompt) => {
    if (!base64) return;
    setIsLoading(true);
    const analysis = await analyzeTaskImage(base64, prompt);
    setResult(analysis);
    setIsLoading(false);
    await saveScannedTask({
      imageUri,
      base64,
      result: analysis,
      rotation,
    });
    await loadSavedTasks();
    
    if (autoPlayAudio && analysis) {
      Speech.stop();
      Speech.speak(analysis, { language: 'en-US' });
    }
  };

  const handlePlayAudio = () => {
    if (result) {
      Speech.stop();
      Speech.speak(result, { language: 'en-US' });
    }
  };

  const handleSaveScan = async () => {
    if (!imageUri && !result) return;
    await saveScannedTask({ imageUri, base64, result, rotation });
    await loadSavedTasks();
  };

  const handleRotate = async () => {
    if (!imageUri) return;
    try {
      const rotated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: 90 }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setImageUri(rotated.uri);
      setBase64(rotated.base64);
      setRotation(prev => (prev + 90) % 360);
      setResult('');
    } catch (error) {
      console.error('Failed to rotate image', error);
    }
  };

  const loadSavedScan = (task) => {
    setImageUri(task.imageUri);
    setBase64(task.base64 || null);
    setResult(task.result || '');
    setRotation(task.rotation || 0);
    Speech.stop();
  };

  const importResultWords = async () => {
    const words = extractWords(result);
    await Promise.all(words.map(word => saveCustomVocabulary({
      word,
      meaning: 'Imported from scanned task',
      translation: '',
      examples: [result].filter(Boolean),
    })));
  };

  if (!isFocused) {
    return <View className="flex-1 bg-slate-950" />;
  }

  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
      <Text className="text-2xl font-bold text-slate-100 mb-6 text-center">
        Scan your Textbook Exercise
      </Text>
      <Text className="text-slate-500 text-center mb-6 px-4">
        Hold your phone steady and ensure there is good lighting for the best results.
      </Text>

      {!imageUri ? (
        <View className="flex-1 justify-center items-center">
          <View className="bg-slate-900 w-full rounded-2xl p-8 items-center border border-slate-800 mb-6">
            <Camera size={48} color="#64748b" className="mb-4" />
            <Text className="text-slate-400 text-center mb-6">
              Take a photo of your exercise to get step-by-step solutions and explanations.
            </Text>
            <View className="w-full gap-4">
              <Button 
                title="Take Photo" 
                icon={Camera} 
                onPress={() => pickImage(true)} 
              />
              <Button 
                title="Upload from Gallery" 
                icon={ImageIcon} 
                variant="outline" 
                onPress={() => pickImage(false)} 
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-1">
          <Image 
            source={{ uri: imageUri }} 
            className="w-full h-64 rounded-2xl mb-4" 
            resizeMode="cover" 
          />

          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity onPress={handleRotate} className="flex-1 bg-slate-900 py-3 rounded-full border border-slate-800 flex-row items-center justify-center">
              <RotateCw size={18} color="#a3e635" />
              <Text className="text-lime-400 font-bold ml-2">Rotate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveScan} className="flex-1 bg-slate-900 py-3 rounded-full border border-slate-800 flex-row items-center justify-center">
              <Save size={18} color="#a3e635" />
              <Text className="text-lime-400 font-bold ml-2">Save</Text>
            </TouchableOpacity>
          </View>
          
          {!result && !isLoading && (
            <View className="flex-row gap-4 mb-6">
              <View className="flex-1">
                <Button title="Retake" variant="outline" onPress={() => setImageUri(null)} />
              </View>
              <View className="flex-1">
                <Button title="Analyze" onPress={() => handleAnalyze()} />
              </View>
            </View>
          )}

          {isLoading && (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#a3e635" />
              <Text className="text-slate-400 mt-4">Analyzing exercise...</Text>
            </View>
          )}

          {result ? (
            <View className="bg-slate-900 rounded-2xl p-4 border border-slate-800 mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-lime-400 font-bold text-lg">Solution & Explanation</Text>
                <TouchableOpacity onPress={handlePlayAudio} className="p-2 bg-slate-800 rounded-full">
                  <Volume2 size={20} color="#a3e635" />
                </TouchableOpacity>
              </View>
              <Text className="text-slate-300 leading-6">{result}</Text>

              <View className="flex-row flex-wrap gap-2 mt-4">
                <TouchableOpacity
                  onPress={importResultWords}
                  className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 flex-row items-center"
                >
                  <BookPlus size={14} color="#a3e635" />
                  <Text className="text-lime-400 text-xs font-bold ml-1">Import words</Text>
                </TouchableOpacity>
                {FOLLOW_UPS.map(item => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => handleAnalyze(item.prompt)}
                    disabled={isLoading || !base64}
                    className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 flex-row items-center"
                  >
                    <RefreshCw size={14} color="#a3e635" />
                    <Text className="text-lime-400 text-xs font-bold ml-1">{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View className="mt-6">
                <Button title="Scan Another" variant="outline" onPress={() => {
                  setImageUri(null);
                  setResult('');
                  Speech.stop();
                }} />
              </View>
            </View>
          ) : null}
        </View>
      )}

      {savedTasks.length > 0 && (
        <View className="mt-6">
          <Text className="text-slate-100 font-bold text-lg mb-3">Saved Scans</Text>
          {savedTasks.slice(0, 5).map(task => (
            <TouchableOpacity key={task.id} onPress={() => loadSavedScan(task)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 flex-row items-center">
              <Clock size={18} color="#94a3b8" />
              <View className="ml-3 flex-1">
                <Text className="text-slate-200 font-bold" numberOfLines={1}>
                  {task.result || 'Saved task'}
                </Text>
                <Text className="text-slate-500 text-xs">
                  {new Date(task.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

import React, { useState, useContext, useEffect } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Volume2 } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import Button from '../components/Button';
import { analyzeTaskImage } from '../services/groqService';
import { SettingsContext } from '../context/SettingsContext';

export default function TaskScannerScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [base64, setBase64] = useState(null);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { autoPlayAudio } = useContext(SettingsContext);

  useEffect(() => {
    return () => Speech.stop();
  }, []);

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
      Speech.stop();
    }
  };

  const handleAnalyze = async () => {
    if (!base64) return;
    setIsLoading(true);
    const analysis = await analyzeTaskImage(base64);
    setResult(analysis);
    setIsLoading(false);
    
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
          
          {!result && !isLoading && (
            <View className="flex-row gap-4 mb-6">
              <View className="flex-1">
                <Button title="Retake" variant="outline" onPress={() => setImageUri(null)} />
              </View>
              <View className="flex-1">
                <Button title="Analyze" onPress={handleAnalyze} />
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
    </ScrollView>
  );
}

import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Send, Mic, Square } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import Bubble from '../components/Bubble';
import MistakeCorrection from '../components/MistakeCorrection';
import { sendChatMessage, transcribeAudio } from '../services/groqService';
import { SettingsContext } from '../context/SettingsContext';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: '1', role: 'model', content: { message: "Hello! I'm your AI English Tutor. How can I help you today?", correction: "", explanation: "" } }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const scrollViewRef = useRef();
  const { autoPlayAudio } = useContext(SettingsContext);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      Speech.stop();
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    setIsTranscribing(true);
    const text = await transcribeAudio(uri);
    setIsTranscribing(false);
    
    if (text) {
      setInputText(prev => prev ? `${prev} ${text}`.trim() : text.trim());
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const newUserMsg = { id: Date.now().toString(), role: 'user', content: { message: inputText } };
    const history = [...messages];
    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(history, newUserMsg.content.message);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response
      }]);

      if (autoPlayAudio && response.message) {
        Speech.stop();
        Speech.speak(response.message, { language: 'en-US' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View className="flex-1 bg-slate-950">
        <ScrollView 
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        >
          {messages.map((msg) => (
            <View key={msg.id}>
              <Bubble message={msg.content.message} isUser={msg.role === 'user'} />
              {msg.role === 'model' && (msg.content.correction || msg.content.explanation) && (
                <MistakeCorrection 
                  correction={msg.content.correction} 
                  explanation={msg.content.explanation} 
                />
              )}
            </View>
          ))}
          {isLoading && (
            <View className="self-start mt-2 ml-4">
              <ActivityIndicator color="#a3e635" />
            </View>
          )}
          {isTranscribing && (
            <View className="self-end mt-2 mr-4 flex-row items-center">
              <ActivityIndicator size="small" color="#94a3b8" />
              <Text className="text-slate-400 ml-2 text-xs">Transcribing voice...</Text>
            </View>
          )}
        </ScrollView>

        <View className="p-4 border-t border-slate-800 bg-slate-900 flex-row items-center">
          <TextInput
            className="flex-1 bg-slate-800 text-slate-100 px-4 py-3 rounded-full mr-2"
            placeholder="Type or speak your message..."
            placeholderTextColor="#64748b"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            multiline
          />
          {inputText.trim().length > 0 ? (
            <TouchableOpacity 
              onPress={handleSend} 
              disabled={isLoading}
              className={`w-12 h-12 rounded-full items-center justify-center ${isLoading ? 'bg-slate-700' : 'bg-lime-400'}`}
            >
              <Send size={20} color={isLoading ? '#94a3b8' : '#020617'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={recording ? stopRecording : startRecording} 
              className={`w-12 h-12 rounded-full items-center justify-center ${recording ? 'bg-red-500' : 'bg-slate-700'}`}
            >
              {recording ? (
                <Square size={20} color="#ffffff" />
              ) : (
                <Mic size={20} color="#a3e635" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

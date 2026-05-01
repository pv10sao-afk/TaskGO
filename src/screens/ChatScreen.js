import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Send, Mic, Square, Languages, History, MessageSquarePlus, BookPlus, X } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useNavigation, useRoute } from '@react-navigation/native';
import Bubble from '../components/Bubble';
import MistakeCorrection from '../components/MistakeCorrection';
import { sendChatMessage, transcribeAudio } from '../services/groqService';
import { SettingsContext } from '../context/SettingsContext';
import { getChatSessions, saveChatSession, saveMistake, saveCustomVocabulary } from '../services/learningStorage';

const MODES = [
  { id: 'conversation', label: 'Conversation' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'exam', label: 'Test Prep' },
];

const SUGGESTIONS = {
  conversation: ['Start a small talk roleplay', 'Ask me 3 easy questions', 'Help me answer naturally'],
  grammar: ['Check this sentence', 'Explain present simple', 'Give me a grammar drill'],
  exam: ['Give me an exam question', 'Check my writing answer', 'Teach me a test strategy'],
};

const createWelcomeMessage = () => ({
  id: '1',
  role: 'model',
  content: {
    message: "Hello! I'm your AI English Tutor. Choose a mode or send a message to begin.",
    correction: "",
    explanation: "",
  },
});

const extractWords = (text) => {
  const matches = (text || '').match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || [];
  return [...new Set(matches.map(word => word.replace(/^'|'$/g, '').toLowerCase()))]
    .filter(word => !['this', 'that', 'with', 'from', 'your', 'have', 'will', 'what', 'when', 'where', 'there', 'their', 'about'].includes(word))
    .slice(0, 5);
};

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const lessonPrompt = route.params?.prompt || '';
  const lessonTitle = route.params?.title || 'Lesson roleplay';
  const [messages, setMessages] = useState([createWelcomeMessage()]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mode, setMode] = useState(lessonPrompt ? 'conversation' : 'conversation');
  const [activeLessonPrompt, setActiveLessonPrompt] = useState(lessonPrompt);
  const [activeLessonTitle, setActiveLessonTitle] = useState(lessonTitle);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(Date.now().toString());
  
  const scrollViewRef = useRef();
  const { autoPlayAudio } = useContext(SettingsContext);

  useEffect(() => {
    const loadSessions = async () => {
      const saved = await getChatSessions();
      setSessions(saved);
    };
    loadSessions();
  }, []);

  useEffect(() => {
    if (!lessonPrompt) return;
    setActiveLessonPrompt(lessonPrompt);
    setActiveLessonTitle(lessonTitle);
    setMode('conversation');
  }, [lessonPrompt, lessonTitle]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      Speech.stop();
    };
  }, [recording]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const persist = async () => {
      const firstUserMessage = messages.find(item => item.role === 'user')?.content?.message;
      const session = {
        id: sessionId,
        mode,
        lessonPrompt: activeLessonPrompt,
        lessonTitle: activeLessonTitle,
        title: firstUserMessage ? firstUserMessage.slice(0, 42) : 'AI Tutor chat',
        messages,
      };
      await saveChatSession(session);
      const saved = await getChatSessions();
      setSessions(saved);
    };
    persist();
  }, [messages, mode, sessionId, activeLessonPrompt, activeLessonTitle]);

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

  const handleSend = async (overrideText) => {
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend || isLoading) return;

    const newUserMsg = { id: Date.now().toString(), role: 'user', content: { message: textToSend } };
    const history = [...messages];
    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(history, newUserMsg.content.message, {
        mode,
        extraInstruction: activeLessonPrompt,
      });

      const modelMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response,
      };
      setMessages(prev => [...prev, modelMessage]);

      if (response.correction || response.explanation) {
        await saveMistake({
          source: 'AI Tutor',
          prompt: textToSend,
          correction: response.correction,
          explanation: response.explanation,
        });
      }

      if (autoPlayAudio && response.message) {
        Speech.stop();
        Speech.speak(response.message, { language: 'en-US' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const explainInUkrainian = () => {
    handleSend('Поясни попередню відповідь українською мовою простими словами.');
  };

  const startNewChat = () => {
    Speech.stop();
    navigation.setParams({ prompt: undefined, title: undefined });
    setActiveLessonPrompt('');
    setActiveLessonTitle('Lesson roleplay');
    setSessionId(Date.now().toString());
    setMessages([createWelcomeMessage()]);
    setInputText('');
  };

  const handleModeSelect = (nextMode) => {
    navigation.setParams({ prompt: undefined, title: undefined });
    setActiveLessonPrompt('');
    setActiveLessonTitle('Lesson roleplay');
    setMode(nextMode);
  };

  const clearLessonContext = () => {
    navigation.setParams({ prompt: undefined, title: undefined });
    setActiveLessonPrompt('');
    setActiveLessonTitle('Lesson roleplay');
  };

  const loadSession = (session) => {
    Speech.stop();
    setSessionId(session.id);
    setMode(session.mode || 'conversation');
    setActiveLessonPrompt(session.lessonPrompt || '');
    setActiveLessonTitle(session.lessonTitle || 'Lesson roleplay');
    setMessages(session.messages?.length ? session.messages : [createWelcomeMessage()]);
  };

  const importReplyWords = async (message) => {
    const words = extractWords(message?.content?.message);
    await Promise.all(words.map(word => saveCustomVocabulary({
      word,
      meaning: 'Imported from AI Tutor',
      translation: '',
      examples: [message.content.message].filter(Boolean),
    })));
    if (words.length > 0) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: { message: `Saved ${words.length} words to Vocab Bank.`, correction: '', explanation: '' },
      }]);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View className="flex-1 bg-slate-950">
        <View className="px-4 pt-3 pb-2 border-b border-slate-900">
          <View className="flex-row gap-2 mb-3">
            {MODES.map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleModeSelect(item.id)}
                className={`flex-1 py-2 rounded-full border items-center ${mode === item.id ? 'bg-lime-400 border-lime-400' : 'bg-slate-900 border-slate-800'}`}
              >
                <Text className={`text-xs font-bold ${mode === item.id ? 'text-slate-950' : 'text-slate-300'}`}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!activeLessonPrompt && (
            <View className="mb-2 bg-indigo-500/10 border border-indigo-500/40 rounded-2xl px-3 py-2 flex-row items-center">
              <Text className="flex-1 text-indigo-200 text-xs font-bold" numberOfLines={1}>
                Roleplay active: {activeLessonTitle}
              </Text>
              <TouchableOpacity onPress={clearLessonContext} className="p-1">
                <X size={14} color="#c4b5fd" />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <TouchableOpacity onPress={startNewChat} className="mr-2 px-3 py-2 rounded-full bg-slate-900 border border-slate-800 flex-row items-center">
              <MessageSquarePlus size={14} color="#a3e635" />
              <Text className="text-slate-300 text-xs font-bold ml-1">New</Text>
            </TouchableOpacity>
            {sessions.slice(0, 4).map(session => (
              <TouchableOpacity key={session.id} onPress={() => loadSession(session)} className="mr-2 px-3 py-2 rounded-full bg-slate-900 border border-slate-800 flex-row items-center max-w-48">
                <History size={14} color="#94a3b8" />
                <Text numberOfLines={1} className="text-slate-300 text-xs font-bold ml-1">{session.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        >
          {messages.map((msg, index) => (
            <View key={msg.id}>
              <Bubble message={msg.content.message} isUser={msg.role === 'user'} />
              {msg.role === 'model' && (msg.content.correction || msg.content.explanation) && (
                <MistakeCorrection 
                  correction={msg.content.correction} 
                  explanation={msg.content.explanation} 
                />
              )}
              {msg.role === 'model' && index === messages.length - 1 && messages.length > 1 && (
                <View className="self-start ml-4 mt-1 mb-2 flex-row gap-2">
                  <TouchableOpacity onPress={explainInUkrainian} className="px-3 py-2 rounded-full bg-slate-900 border border-slate-800 flex-row items-center">
                    <Languages size={14} color="#a3e635" />
                    <Text className="text-lime-400 text-xs font-bold ml-1">Поясни українською</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => importReplyWords(msg)} className="px-3 py-2 rounded-full bg-slate-900 border border-slate-800 flex-row items-center">
                    <BookPlus size={14} color="#a3e635" />
                    <Text className="text-lime-400 text-xs font-bold ml-1">Save words</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          {messages.length === 1 && (
            <View className="mt-2">
              {(SUGGESTIONS[mode] || []).map(item => (
                <TouchableOpacity key={item} onPress={() => handleSend(item)} className="self-start my-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800">
                  <Text className="text-slate-200 font-semibold">{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
            onSubmitEditing={() => handleSend()}
            multiline
          />
          {inputText.trim().length > 0 ? (
            <TouchableOpacity
              onPress={() => handleSend()}
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

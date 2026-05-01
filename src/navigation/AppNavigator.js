import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MessageCircle, Camera, BookOpen } from 'lucide-react-native';

// Import Screens
import DashboardScreen from '../screens/DashboardScreen';
import ChatScreen from '../screens/ChatScreen';
import TaskScannerScreen from '../screens/TaskScannerScreen';
import VocabBankScreen from '../screens/VocabBankScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PracticeScreen from '../screens/PracticeScreen';
import ExerciseScreen from '../screens/ExerciseScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconProps = { color: focused ? '#a3e635' : '#64748b', size };
          if (route.name === 'Dashboard') return <Home {...iconProps} />;
          if (route.name === 'Chat') return <MessageCircle {...iconProps} />;
          if (route.name === 'Scanner') return <Camera {...iconProps} />;
          if (route.name === 'Vocab') return <BookOpen {...iconProps} />;
        },
        tabBarActiveTintColor: '#a3e635',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopColor: '#1e293b',
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: '#020617',
          borderBottomColor: '#1e293b',
          borderBottomWidth: 1,
        },
        headerTintColor: '#f8fafc',
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '800',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'AI Tutor', tabBarLabel: 'AI Tutor' }} />
      <Tab.Screen name="Scanner" component={TaskScannerScreen} options={{ title: 'Upload Task', tabBarLabel: 'Upload Task', unmountOnBlur: true }} />
      <Tab.Screen name="Vocab" component={VocabBankScreen} options={{ title: 'Vocab Bank', tabBarLabel: 'Vocab Bank' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Practice" component={PracticeScreen} />
        <Stack.Screen name="Exercise" component={ExerciseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

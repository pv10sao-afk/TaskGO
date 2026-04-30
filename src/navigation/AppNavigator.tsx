import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { C } from '../constants/theme';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ChatScreen } from '../screens/ChatScreen';
import { FlashcardScreen } from '../screens/FlashcardScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LearnScreen } from '../screens/LearnScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { ACCESS_STATUS_EVENT, getAccessStatus } from '../services/access';
import type { AccessStatus, Exercise, PracticeFocus, PracticeSessionSource } from '../types';

export type AppTabParamList = {
  Home: undefined;
  Learn: undefined;
  Practice:
    | {
        quickStart?: boolean;
        focus?: PracticeFocus;
        presetExercise?: Exercise;
        source?: PracticeSessionSource;
      }
    | undefined;
  Chat: undefined;
};

export type AppRootParamList = {
  Tabs: undefined;
  Flashcard: undefined;
  Subscription: undefined;
  Library: undefined;
  Stats: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createStackNavigator<AppRootParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.surface,
    primary: C.accent,
    text: C.text,
    border: C.surface,
  },
};

function AccessBadge({
  accessStatus,
  onPress,
}: {
  accessStatus: AccessStatus | null;
  onPress?: () => void;
}) {
  if (!accessStatus) {
    return null;
  }

  const isVip = accessStatus.tier === 'vip';
  const badge = (
    <View style={[styles.accessBadge, isVip ? styles.accessBadgeVip : styles.accessBadgeFree]}>
      <Text style={[styles.accessBadgeText, isVip ? styles.accessBadgeTextVip : styles.accessBadgeTextFree]}>
        {isVip ? 'VIP' : 'FREE'}
      </Text>
    </View>
  );

  if (!onPress) {
    return badge;
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      {badge}
    </TouchableOpacity>
  );
}

function TabNavigator({
  accessStatus,
  onOpenSubscription,
}: {
  accessStatus: AccessStatus | null;
  onOpenSubscription: () => void;
}) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerShadowVisible: false,
        headerRight: () => <AccessBadge accessStatus={accessStatus} onPress={onOpenSubscription} />,
        sceneStyle: { backgroundColor: C.bg },
        tabBarActiveTintColor: C.accentLight,
        tabBarInactiveTintColor: C.textDim,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.cardBorder,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 14,
          paddingTop: 10,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 3,
        },
        tabBarItemStyle: { borderRadius: 14 },
        tabBarIcon: ({ color, focused }) => {
          const TAB_ICONS: Record<string, [string, string]> = {
            Home:     ['home-variant',   'home-variant-outline'],
            Learn:    ['book-open-page-variant', 'book-open-page-variant-outline'],
            Practice: ['lightning-bolt', 'lightning-bolt-outline'],
            Chat:     ['robot',          'robot-outline'],
          };
          const [active, inactive] = TAB_ICONS[route.name] ?? ['help-circle', 'help-circle-outline'];
          const iconName = focused ? active : inactive;
          return <MaterialCommunityIcons color={color} name={iconName as any} size={26} />;
        },
        tabBarLabel:
          route.name === 'Home'
            ? 'Дім'
            : route.name === 'Learn'
              ? 'Вчити'
              : route.name === 'Practice'
                ? 'Практика'
                : 'AI-Чат',
      })}
    >
      <Tab.Screen component={HomeScreen} name="Home" options={{ title: 'Головна' }} />
      <Tab.Screen component={LearnScreen} name="Learn" options={{ title: 'Вчити' }} />
      <Tab.Screen component={PracticeScreen} name="Practice" options={{ title: 'Практика' }} />
      <Tab.Screen component={ChatScreen} name="Chat" options={{ title: 'AI-Чат' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadAccessStatus() {
      const nextAccessStatus = await getAccessStatus();

      if (isActive) {
        setAccessStatus(nextAccessStatus);
      }
    }

    const subscription = DeviceEventEmitter.addListener(ACCESS_STATUS_EVENT, () => {
      void loadAccessStatus();
    });

    void loadAccessStatus();

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs">
          {({ navigation }) => (
            <TabNavigator
              accessStatus={accessStatus}
              onOpenSubscription={() => navigation.navigate('Subscription')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          component={FlashcardScreen}
          name="Flashcard"
          options={({ navigation }) => ({
            headerShown: true,
            headerTitle: '🃏 Флеш-картки',
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.text,
            headerShadowVisible: false,
            headerRight: () => (
              <AccessBadge accessStatus={accessStatus} onPress={() => navigation.navigate('Subscription')} />
            ),
            animation: 'slide_from_bottom',
          })}
        />
        <Stack.Screen
          component={SubscriptionScreen}
          name="Subscription"
          options={{
            headerShown: true,
            headerTitle: 'Підписка',
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.text,
            headerShadowVisible: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          component={LibraryScreen}
          name="Library"
          options={{
            headerShown: true,
            headerTitle: 'База слів та курсів',
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.text,
            headerShadowVisible: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          component={StatsScreen}
          name="Stats"
          options={{
            headerShown: true,
            headerTitle: 'Статистика',
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.text,
            headerShadowVisible: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  accessBadge: {
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  accessBadgeVip: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderColor: 'rgba(129,140,248,0.5)',
  },
  accessBadgeFree: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  accessBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  accessBadgeTextVip: {
    color: '#818CF8',
  },
  accessBadgeTextFree: {
    color: '#64748B',
  },
});

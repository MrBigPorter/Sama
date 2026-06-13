import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useFront } from '@/lib/theme/ThemeContext';
import { authService } from '@/services/authService';
import { useSocket } from '@/lib/hooks/useSocket';
import { SocketEvent } from '@/services/socketService';
import IncomingCallOverlay from '@/components/call/IncomingCallOverlay';

// Screens
import ChatListScreen from '@/screens/ChatListScreen';
import ContactsScreen from '@/screens/ContactsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ConversationScreen from '@/screens/ConversationScreen';
import CallScreen from '@/screens/CallScreen';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import GroupProfileScreen from '@/screens/GroupProfileScreen';
import GroupSettingsScreen from '@/screens/GroupSettingsScreen';
import GroupRequestListScreen from '@/screens/GroupRequestListScreen';
import CreateGroupScreen from '@/screens/CreateGroupScreen';
import NewFriendScreen from '@/screens/NewFriendScreen';
import SearchScreen from '@/screens/SearchScreen';
import UserProfileScreen from '@/screens/UserProfileScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Conversation: { conversationId: string; title: string; groupId?: string };
  Call: { sessionId: string; targetId: string; mediaType: 'audio' | 'video' };
  GroupProfile: { conversationId: string; groupId: string };
  GroupSettings: { groupId: string; conversationId: string };
  GroupRequestList: { groupId: string; conversationId: string };
  CreateGroup: undefined;
  NewFriend: undefined;
  Search: undefined;
  UserProfile: { userId: string; nickname?: string; avatar?: string };
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type MainTabParamList = {
  Chats: undefined;
  Contacts: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const { colors } = useFront();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: focused ? colors.utilityBrand500 || '#FF7A00' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 12, color: focused ? '#fff' : '#999' }}>{label[0]}</Text>
      </View>
    </View>
  );
}

function MainTabs() {
  const { colors } = useFront();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.utilityBrand500 || '#FF7A00',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: colors.bgPrimary,
          borderTopColor: colors.borderSecondary,
        },
        headerStyle: { backgroundColor: colors.bgPrimary },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Chats" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Contacts" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  const { colors } = useFront();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgPrimary },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
    </Stack.Navigator>
  );
}

function MainStack() {
  const { colors } = useFront();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgPrimary },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="GroupProfile"
        component={GroupProfileScreen}
        options={{ title: 'Group Chat' }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ title: 'Group Settings' }}
      />
      <Stack.Screen
        name="GroupRequestList"
        component={GroupRequestListScreen}
        options={{ title: 'Join Requests' }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'New Group' }}
      />
      <Stack.Screen
        name="NewFriend"
        component={NewFriendScreen}
        options={{ title: 'New Friends' }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={({ route }) => ({ title: route.params.nickname || 'Profile' })}
      />
    </Stack.Navigator>
  );
}

export function Navigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated);
  const [incomingCall, setIncomingCall] = useState<{
    sessionId: string;
    senderId: string;
    mediaType: 'audio' | 'video';
  } | null>(null);

  useEffect(() => {
    // Check stored token on mount
    if (authService.isAuthenticated) {
      authService.fetchMe().catch(() => {
        setIsAuthenticated(false);
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = authService.subscribe((user) => {
      setIsAuthenticated(!!user);
    });
    return unsubscribe;
  }, []);

  // ── Listen for incoming call invites ───────────────────────────
  const handleCallInvite = useCallback((payload: {
    sessionId: string;
    senderId: string;
    mediaType: 'audio' | 'video';
  }) => {
    setIncomingCall({
      sessionId: payload.sessionId,
      senderId: payload.senderId,
      mediaType: payload.mediaType,
    });
  }, []);

  useSocket(SocketEvent.CALL_INVITE, handleCallInvite);

  const handleAcceptCall = useCallback(() => {
    // IncomingCallOverlay handles navigation internally
    setIncomingCall(null);
  }, []);

  const handleRejectCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
      {incomingCall && (
        <IncomingCallOverlay
          sessionId={incomingCall.sessionId}
          senderId={incomingCall.senderId}
          mediaType={incomingCall.mediaType}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
    </NavigationContainer>
  );
}

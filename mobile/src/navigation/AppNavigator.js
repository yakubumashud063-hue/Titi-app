import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ChatScreen from '../screens/ChatScreen';
import FamilyScreen from '../screens/FamilyScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#FF6B9D' }}>
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ tabBarIcon: () => <Text style={{fontSize: 20}}>💬</Text> }}
      />
      <Tab.Screen 
        name="Family" 
        component={FamilyScreen} 
        options={{ tabBarIcon: () => <Text style={{fontSize: 20}}>👨‍👩‍👧‍👦</Text> }}
      />
    </Tab.Navigator>
  );
}

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Simple mock for Text in this file since it's just used for emojis
import { Text } from 'react-native';

export default AppNavigator;

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Vibrant Duolingo-inspired colors
export const COLORS = {
  primary: '#58CC02',
  primaryDark: '#46A302',
  secondary: '#1CB0F6',
  warning: '#FF9600',
  danger: '#FF4B4B',
  success: '#58CC02',
  background: '#131F24',
  cardBackground: '#1A2C34',
  surface: '#233A44',
  text: '#FFFFFF',
  textSecondary: '#AFAFAF',
  border: '#37464F',
  tabBar: '#131F24',
  tabBarActive: '#58CC02',
  tabBarInactive: '#6B7280',
};

export default function Layout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.tabBar,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 85 : 65,
            paddingBottom: Platform.OS === 'ios' ? 25 : 10,
            paddingTop: 10,
          },
          tabBarActiveTintColor: COLORS.tabBarActive,
          tabBarInactiveTintColor: COLORS.tabBarInactive,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="practice"
          options={{
            title: 'Practice',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="category/[id]"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

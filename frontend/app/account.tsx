import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { COLORS } from './_layout';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_color: string;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  daily_goal: number;
}

const AVATAR_COLORS = [
  '#58CC02', '#1CB0F6', '#FF9600', '#FF4B4B', 
  '#9B59B6', '#E91E63', '#00BCD4', '#4CAF50'
];

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setTempName(data.name);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const updateProfile = async (updates: Partial<Profile>) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        if (updates.name) {
          setEditingName(false);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      updateProfile({ name: tempName.trim() });
    }
  };

  const handleColorSelect = (color: string) => {
    updateProfile({ avatar_color: color });
  };

  const handleDailyGoalChange = (increment: boolean) => {
    const currentGoal = profile?.daily_goal || 10;
    const newGoal = increment 
      ? Math.min(currentGoal + 5, 50) 
      : Math.max(currentGoal - 5, 5);
    updateProfile({ daily_goal: newGoal });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Manage your profile and settings</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={[
            styles.avatar, 
            { backgroundColor: profile?.avatar_color || COLORS.primary }
          ]}>
            <Ionicons name="person" size={40} color="white" />
          </View>
          
          {editingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                style={styles.nameInput}
                value={tempName}
                onChangeText={setTempName}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
              />
              <View style={styles.nameEditButtons}>
                <TouchableOpacity
                  style={[styles.nameButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingName(false);
                    setTempName(profile?.name || '');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nameButton, styles.saveButton]}
                  onPress={handleNameSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameContainer}
              onPress={() => setEditingName(true)}
            >
              <Text style={styles.profileName}>{profile?.name || 'Learner'}</Text>
              <Ionicons name="pencil" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Avatar Color Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avatar Color</Text>
          <View style={styles.colorGrid}>
            {AVATAR_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  profile?.avatar_color === color && styles.colorSelected,
                ]}
                onPress={() => handleColorSelect(color)}
              >
                {profile?.avatar_color === color && (
                  <Ionicons name="checkmark" size={20} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Daily Goal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Goal</Text>
          <View style={styles.goalContainer}>
            <TouchableOpacity
              style={styles.goalButton}
              onPress={() => handleDailyGoalChange(false)}
              disabled={saving || (profile?.daily_goal || 10) <= 5}
            >
              <Ionicons name="remove" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.goalDisplay}>
              <Text style={styles.goalValue}>{profile?.daily_goal || 10}</Text>
              <Text style={styles.goalLabel}>words/day</Text>
            </View>
            <TouchableOpacity
              style={styles.goalButton}
              onPress={() => handleDailyGoalChange(true)}
              disabled={saving || (profile?.daily_goal || 10) >= 50}
            >
              <Ionicons name="add" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={profile?.notifications_enabled ?? true}
              onValueChange={(value) => updateProfile({ notifications_enabled: value })}
              trackColor={{ false: COLORS.surface, true: COLORS.primary }}
              thumbColor="white"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high-outline" size={24} color={COLORS.text} />
              <Text style={styles.settingLabel}>Sound Effects</Text>
            </View>
            <Switch
              value={profile?.sound_enabled ?? true}
              onValueChange={(value) => updateProfile({ sound_enabled: value })}
              trackColor={{ false: COLORS.surface, true: COLORS.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Maram Language</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  profileCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  nameEditContainer: {
    width: '100%',
    alignItems: 'center',
  },
  nameInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: COLORS.text,
    width: '100%',
    textAlign: 'center',
  },
  nameEditButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  nameButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: 'white',
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  goalButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalDisplay: {
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  goalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  appVersion: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

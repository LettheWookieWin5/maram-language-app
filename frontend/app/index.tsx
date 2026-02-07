import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from './_layout';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Progress {
  words_learned: string[];
  practice_sessions: number;
  total_words_practiced: number;
  streak_days: number;
}

interface Profile {
  name: string;
  avatar_color: string;
  daily_goal: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [progressRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/api/progress`),
        fetch(`${API_URL}/api/profile`),
      ]);
      
      if (progressRes.ok) {
        const progressData = await progressRes.json();
        setProgress(progressData);
      }
      
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const wordsToday = progress?.words_learned?.length || 0;
  const dailyGoal = profile?.daily_goal || 10;
  const progressPercent = Math.min((wordsToday / dailyGoal) * 100, 100);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.name || 'Learner'}!</Text>
          <Text style={styles.subtitle}>Ready to learn Maram today?</Text>
        </View>
        <View style={[styles.avatarContainer, { backgroundColor: profile?.avatar_color || COLORS.primary }]}>
          <Ionicons name="person" size={24} color="white" />
        </View>
      </View>

      {/* Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakContent}>
          <Ionicons name="flame" size={40} color="#FF9600" />
          <View style={styles.streakInfo}>
            <Text style={styles.streakNumber}>{progress?.streak_days || 0}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
        </View>
        <Text style={styles.streakMotivation}>
          {progress?.streak_days ? "Keep it going!" : "Start your streak today!"}
        </Text>
      </View>

      {/* Daily Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Today's Goal</Text>
          <Text style={styles.progressCount}>{wordsToday}/{dailyGoal} words</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          {progressPercent >= 100 
            ? "Goal achieved! Great job!" 
            : `${dailyGoal - wordsToday} more words to reach your goal`}
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="book-outline" size={28} color={COLORS.secondary} />
          <Text style={styles.statNumber}>{progress?.words_learned?.length || 0}</Text>
          <Text style={styles.statLabel}>Words Learned</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trophy-outline" size={28} color={COLORS.warning} />
          <Text style={styles.statNumber}>{progress?.practice_sessions || 0}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => router.push('/practice')}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaText}>Start Learning</Text>
        <Ionicons name="arrow-forward" size={24} color="white" />
      </TouchableOpacity>

      {/* Tips Section */}
      <View style={styles.tipsCard}>
        <Ionicons name="bulb" size={24} color={COLORS.warning} />
        <View style={styles.tipsContent}>
          <Text style={styles.tipsTitle}>Learning Tip</Text>
          <Text style={styles.tipsText}>
            Practice regularly for better retention. Try to learn at least 5 new words daily!
          </Text>
        </View>
      </View>
    </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FF9600',
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakInfo: {
    marginLeft: 16,
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF9600',
  },
  streakLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  streakMotivation: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
  },
  progressCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressCount: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressHint: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tipsCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

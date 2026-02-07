import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { COLORS } from './_layout';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const screenWidth = Dimensions.get('window').width;

interface Progress {
  words_learned: string[];
  practice_sessions: number;
  total_words_practiced: number;
  streak_days: number;
  category_progress: { [key: string]: number };
}

interface Category {
  id: string;
  name: string;
  color: string;
  word_count: number;
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [progressRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/api/progress`),
        fetch(`${API_URL}/api/categories`),
      ]);

      if (progressRes.ok) {
        const progressData = await progressRes.json();
        setProgress(progressData);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

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

  // Prepare chart data for category progress
  const categoryChartData = categories.map((cat) => {
    const learned = progress?.category_progress?.[cat.id] || 0;
    return {
      value: learned,
      label: cat.name.substring(0, 6),
      frontColor: cat.color,
      topLabelComponent: () => (
        <Text style={{ color: COLORS.text, fontSize: 10, marginBottom: 4 }}>
          {learned}
        </Text>
      ),
    };
  });

  // Prepare pie chart data
  const totalWords = categories.reduce((sum, cat) => sum + cat.word_count, 0);
  const learnedCount = progress?.words_learned?.length || 0;
  const remainingCount = Math.max(0, totalWords - learnedCount);

  const pieData = [
    { value: learnedCount, color: COLORS.primary, text: `${learnedCount}` },
    { value: remainingCount, color: COLORS.surface, text: `${remainingCount}` },
  ];

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
        <Text style={styles.title}>Your Progress</Text>
        <Text style={styles.subtitle}>Track your learning journey</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(255, 150, 0, 0.2)' }]}>
            <Ionicons name="flame" size={28} color="#FF9600" />
          </View>
          <Text style={styles.statValue}>{progress?.streak_days || 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(88, 204, 2, 0.2)' }]}>
            <Ionicons name="book" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>{learnedCount}</Text>
          <Text style={styles.statLabel}>Words Learned</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(28, 176, 246, 0.2)' }]}>
            <Ionicons name="trophy" size={28} color={COLORS.secondary} />
          </View>
          <Text style={styles.statValue}>{progress?.practice_sessions || 0}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(155, 89, 182, 0.2)' }]}>
            <Ionicons name="repeat" size={28} color="#9B59B6" />
          </View>
          <Text style={styles.statValue}>{progress?.total_words_practiced || 0}</Text>
          <Text style={styles.statLabel}>Total Practice</Text>
        </View>
      </View>

      {/* Overall Progress Pie Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Overall Completion</Text>
        <View style={styles.pieContainer}>
          <PieChart
            data={pieData}
            donut
            radius={80}
            innerRadius={55}
            innerCircleColor={COLORS.cardBackground}
            centerLabelComponent={() => (
              <View style={styles.pieCenter}>
                <Text style={styles.pieCenterValue}>
                  {totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0}%
                </Text>
                <Text style={styles.pieCenterLabel}>Complete</Text>
              </View>
            )}
          />
          <View style={styles.pieLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.legendText}>Learned ({learnedCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.surface }]} />
              <Text style={styles.legendText}>Remaining ({remainingCount})</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Progress Bar Chart */}
      {categoryChartData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Progress by Category</Text>
          <View style={styles.barChartContainer}>
            <BarChart
              data={categoryChartData}
              barWidth={28}
              spacing={16}
              roundedTop
              roundedBottom
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: COLORS.textSecondary }}
              xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...categoryChartData.map((d) => d.value), 10)}
              rulesColor={COLORS.border}
              rulesType="solid"
              backgroundColor={COLORS.cardBackground}
              isAnimated
            />
          </View>
        </View>
      )}

      {/* Achievement Cards */}
      <View style={styles.achievementSection}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementRow}>
          <View style={[
            styles.achievementCard,
            learnedCount >= 5 && styles.achievementUnlocked
          ]}>
            <Ionicons 
              name="star" 
              size={32} 
              color={learnedCount >= 5 ? '#FFD700' : COLORS.textSecondary} 
            />
            <Text style={styles.achievementName}>First 5</Text>
            <Text style={styles.achievementDesc}>Learn 5 words</Text>
          </View>

          <View style={[
            styles.achievementCard,
            learnedCount >= 20 && styles.achievementUnlocked
          ]}>
            <Ionicons 
              name="ribbon" 
              size={32} 
              color={learnedCount >= 20 ? '#C0C0C0' : COLORS.textSecondary} 
            />
            <Text style={styles.achievementName}>Scholar</Text>
            <Text style={styles.achievementDesc}>Learn 20 words</Text>
          </View>

          <View style={[
            styles.achievementCard,
            (progress?.streak_days || 0) >= 3 && styles.achievementUnlocked
          ]}>
            <Ionicons 
              name="flame" 
              size={32} 
              color={(progress?.streak_days || 0) >= 3 ? '#FF6B6B' : COLORS.textSecondary} 
            />
            <Text style={styles.achievementName}>On Fire</Text>
            <Text style={styles.achievementDesc}>3 day streak</Text>
          </View>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  pieContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  pieCenter: {
    alignItems: 'center',
  },
  pieCenterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  pieCenterLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  pieLegend: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: COLORS.text,
  },
  barChartContainer: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  achievementSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  achievementRow: {
    flexDirection: 'row',
    gap: 12,
  },
  achievementCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  achievementUnlocked: {
    opacity: 1,
    borderColor: COLORS.primary,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  achievementDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});

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

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  word_count: number;
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const seedDatabase = async () => {
    setSeeding(true);
    try {
      const response = await fetch(`${API_URL}/api/seed`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchCategories();
      }
    } catch (error) {
      console.error('Error seeding database:', error);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
  };

  const handleCategoryPress = (category: Category) => {
    router.push({
      pathname: '/category/[id]',
      params: { id: category.id, name: category.name, color: category.color },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>Choose a category to start learning</Text>
      </View>

      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Categories Yet</Text>
          <Text style={styles.emptyText}>Load sample data to get started</Text>
          <TouchableOpacity
            style={styles.seedButton}
            onPress={seedDatabase}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="white" />
                <Text style={styles.seedButtonText}>Load Sample Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.categoriesGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, { backgroundColor: category.color }]}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.8}
            >
              <View style={styles.categoryIconContainer}>
                <Ionicons
                  name={category.icon as any}
                  size={36}
                  color="white"
                />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCount}>{category.word_count} words</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 24,
  },
  seedButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryCard: {
    width: '47%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  categoryCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
});

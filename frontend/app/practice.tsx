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

type TabType = 'wordlist' | 'flashcards' | 'sentences';

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('wordlist');
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

  const handleFlashcardCategoryPress = (category: Category) => {
    router.push({
      pathname: '/flashcards/[id]',
      params: { id: category.id, name: category.name, color: category.color },
    });
  };

  const handleSentenceCategoryPress = (category: Category) => {
    router.push({
      pathname: '/sentences/[id]',
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

  const renderEmptyState = () => (
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
  );

  const renderCategories = (mode: 'wordlist' | 'flashcards' | 'sentences') => (
    <View style={styles.categoriesGrid}>
      {categories.map((category) => {
        const iconName = mode === 'flashcards' ? 'albums' : mode === 'sentences' ? 'chatbubbles' : category.icon as any;
        const label = mode === 'flashcards' ? `${category.word_count} cards` : mode === 'sentences' ? '4 sentences' : `${category.word_count} words`;
        const onPress = mode === 'flashcards' 
          ? () => handleFlashcardCategoryPress(category) 
          : mode === 'sentences' 
            ? () => handleSentenceCategoryPress(category) 
            : () => handleCategoryPress(category);
        
        return (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, { backgroundColor: category.color }]}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <View style={styles.categoryIconContainer}>
              <Ionicons
                name={iconName}
                size={36}
                color="white"
              />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryCount}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>Choose a category to start learning</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'wordlist' && styles.tabActive]}
          onPress={() => setActiveTab('wordlist')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="list" 
            size={18} 
            color={activeTab === 'wordlist' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'wordlist' && styles.tabTextActive]}>
            Word List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'flashcards' && styles.tabActive]}
          onPress={() => setActiveTab('flashcards')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="albums" 
            size={18} 
            color={activeTab === 'flashcards' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'flashcards' && styles.tabTextActive]}>
            Flashcards
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sentences' && styles.tabActive]}
          onPress={() => setActiveTab('sentences')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="chatbubbles" 
            size={18} 
            color={activeTab === 'sentences' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'sentences' && styles.tabTextActive]}>
            Sentences
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {categories.length === 0 
          ? renderEmptyState() 
          : renderCategories(activeTab)
        }
      </ScrollView>
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 16,
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: COLORS.cardBackground,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
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

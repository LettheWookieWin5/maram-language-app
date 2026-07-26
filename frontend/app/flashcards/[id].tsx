import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../_layout';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

interface Word {
  id: string;
  maram: string;
  english: string;
  audio_url: string | null;
  category_id: string;
}

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name, color } = useLocalSearchParams<{ id: string; name: string; color: string }>();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showMaram, setShowMaram] = useState(true); // Front shows Maram, back shows English
  
  // Animation values
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchWords();
  }, [id]);

  const fetchWords = async () => {
    try {
      const response = await fetch(`${API_URL}/api/words?category_id=${id}`);
      if (response.ok) {
        const data = await response.json();
        setWords(data);
      }
    } catch (error) {
      console.error('Error fetching words:', error);
    } finally {
      setLoading(false);
    }
  };

  const flipCard = () => {
    const toValue = isFlipped ? 0 : 1;
    Animated.spring(flipAnimation, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const goToNextCard = () => {
    if (currentIndex < words.length - 1) {
      // Slide out animation
      Animated.timing(slideAnimation, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
        flipAnimation.setValue(0);
        slideAnimation.setValue(SCREEN_WIDTH);
        
        // Slide in animation
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const goToPrevCard = () => {
    if (currentIndex > 0) {
      // Slide out animation
      Animated.timing(slideAnimation, {
        toValue: SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(currentIndex - 1);
        setIsFlipped(false);
        flipAnimation.setValue(0);
        slideAnimation.setValue(-SCREEN_WIDTH);
        
        // Slide in animation
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const shuffleCards = () => {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnimation.setValue(0);
  };

  const toggleCardSide = () => {
    setShowMaram(!showMaram);
    setIsFlipped(false);
    flipAnimation.setValue(0);
  };

  // Interpolations for flip animation
  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const currentWord = words[currentIndex];

  // Handle empty words array
  if (words.length === 0 || !currentWord) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: color || COLORS.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/practice')}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{name || 'Flashcards'}</Text>
          </View>
        </View>
        <View style={[styles.centered, { flex: 1 }]}>
          <Ionicons name="albums-outline" size={64} color={COLORS.textSecondary} />
          <Text style={{ color: COLORS.text, fontSize: 18, marginTop: 16 }}>No flashcards available</Text>
          <TouchableOpacity 
            style={{ marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.replace('/practice')}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: color || COLORS.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/practice')}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{name || 'Flashcards'}</Text>
          <Text style={styles.headerSubtitle}>
            Card {currentIndex + 1} of {words.length}
          </Text>
        </View>
        <TouchableOpacity style={styles.shuffleButton} onPress={shuffleCards}>
          <Ionicons name="shuffle" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${((currentIndex + 1) / words.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {/* Card Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity 
          style={[styles.modeButton, showMaram && styles.modeButtonActive]}
          onPress={() => { setShowMaram(true); setIsFlipped(false); flipAnimation.setValue(0); }}
        >
          <Text style={[styles.modeButtonText, showMaram && styles.modeButtonTextActive]}>
            Maram → English
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modeButton, !showMaram && styles.modeButtonActive]}
          onPress={() => { setShowMaram(false); setIsFlipped(false); flipAnimation.setValue(0); }}
        >
          <Text style={[styles.modeButtonText, !showMaram && styles.modeButtonTextActive]}>
            English → Maram
          </Text>
        </TouchableOpacity>
      </View>

      {/* Flashcard */}
      <View style={styles.cardContainer}>
        <Animated.View style={{ transform: [{ translateX: slideAnimation }] }}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={flipCard}
            style={styles.cardTouchable}
          >
            {/* Front of Card */}
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: color || COLORS.primary },
                {
                  transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
                  opacity: frontOpacity,
                },
              ]}
            >
              <View style={styles.cardLabelContainer}>
                <Text style={styles.cardLabel}>
                  {showMaram ? 'MARAM' : 'ENGLISH'}
                </Text>
              </View>
              <Text style={styles.cardWord}>
                {showMaram ? currentWord?.maram : currentWord?.english}
              </Text>
              <View style={styles.tapHint}>
                <Ionicons name="refresh-outline" size={18} color="rgba(255,255,255,0.7)" />
                <Text style={styles.tapHintText}>Tap to flip</Text>
              </View>
            </Animated.View>

            {/* Back of Card */}
            <Animated.View
              style={[
                styles.card,
                styles.cardBack,
                {
                  transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
                  opacity: backOpacity,
                },
              ]}
            >
              <View style={styles.cardLabelContainer}>
                <Text style={styles.cardLabel}>
                  {showMaram ? 'ENGLISH' : 'MARAM'}
                </Text>
              </View>
              <Text style={styles.cardWord}>
                {showMaram ? currentWord?.english : currentWord?.maram}
              </Text>
              <View style={styles.tapHint}>
                <Ionicons name="refresh-outline" size={18} color="rgba(255,255,255,0.7)" />
                <Text style={styles.tapHintText}>Tap to flip back</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Navigation Buttons */}
      <View style={[styles.navigation, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={goToPrevCard}
          disabled={currentIndex === 0}
        >
          <Ionicons 
            name="chevron-back" 
            size={28} 
            color={currentIndex === 0 ? COLORS.textSecondary : COLORS.text} 
          />
          <Text style={[styles.navButtonText, currentIndex === 0 && styles.navButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.flipButton} onPress={flipCard}>
          <Ionicons name="sync" size={28} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentIndex === words.length - 1 && styles.navButtonDisabled]}
          onPress={goToNextCard}
          disabled={currentIndex === words.length - 1}
        >
          <Text style={[styles.navButtonText, currentIndex === words.length - 1 && styles.navButtonTextDisabled]}>
            Next
          </Text>
          <Ionicons 
            name="chevron-forward" 
            size={28} 
            color={currentIndex === words.length - 1 ? COLORS.textSecondary : COLORS.text} 
          />
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  shuffleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: COLORS.cardBackground,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeButtonTextActive: {
    color: COLORS.primary,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardTouchable: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.7,
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.7,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  cardBack: {
    backgroundColor: COLORS.secondary,
  },
  cardLabelContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 1,
  },
  cardWord: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  tapHint: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tapHintText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  navButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  flipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});

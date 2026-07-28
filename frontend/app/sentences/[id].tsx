import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../_layout';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Sentence {
  id: string;
  maram_full: string;
  maram_blank: string;
  english: string;
  correct_word: string;
  options: string[];
  category_id: string;
}

export default function SentencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name, color } = useLocalSearchParams<{ id: string; name: string; color: string }>();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  
  // Animation
  const shakeAnimation = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Reset state when category changes to prevent showing stale data
    setSentences([]);
    setLoading(true);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsCorrect(null);
    setScore(0);
    setShowResult(false);
    shakeAnimation.setValue(0);
    fetchSentences();
  }, [id]);

  const fetchSentences = async () => {
    try {
      const response = await fetch(`${API_URL}/api/sentences?category_id=${id}`);
      if (response.ok) {
        const data = await response.json();
        // Shuffle sentences for variety
        const shuffled = data.sort(() => Math.random() - 0.5);
        setSentences(shuffled);
      }
    } catch (error) {
      console.error('Error fetching sentences:', error);
    } finally {
      setLoading(false);
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleOptionSelect = (option: string) => {
    if (selectedOption !== null) return; // Already selected
    
    setSelectedOption(option);
    const correct = option === sentences[currentIndex].correct_word;
    setIsCorrect(correct);
    
    if (correct) {
      setScore(score + 1);
      // Auto-advance after 1.2 seconds
      setTimeout(() => {
        goToNext();
      }, 1200);
    } else {
      shake();
    }
  };

  const goToNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsCorrect(null);
    } else {
      setShowResult(true);
    }
  };

  const restartQuiz = () => {
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    setSentences(shuffled);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsCorrect(null);
    setScore(0);
    setShowResult(false);
  };

  const getOptionStyle = (option: string) => {
    if (selectedOption === null) {
      return styles.optionButton;
    }
    
    if (option === sentences[currentIndex].correct_word) {
      return [styles.optionButton, styles.optionCorrect];
    }
    
    if (option === selectedOption && !isCorrect) {
      return [styles.optionButton, styles.optionIncorrect];
    }
    
    return [styles.optionButton, styles.optionDisabled];
  };

  const getOptionTextStyle = (option: string) => {
    if (selectedOption === null) {
      return styles.optionText;
    }
    
    if (option === sentences[currentIndex].correct_word) {
      return [styles.optionText, { color: 'white' }];
    }
    
    if (option === selectedOption && !isCorrect) {
      return [styles.optionText, { color: 'white' }];
    }
    
    return [styles.optionText, { color: COLORS.textSecondary }];
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (sentences.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: color || COLORS.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/practice')}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{name || 'Sentences'}</Text>
          </View>
        </View>
        <View style={[styles.centered, { flex: 1 }]}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textSecondary} />
          <Text style={{ color: COLORS.text, fontSize: 18, marginTop: 16 }}>No sentences available</Text>
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

  if (showResult) {
    const percentage = Math.round((score / sentences.length) * 100);
    const emoji = percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '💪';
    
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: color || COLORS.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/practice')}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{name || 'Sentences'}</Text>
          </View>
        </View>
        
        <View style={[styles.centered, { flex: 1, padding: 24 }]}>
          <Text style={styles.resultEmoji}>{emoji}</Text>
          <Text style={styles.resultTitle}>Quiz Complete!</Text>
          <Text style={styles.resultScore}>
            You got {score} out of {sentences.length} correct
          </Text>
          <Text style={styles.resultPercentage}>{percentage}%</Text>
          
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.retryButton} onPress={restartQuiz}>
              <Ionicons name="refresh" size={22} color="white" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.doneButton} onPress={() => router.replace('/practice')}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const currentSentence = sentences[currentIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: color || COLORS.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/practice')}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{name || 'Sentences'}</Text>
          <Text style={styles.headerSubtitle}>
            Question {currentIndex + 1} of {sentences.length}
          </Text>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${((currentIndex + 1) / sentences.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {/* Question Card */}
      <View style={styles.questionContainer}>
        <Text style={styles.instructionText}>Fill in the blank:</Text>
        
        <Animated.View 
          style={[styles.sentenceCard, { transform: [{ translateX: shakeAnimation }] }]}
        >
          <Text style={styles.sentenceText}>{currentSentence.maram_blank}</Text>
        </Animated.View>
        
        <View style={styles.translationContainer}>
          <Ionicons name="language" size={18} color={COLORS.textSecondary} />
          <Text style={styles.translationText}>{currentSentence.english}</Text>
        </View>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {currentSentence.options.map((option, index) => (
          <TouchableOpacity
            key={`${option}-${index}`}
            style={getOptionStyle(option)}
            onPress={() => handleOptionSelect(option)}
            disabled={selectedOption !== null}
            activeOpacity={0.8}
          >
            <Text style={getOptionTextStyle(option)}>{option}</Text>
            {selectedOption !== null && option === currentSentence.correct_word && (
              <Ionicons name="checkmark-circle" size={24} color="white" style={styles.optionIcon} />
            )}
            {selectedOption === option && !isCorrect && (
              <Ionicons name="close-circle" size={24} color="white" style={styles.optionIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback & Next Button */}
      {selectedOption !== null && !isCorrect && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.feedbackContainer}>
            <Ionicons name="close-circle" size={24} color={COLORS.danger} />
            <Text style={styles.feedbackText}>
              Correct answer: <Text style={styles.feedbackCorrect}>{currentSentence.correct_word}</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.nextButton} onPress={goToNext}>
            <Text style={styles.nextButtonText}>
              {currentIndex < sentences.length - 1 ? 'Next' : 'See Results'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}
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
  scoreContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
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
  questionContainer: {
    padding: 24,
    flex: 1,
  },
  instructionText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  sentenceCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  sentenceText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 40,
  },
  translationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
  },
  translationText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  optionsContainer: {
    padding: 24,
    gap: 12,
  },
  optionButton: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  optionCorrect: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionIncorrect: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionIcon: {
    marginLeft: 12,
  },
  footer: {
    padding: 24,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  feedbackText: {
    fontSize: 16,
    color: COLORS.text,
  },
  feedbackCorrect: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  resultPercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 32,
  },
  resultActions: {
    gap: 12,
    width: '100%',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doneButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
});

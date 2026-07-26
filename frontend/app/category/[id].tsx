import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { COLORS } from '../_layout';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Word {
  id: string;
  maram: string;
  english: string;
  audio_url: string | null;
  category_id: string;
}

export default function CategoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name, color } = useLocalSearchParams<{ id: string; name: string; color: string }>();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());

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

  const playAudio = async (word: Word) => {
    setPlayingId(word.id);
    
    // Mock audio playback - shows feedback that audio would play
    // In production, this will play actual MP3 files from audio_url
    
    if (word.audio_url) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: word.audio_url },
          { shouldPlay: true }
        );
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId(null);
            sound.unloadAsync();
          }
        });
      } catch (error) {
        console.error('Error playing audio:', error);
        setPlayingId(null);
      }
    } else {
      // Mock feedback for demo - simulates audio playing
      setTimeout(() => {
        setPlayingId(null);
      }, 800);
    }

    // Mark word as learned
    if (!learnedWords.has(word.id)) {
      markWordLearned(word);
    }
  };

  const markWordLearned = async (word: Word) => {
    try {
      await fetch(`${API_URL}/api/progress/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_id: word.id,
          category_id: word.category_id,
        }),
      });
      setLearnedWords((prev) => new Set(prev).add(word.id));
    } catch (error) {
      console.error('Error marking word learned:', error);
    }
  };

  const completePracticeSession = async () => {
    try {
      await fetch(`${API_URL}/api/progress/session`, {
        method: 'POST',
      });
      Alert.alert(
        'Session Complete!',
        `Great job! You practiced ${learnedWords.size} words in this session.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
          <Text style={styles.headerTitle}>{name || 'Category'}</Text>
          <Text style={styles.headerSubtitle}>{words.length} words to learn</Text>
        </View>
      </View>

      {/* Progress indicator */}
      <View style={styles.progressIndicator}>
        <Text style={styles.progressText}>
          {learnedWords.size} of {words.length} practiced
        </Text>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${words.length > 0 ? (learnedWords.size / words.length) * 100 : 0}%` }
            ]} 
          />
        </View>
      </View>

      {/* Word List Header */}
      <View style={styles.listHeader}>
        <Text style={[styles.columnHeader, { flex: 1.2 }]}>Maram</Text>
        <Text style={[styles.columnHeader, { flex: 1.2 }]}>English</Text>
        <Text style={[styles.columnHeader, { width: 60, textAlign: 'center' }]}>Audio</Text>
      </View>

      {/* Word List */}
      <ScrollView style={styles.wordList} contentContainerStyle={styles.wordListContent}>
        {words.map((word, index) => (
          <View 
            key={word.id} 
            style={[
              styles.wordRow,
              index % 2 === 0 ? styles.wordRowEven : styles.wordRowOdd,
              learnedWords.has(word.id) && styles.wordRowLearned,
            ]}
          >
            <View style={{ flex: 1.2 }}>
              <Text style={styles.maramWord}>{word.maram}</Text>
            </View>
            <View style={{ flex: 1.2 }}>
              <Text style={styles.englishWord}>{word.english}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.audioButton,
                playingId === word.id && styles.audioButtonPlaying,
              ]}
              onPress={() => playAudio(word)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={playingId === word.id ? 'volume-high' : 'volume-medium-outline'}
                size={22}
                color={playingId === word.id ? COLORS.primary : COLORS.text}
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Complete Session Button */}
      {learnedWords.size > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={completePracticeSession}
            activeOpacity={0.8}
          >
            <Text style={styles.completeButtonText}>Complete Session</Text>
            <Ionicons name="checkmark-circle" size={24} color="white" />
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
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressIndicator: {
    padding: 16,
    backgroundColor: COLORS.cardBackground,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  listHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  columnHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wordList: {
    flex: 1,
  },
  wordListContent: {
    paddingBottom: 20,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  wordRowEven: {
    backgroundColor: COLORS.cardBackground,
  },
  wordRowOdd: {
    backgroundColor: COLORS.background,
  },
  wordRowLearned: {
    backgroundColor: 'rgba(88, 204, 2, 0.1)',
  },
  maramWord: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  englishWord: {
    fontSize: 16,
    color: COLORS.text,
  },
  audioButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioButtonPlaying: {
    backgroundColor: 'rgba(88, 204, 2, 0.2)',
  },
  footer: {
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

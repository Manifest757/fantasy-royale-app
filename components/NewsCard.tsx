import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { NewsItem } from '@/data/mockData';

interface NewsCardProps {
  news: NewsItem;
}

export function NewsCard({ news }: NewsCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.content}>
          <View style={styles.sourceBadge}>
            <Text style={[styles.sourceText, { color: Colors.primary }]}>{news.source}</Text>
          </View>
          <Text style={[styles.headline, { color: colors.text }]} numberOfLines={2}>
            {news.headline}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>{news.timestamp}</Text>
        </View>
        <View style={styles.iconWrapper}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  sourceBadge: {
    marginBottom: 6,
  },
  sourceText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  iconWrapper: {
    padding: 4,
  },
});

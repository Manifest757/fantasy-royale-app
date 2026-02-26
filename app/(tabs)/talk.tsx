import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { AppHeader } from '@/components/AppHeader';
import { VideoCard } from '@/components/VideoCard';
import { useVideos } from '@/lib/supabase-data';

const categories = ['All', 'Predictions', 'Celebrations', 'Live'];

export default function TalkScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('All');
  const { data: videos = [], refetch, isRefetching } = useVideos();
  
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const headerHeight = (insets.top || webTopPadding) + 56;

  const filteredVideos = activeCategory === 'All'
    ? videos
    : videos.filter(v => v.category === activeCategory);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      <AppHeader />
      
      <View style={[styles.categoriesContainer, { top: headerHeight }]}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveCategory(item)}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: item === activeCategory ? Colors.primary : colors.card,
                  borderColor: item === activeCategory ? Colors.primary : colors.cardBorder,
                }
              ]}
            >
              <Text style={[
                styles.categoryText,
                { color: item === activeCategory ? '#000' : colors.text }
              ]}>
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filteredVideos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VideoCard video={item} />}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + 60, paddingBottom: 100 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No videos in this category
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoriesContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    paddingVertical: 12,
  },
  categories: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  content: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});

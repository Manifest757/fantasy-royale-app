import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, FlatList, ViewToken } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { usePromoSlides } from '@/lib/supabase-data';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32;

export function PromoCarousel() {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { data: promoSlides = [] } = usePromoSlides();

  useEffect(() => {
    if (promoSlides.length <= 1) return;
    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % promoSlides.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [activeIndex, promoSlides.length]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderSlide = ({ item, index }: { item: typeof promoSlides[0]; index: number }) => (
    <View style={[styles.slide, { borderColor: colors.cardBorder }]}>
      <LinearGradient
        colors={['#F97316', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
        <View style={styles.sponsorBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#FFF" />
          <Text style={styles.sponsorText}>{item.sponsor}</Text>
        </View>
      </View>
    </View>
  );

  const goToPrev = () => {
    if (promoSlides.length === 0) return;
    const prevIndex = activeIndex === 0 ? promoSlides.length - 1 : activeIndex - 1;
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
  };

  const goToNext = () => {
    if (promoSlides.length === 0) return;
    const nextIndex = (activeIndex + 1) % promoSlides.length;
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={promoSlides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
        contentContainerStyle={styles.flatListContent}
      />
      
      <Pressable style={[styles.navButton, styles.prevButton]} onPress={goToPrev}>
        <Ionicons name="chevron-back" size={20} color="#FFF" />
      </Pressable>
      <Pressable style={[styles.navButton, styles.nextButton]} onPress={goToNext}>
        <Ionicons name="chevron-forward" size={20} color="#FFF" />
      </Pressable>

      <View style={styles.indicators}>
        {promoSlides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              index === activeIndex ? styles.indicatorActive : styles.indicatorInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 24,
    position: 'relative',
  },
  flatListContent: {
    gap: 0,
  },
  slide: {
    width: SLIDE_WIDTH,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  slideContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  slideTitle: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Inter_900Black',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  slideSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  sponsorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sponsorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButton: {
    left: 8,
  },
  nextButton: {
    right: 8,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  indicator: {
    height: 4,
    borderRadius: 2,
  },
  indicatorActive: {
    width: 16,
    backgroundColor: Colors.primary,
  },
  indicatorInactive: {
    width: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.4)',
  },
});

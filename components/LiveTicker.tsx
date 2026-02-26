import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';

interface CombinedGames {
  nba: any[];
  ncaab: any[];
}

function useGamesToday() {
  return useQuery<CombinedGames>({
    queryKey: ['/api/games/today'],
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function LiveTicker() {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const measuredWidth = useRef(0);
  const { data } = useGamesToday();

  const nbaGames = data?.nba || [];
  const ncaabGames = data?.ncaab || [];

  const allGames = [...nbaGames, ...ncaabGames];

  const prioritized = allGames.sort((a: any, b: any) => {
    const statusPriority = (g: any) => {
      const s = (g.status || '').toLowerCase();
      if (s !== 'final' && s !== '' && s !== 'not yet started' && g.period > 0) return 0;
      if (s === 'final') return 1;
      return 2;
    };
    return statusPriority(a) - statusPriority(b);
  });

  const top5 = prioritized.slice(0, 5);

  const tickerText = top5.length > 0
    ? top5.map((g: any) => g.ticker_text).join('   |   ') + '   |   '
    : 'No games scheduled today';

  const hasGames = allGames.length > 0;
  const hasLive = top5.some((g: any) => {
    const s = (g.status || '').toLowerCase();
    return s !== 'final' && s !== '' && s !== 'not yet started' && (g.period > 0);
  });
  const badgeLabel = hasLive ? 'LIVE' : hasGames ? 'TODAY' : 'GAMES';

  const startAnimation = useCallback((width: number) => {
    cancelAnimation(translateX);
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(-width, {
        duration: width * 25,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [translateX]);

  useEffect(() => {
    return () => cancelAnimation(translateX);
  }, [translateX]);

  const handleTextLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== measuredWidth.current) {
      measuredWidth.current = width;
      startAnimation(width);
    }
  }, [startAnimation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.liveBadge}>
        <View style={styles.pulseDot} />
        <Text style={styles.liveText}>{badgeLabel}</Text>
      </View>
      <View style={styles.tickerWrapper}>
        <Animated.View style={[styles.tickerContent, animatedStyle]}>
          <Text
            style={[styles.tickerText, { color: colors.text }]}
            numberOfLines={1}
            onLayout={handleTextLayout}
          >
            {tickerText}
          </Text>
          <Text
            style={[styles.tickerText, { color: colors.text }]}
            numberOfLines={1}
          >
            {tickerText}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000',
    marginRight: 4,
  },
  liveText: {
    color: '#000',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  tickerWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  tickerContent: {
    flexDirection: 'row',
  },
  tickerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});

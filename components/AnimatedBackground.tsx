import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

export function AnimatedBackground() {
  const { isDark } = useTheme();
  
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const scale3 = useSharedValue(1);
  const opacity1 = useSharedValue(0.3);
  const opacity2 = useSharedValue(0.3);
  const opacity3 = useSharedValue(0.3);

  useEffect(() => {
    scale1.value = withRepeat(
      withTiming(1.2, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    opacity1.value = withRepeat(
      withTiming(0.5, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    
    scale2.value = withDelay(1000, withRepeat(
      withTiming(1.3, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
    opacity2.value = withDelay(1000, withRepeat(
      withTiming(0.4, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
    
    scale3.value = withDelay(2000, withRepeat(
      withTiming(1.25, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
    opacity3.value = withDelay(2000, withRepeat(
      withTiming(0.45, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
  }, []);

  const animStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));

  const animStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  const animStyle3 = useAnimatedStyle(() => ({
    transform: [{ scale: scale3.value }],
    opacity: opacity3.value,
  }));

  if (!isDark) return null;

  return (
    <View style={[styles.container, { pointerEvents: 'none' }]}>
      <Animated.View style={[styles.circle, styles.circle1, animStyle1]} />
      <Animated.View style={[styles.circle, styles.circle2, animStyle2]} />
      <Animated.View style={[styles.circle, styles.circle3, animStyle3]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circle1: {
    width: 300,
    height: 300,
    backgroundColor: '#22D3EE',
    top: -100,
    left: -100,
    filter: 'blur(80px)',
  },
  circle2: {
    width: 250,
    height: 250,
    backgroundColor: '#A855F7',
    top: 200,
    right: -80,
    filter: 'blur(80px)',
  },
  circle3: {
    width: 280,
    height: 280,
    backgroundColor: '#F97316',
    bottom: 100,
    left: -60,
    filter: 'blur(80px)',
  },
});

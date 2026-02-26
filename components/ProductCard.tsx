import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/contexts/StoreContext';
import { Colors } from '@/constants/colors';
import { Product } from '@/data/mockData';
import * as Haptics from 'expo-haptics';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const { colors } = useTheme();
  const { toggleFavorite, isFavorite } = useStore();
  const favorite = isFavorite(product.id);

  const handlePress = () => {
    router.push(`/product/${product.id}`);
  };

  const handleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(product.id);
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'BEST SELLER': return Colors.primary;
      case 'NEW': return Colors.success;
      case 'LIMITED': return Colors.gradientEnd;
      case 'PREMIUM': return Colors.gradientStart;
      default: return Colors.primary;
    }
  };

  if (compact) {
    return (
      <Pressable onPress={handlePress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <View style={[styles.compactCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Image source={{ uri: product.image }} style={styles.compactImage} contentFit="cover" />
          {product.badge && (
            <View style={[styles.badge, { backgroundColor: getBadgeColor(product.badge) }]}>
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
          <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <Text style={[styles.compactPrice, { color: Colors.primary }]}>${product.price.toFixed(2)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.cardWrapper, { opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" />
          {product.badge && (
            <View style={[styles.badge, { backgroundColor: getBadgeColor(product.badge) }]}>
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
          <Pressable
            onPress={handleFavorite}
            style={({ pressed }) => [styles.favoriteButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={favorite ? Colors.error : colors.textSecondary}
            />
          </Pressable>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={Colors.warning} />
            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
              {product.rating} ({product.reviews})
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: Colors.primary }]}>${product.price.toFixed(2)}</Text>
            {product.originalPrice && (
              <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
                ${product.originalPrice.toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    padding: 6,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    aspectRatio: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
    lineHeight: 18,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  compactCard: {
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 12,
  },
  compactImage: {
    width: '100%',
    height: 100,
  },
  compactName: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  compactPrice: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
  },
});

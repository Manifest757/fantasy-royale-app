import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/contexts/StoreContext';
import { Colors } from '@/constants/colors';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { useProducts } from '@/lib/supabase-data';
import * as Haptics from 'expo-haptics';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { addToCart, toggleFavorite, isFavorite, cartCount } = useStore();
  const insets = useSafeAreaInsets();
  
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const { data: products = [] } = useProducts();
  
  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const product = products.find(p => p.id === id);
  if (!product) return null;

  const favorite = isFavorite(product.id);

  const handleAddToCart = () => {
    if (product.sizes && !selectedSize) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart(product, selectedSize || undefined);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedBackground />
      
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable onPress={handleFavorite} style={styles.headerButton}>
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={24}
              color={favorite ? Colors.error : colors.text}
            />
          </Pressable>
          <Pressable onPress={() => router.push('/merch')} style={styles.headerButton}>
            <Ionicons name="cart-outline" size={24} color={colors.text} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" />
          {product.badge && (
            <View style={[styles.badge, { backgroundColor: getBadgeColor(product.badge) }]}>
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
        </View>

        <View style={styles.details}>
          <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
          
          <View style={styles.ratingRow}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons
                  key={star}
                  name={star <= Math.floor(product.rating) ? 'star' : 'star-outline'}
                  size={16}
                  color={Colors.warning}
                />
              ))}
            </View>
            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
              {product.rating} ({product.reviews} reviews)
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

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {product.description}
          </Text>

          {product.sizes && (
            <View style={styles.sizeSection}>
              <Text style={[styles.sizeLabel, { color: colors.text }]}>Select Size</Text>
              <View style={styles.sizeGrid}>
                {product.sizes.map(size => (
                  <Pressable
                    key={size}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedSize(size);
                    }}
                    style={[
                      styles.sizeButton,
                      {
                        backgroundColor: selectedSize === size ? Colors.primary : colors.card,
                        borderColor: selectedSize === size ? Colors.primary : colors.cardBorder,
                      }
                    ]}
                  >
                    <Text style={[
                      styles.sizeText,
                      { color: selectedSize === size ? '#000' : colors.text }
                    ]}>
                      {size}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.trustBadges}>
            <View style={[styles.trustBadge, { backgroundColor: colors.card }]}>
              <Feather name="truck" size={18} color={Colors.primary} />
              <Text style={[styles.trustText, { color: colors.textSecondary }]}>Free Shipping</Text>
            </View>
            <View style={[styles.trustBadge, { backgroundColor: colors.card }]}>
              <Feather name="shield" size={18} color={Colors.primary} />
              <Text style={[styles.trustText, { color: colors.textSecondary }]}>Quality Guarantee</Text>
            </View>
            <View style={[styles.trustBadge, { backgroundColor: colors.card }]}>
              <MaterialCommunityIcons name="crown" size={18} color={Colors.gradientEnd} />
              <Text style={[styles.trustText, { color: colors.textSecondary }]}>Earn Crowns</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]}>
        <Pressable
          onPress={handleAddToCart}
          disabled={product.sizes && !selectedSize}
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}
        >
          <LinearGradient
            colors={(!product.sizes || selectedSize) ? [Colors.primary, Colors.primaryDark] : [colors.cardBorder, colors.cardBorder]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButton}
          >
            <Ionicons name="cart" size={20} color={(!product.sizes || selectedSize) ? '#000' : colors.textMuted} />
            <Text style={[styles.addText, { color: (!product.sizes || selectedSize) ? '#000' : colors.textMuted }]}>
              Add to Cart
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: '#000',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  details: {
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  price: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  originalPrice: {
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginBottom: 24,
  },
  sizeSection: {
    marginBottom: 24,
  },
  sizeLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sizeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  trustBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  trustText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  addText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});

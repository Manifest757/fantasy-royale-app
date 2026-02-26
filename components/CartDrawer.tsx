import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/contexts/StoreContext';
import { Colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface CartDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const { height } = Dimensions.get('window');

export function CartDrawer({ visible, onClose }: CartDrawerProps) {
  const { colors, isDark } = useTheme();
  const { cart, removeFromCart, updateQuantity, cartTotal, crownsEarned, clearCart } = useStore();
  const insets = useSafeAreaInsets();

  const handleQuantityChange = (productId: string, delta: number, currentQty: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQuantity(productId, currentQty + delta);
  };

  const handleRemove = (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeFromCart(productId);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.drawer, { backgroundColor: colors.card, maxHeight: height * 0.8 }]}>
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="cart" size={20} color={Colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bag-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Your cart is empty</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Browse the merch store to find something you love
              </Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.items} showsVerticalScrollIndicator={false}>
                {cart.map((item) => (
                  <View key={item.product.id} style={[styles.cartItem, { borderBottomColor: colors.cardBorder }]}>
                    <Image source={{ uri: item.product.image }} style={styles.itemImage} contentFit="cover" />
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      {item.size && (
                        <Text style={[styles.itemSize, { color: colors.textSecondary }]}>Size: {item.size}</Text>
                      )}
                      <Text style={[styles.itemPrice, { color: Colors.primary }]}>
                        ${item.product.price.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <View style={styles.quantityControl}>
                        <Pressable
                          onPress={() => handleQuantityChange(item.product.id, -1, item.quantity)}
                          style={[styles.qtyButton, { backgroundColor: colors.cardBorder }]}
                        >
                          <Feather name="minus" size={14} color={colors.text} />
                        </Pressable>
                        <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                        <Pressable
                          onPress={() => handleQuantityChange(item.product.id, 1, item.quantity)}
                          style={[styles.qtyButton, { backgroundColor: colors.cardBorder }]}
                        >
                          <Feather name="plus" size={14} color={colors.text} />
                        </Pressable>
                      </View>
                      <Pressable onPress={() => handleRemove(item.product.id)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>${cartTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.crownsRow}>
                  <MaterialCommunityIcons name="crown" size={16} color={Colors.gradientEnd} />
                  <Text style={[styles.crownsText, { color: Colors.primary }]}>+{crownsEarned} Crowns</Text>
                </View>
                <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.checkoutButton}
                  >
                    <Text style={styles.checkoutText}>Checkout</Text>
                    <Ionicons name="arrow-forward" size={18} color="#000" />
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  closeButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  items: {
    maxHeight: height * 0.4,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
  },
  itemSize: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    minWidth: 20,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  crownsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crownsText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  checkoutText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});

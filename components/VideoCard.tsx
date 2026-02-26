import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/colors';
import { VideoItem } from '@/data/mockData';
import * as Haptics from 'expo-haptics';

const { height } = Dimensions.get('window');

interface VideoCardProps {
  video: VideoItem;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function VideoCard({ video }: VideoCardProps) {
  const { colors, isDark } = useTheme();

  const handleAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} contentFit="cover" />
      
      <View style={styles.overlay}>
        {video.category === 'Live' && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}

        <View style={styles.bottomSection}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#FFF" />
            </View>
            <View style={styles.textInfo}>
              <Text style={styles.username}>@{video.username}</Text>
              <Text style={styles.caption} numberOfLines={2}>{video.caption}</Text>
              <Text style={styles.timestamp}>{video.timestamp}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={handleAction} style={styles.actionButton}>
            <Ionicons name="heart-outline" size={28} color="#FFF" />
            <Text style={styles.actionText}>{formatNumber(video.likes)}</Text>
          </Pressable>
          <Pressable onPress={handleAction} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
            <Text style={styles.actionText}>{formatNumber(video.comments)}</Text>
          </Pressable>
          <Pressable onPress={handleAction} style={styles.actionButton}>
            <Ionicons name="share-outline" size={26} color="#FFF" />
            <Text style={styles.actionText}>{formatNumber(video.shares)}</Text>
          </Pressable>
        </View>

        <View style={styles.playButton}>
          <Ionicons name="play" size={48} color="rgba(255,255,255,0.8)" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: height * 0.6,
    marginBottom: 2,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    margin: 16,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    marginRight: 6,
  },
  liveText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 60,
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textInfo: {
    flex: 1,
  },
  username: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  caption: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    position: 'absolute',
    right: 12,
    bottom: 80,
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
  },
});

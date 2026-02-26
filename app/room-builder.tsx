import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, FlatList, Linking, Alert, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, G, Line, Rect, Defs, LinearGradient, Stop, ClipPath, Image as SvgImage } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useGamification, RoomItem, PlacedItem } from '@/contexts/GamificationContext';
import { Colors } from '@/constants/colors';

const CATEGORIES = ['furniture', 'decor', 'flooring', 'wall', 'trophy', 'tech'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  furniture: 'Furniture',
  decor: 'Decor',
  flooring: 'Floor',
  wall: 'Walls',
  trophy: 'Trophy',
  tech: 'Tech',
};

const RARITY_COLORS = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

const GRID_SIZE = 12;
const TILE_WIDTH = 28;
const TILE_HEIGHT = 14;
const WALL_TILES = 12;
const WALL_HEIGHT = WALL_TILES * TILE_HEIGHT;
const BASE_HEIGHT = 6;

const screenWidth = Dimensions.get('window').width;
const BASE_ROOM_SCALE = Math.min(1, (screenWidth - 24) / 380);

const isoToScreen = (gridX: number, gridY: number, originX: number, originY: number) => {
  const screenX = originX + (gridX - gridY) * (TILE_WIDTH / 2);
  const screenY = originY + (gridX + gridY) * (TILE_HEIGHT / 2);
  return { x: screenX, y: screenY };
};

const getTileDiamondPath = (gx: number, gy: number, oX: number, oY: number) => {
  const top = isoToScreen(gx, gy, oX, oY);
  const right = isoToScreen(gx + 1, gy, oX, oY);
  const bottom = isoToScreen(gx + 1, gy + 1, oX, oY);
  const left = isoToScreen(gx, gy + 1, oX, oY);
  return `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
};

const getBoundingBoxPath = (gx: number, gy: number, w: number, d: number, oX: number, oY: number) => {
  const top = isoToScreen(gx, gy, oX, oY);
  const right = isoToScreen(gx + w, gy, oX, oY);
  const bottom = isoToScreen(gx + w, gy + d, oX, oY);
  const left = isoToScreen(gx, gy + d, oX, oY);
  return `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
};

export default function RoomBuilderScreen() {
  const { colors } = useTheme();
  const { crowns, roomItems, ownedRoomItems, placedItems, placeItem, removeItem, moveItem, purchaseRoomItem, isItemUnlocked } = useGamification();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('furniture');
  const [selectedItem, setSelectedItem] = useState<RoomItem | null>(null);
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<PlacedItem | null>(null);
  const [isMovingItem, setIsMovingItem] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const topPadding = insets.top || webTopPadding;

  const ROOM_SCALE = isZoomed ? BASE_ROOM_SCALE * 1.5 : BASE_ROOM_SCALE;

  const categoryItems = roomItems.filter(i => i.category === activeCategory);

  const roomWidth = GRID_SIZE * TILE_WIDTH + TILE_WIDTH;
  const roomHeight = GRID_SIZE * TILE_HEIGHT + WALL_HEIGHT + BASE_HEIGHT + 20;
  const originX = roomWidth / 2;
  const originY = WALL_HEIGHT;

  const checkBoundingBoxCollision = (newX: number, newY: number, newItem: RoomItem, excludePlacedId?: string): PlacedItem | null => {
    const newWidth = newItem.width || 1;
    const newDepth = newItem.depth || 1;
    
    for (const placed of placedItems) {
      if (excludePlacedId && placed.id === excludePlacedId) continue;
      const existingItem = roomItems.find(i => i.id === placed.itemId);
      if (!existingItem) continue;
      
      const existingWidth = existingItem.width || 1;
      const existingDepth = existingItem.depth || 1;
      
      const newMinX = newX;
      const newMaxX = newX + newWidth - 1;
      const newMinY = newY;
      const newMaxY = newY + newDepth - 1;
      
      const existMinX = placed.x;
      const existMaxX = placed.x + existingWidth - 1;
      const existMinY = placed.y;
      const existMaxY = placed.y + existingDepth - 1;
      
      const xOverlap = newMinX <= existMaxX && newMaxX >= existMinX;
      const yOverlap = newMinY <= existMaxY && newMaxY >= existMinY;
      
      if (xOverlap && yOverlap) {
        return placed;
      }
    }
    return null;
  };

  const isWithinGridBounds = (x: number, y: number, item: RoomItem): boolean => {
    const width = item.width || 1;
    const depth = item.depth || 1;
    return x >= 0 && y >= 0 && (x + width) <= GRID_SIZE && (y + depth) <= GRID_SIZE;
  };

  const activeItem = useMemo(() => {
    if (isMovingItem && selectedPlacedItem) {
      return roomItems.find(i => i.id === selectedPlacedItem.itemId) || null;
    }
    return selectedItem;
  }, [selectedItem, isMovingItem, selectedPlacedItem, roomItems]);

  const excludeId = isMovingItem && selectedPlacedItem ? selectedPlacedItem.id : undefined;

  const validTileSet = useMemo(() => {
    const set = new Set<string>();
    if (!activeItem) return set;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!isWithinGridBounds(x, y, activeItem)) continue;
        const collision = checkBoundingBoxCollision(x, y, activeItem, excludeId);
        if (collision) {
          if (!(activeItem.placementSurface === 'stacked' && roomItems.find(i => i.id === collision.itemId)?.isStackable)) {
            continue;
          }
        }
        set.add(`${x}-${y}`);
      }
    }
    return set;
  }, [activeItem, placedItems, roomItems, excludeId]);

  const handleWallSidePlace = async (side: 'left' | 'right') => {
    if (!selectedItem || !selectedItem.wallSide) return;
    const isOwned = ownedRoomItems.includes(selectedItem.id) || selectedItem.price === 0;
    if (!isOwned) {
      const purchased = await purchaseRoomItem(selectedItem.id, selectedItem.price);
      if (!purchased) {
        if (Platform.OS === 'web') {
          alert('You need more crowns to purchase this item.');
        } else {
          Alert.alert('Not Enough Crowns', 'You need more crowns to purchase this item.');
        }
        return;
      }
    }
    const existingOnSide = placedItems.filter(p => {
      const ri = roomItems.find(i => i.id === p.itemId);
      return ri && ri.category === 'wall' && ri.wallSide === side;
    });
    existingOnSide.forEach(c => removeItem(c.id));
    const newPlaced: PlacedItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      itemId: selectedItem.id,
      x: 0,
      y: 0,
      rotation: 0,
    };
    placeItem(newPlaced);
    setSelectedItem(null);
    setPreviewPosition(null);
  };

  const handleTilePress = (gridX: number, gridY: number) => {
    if (isMovingItem && selectedPlacedItem) {
      const key = `${gridX}-${gridY}`;
      if (!validTileSet.has(key)) return;
      setPreviewPosition({ x: gridX, y: gridY });
      return;
    }

    if (selectedItem && selectedItem.wallSide) {
      handleWallSidePlace(selectedItem.wallSide);
      return;
    }

    if (selectedItem) {
      const key = `${gridX}-${gridY}`;
      if (!validTileSet.has(key)) return;
      setPreviewPosition({ x: gridX, y: gridY });
    } else {
      const placedHere = placedItems.find(p => {
        const item = roomItems.find(i => i.id === p.itemId);
        if (!item) return p.x === gridX && p.y === gridY;
        const width = item.width || 1;
        const depth = item.depth || 1;
        return gridX >= p.x && gridX < p.x + width && gridY >= p.y && gridY < p.y + depth;
      });
      if (placedHere) {
        setSelectedPlacedItem(placedHere);
        setIsMovingItem(false);
        setPreviewPosition(null);
      } else {
        setSelectedPlacedItem(null);
        setIsMovingItem(false);
        setPreviewPosition(null);
      }
    }
  };

  const handleConfirmPlacement = async () => {
    if (!previewPosition) return;

    if (isMovingItem && selectedPlacedItem) {
      moveItem(selectedPlacedItem.id, previewPosition.x, previewPosition.y);
      setSelectedPlacedItem({ ...selectedPlacedItem, x: previewPosition.x, y: previewPosition.y });
      setIsMovingItem(false);
      setPreviewPosition(null);
      return;
    }

    if (selectedItem) {
      const isOwned = ownedRoomItems.includes(selectedItem.id) || selectedItem.price === 0;
      if (!isOwned) {
        const purchased = await purchaseRoomItem(selectedItem.id, selectedItem.price);
        if (!purchased) {
          if (Platform.OS === 'web') {
            alert('You need more crowns to purchase this item.');
          } else {
            Alert.alert('Not Enough Crowns', 'You need more crowns to purchase this item.');
          }
          return;
        }
      }
      const newPlaced: PlacedItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        itemId: selectedItem.id,
        x: previewPosition.x,
        y: previewPosition.y,
        rotation: 0,
      };
      placeItem(newPlaced);
      setSelectedItem(null);
      setPreviewPosition(null);
    }
  };

  const handleCancelPreview = () => {
    setPreviewPosition(null);
  };

  const handlePlacedItemAction = (action: 'remove' | 'url' | 'move' | 'cancel') => {
    if (!selectedPlacedItem && action !== 'cancel') return;
    
    if (action === 'remove') {
      if (Platform.OS === 'web') {
        if (confirm(`Remove "${roomItems.find(i => i.id === selectedPlacedItem!.itemId)?.name}"?`)) {
          removeItem(selectedPlacedItem!.id);
          setSelectedPlacedItem(null);
          setIsMovingItem(false);
          setPreviewPosition(null);
        }
      } else {
        Alert.alert(
          'Remove Item',
          `Remove "${roomItems.find(i => i.id === selectedPlacedItem!.itemId)?.name}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => {
              removeItem(selectedPlacedItem!.id);
              setSelectedPlacedItem(null);
              setIsMovingItem(false);
              setPreviewPosition(null);
            }},
          ]
        );
      }
    } else if (action === 'url') {
      const item = roomItems.find(i => i.id === selectedPlacedItem!.itemId);
      if (item?.url) {
        Linking.openURL(item.url);
      }
    } else if (action === 'move') {
      setIsMovingItem(true);
      setSelectedItem(null);
      setPreviewPosition(null);
    } else if (action === 'cancel') {
      setSelectedPlacedItem(null);
      setIsMovingItem(false);
      setPreviewPosition(null);
    }
  };

  const getItemStatus = (item: RoomItem) => {
    if (ownedRoomItems.includes(item.id) || item.price === 0) return 'owned';
    if (isItemUnlocked(item)) return 'purchasable';
    return 'locked';
  };

  const floorPath = useMemo(() => {
    const topPoint = isoToScreen(0, 0, originX, originY);
    const rightPoint = isoToScreen(GRID_SIZE, 0, originX, originY);
    const bottomPoint = isoToScreen(GRID_SIZE, GRID_SIZE, originX, originY);
    const leftPoint = isoToScreen(0, GRID_SIZE, originX, originY);
    return `M ${topPoint.x} ${topPoint.y} L ${rightPoint.x} ${rightPoint.y} L ${bottomPoint.x} ${bottomPoint.y} L ${leftPoint.x} ${leftPoint.y} Z`;
  }, [originX, originY]);

  const leftWallPath = useMemo(() => {
    const topLeft = isoToScreen(0, 0, originX, originY);
    const bottomLeft = isoToScreen(0, GRID_SIZE, originX, originY);
    return `M ${topLeft.x} ${topLeft.y - WALL_HEIGHT} L ${topLeft.x} ${topLeft.y} L ${bottomLeft.x} ${bottomLeft.y} L ${bottomLeft.x} ${bottomLeft.y - WALL_HEIGHT} Z`;
  }, [originX, originY]);

  const rightWallPath = useMemo(() => {
    const topLeft = isoToScreen(0, 0, originX, originY);
    const topRight = isoToScreen(GRID_SIZE, 0, originX, originY);
    return `M ${topLeft.x} ${topLeft.y - WALL_HEIGHT} L ${topLeft.x} ${topLeft.y} L ${topRight.x} ${topRight.y} L ${topRight.x} ${topRight.y - WALL_HEIGHT} Z`;
  }, [originX, originY]);

  const basePath = useMemo(() => {
    const rightPoint = isoToScreen(GRID_SIZE, 0, originX, originY);
    const bottomPoint = isoToScreen(GRID_SIZE, GRID_SIZE, originX, originY);
    const leftPoint = isoToScreen(0, GRID_SIZE, originX, originY);
    return `M ${rightPoint.x} ${rightPoint.y} L ${bottomPoint.x} ${bottomPoint.y} L ${bottomPoint.x} ${bottomPoint.y + BASE_HEIGHT} L ${rightPoint.x} ${rightPoint.y + BASE_HEIGHT} Z`;
  }, [originX, originY]);

  const baseLeftPath = useMemo(() => {
    const bottomPoint = isoToScreen(GRID_SIZE, GRID_SIZE, originX, originY);
    const leftPoint = isoToScreen(0, GRID_SIZE, originX, originY);
    return `M ${leftPoint.x} ${leftPoint.y} L ${bottomPoint.x} ${bottomPoint.y} L ${bottomPoint.x} ${bottomPoint.y + BASE_HEIGHT} L ${leftPoint.x} ${leftPoint.y + BASE_HEIGHT} Z`;
  }, [originX, originY]);

  const renderFloorGridLines = () => {
    const lines = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      const start = isoToScreen(i, 0, originX, originY);
      const end = isoToScreen(i, GRID_SIZE, originX, originY);
      lines.push(
        <Line
          key={`v-${i}`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
        />
      );
    }
    for (let i = 0; i <= GRID_SIZE; i++) {
      const start = isoToScreen(0, i, originX, originY);
      const end = isoToScreen(GRID_SIZE, i, originX, originY);
      lines.push(
        <Line
          key={`h-${i}`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
        />
      );
    }
    return lines;
  };

  const renderLeftWallGridLines = () => {
    const lines = [];
    const topLeft = isoToScreen(0, 0, originX, originY);
    const tileHeightOnWall = TILE_HEIGHT / 2;
    
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = isoToScreen(0, i, originX, originY);
      lines.push(
        <Line
          key={`lw-h-${i}`}
          x1={pos.x}
          y1={pos.y}
          x2={pos.x}
          y2={pos.y - WALL_HEIGHT}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      );
    }
    
    const wallTileHeight = WALL_HEIGHT / WALL_TILES;
    for (let i = 0; i <= WALL_TILES; i++) {
      const y = topLeft.y - i * wallTileHeight;
      const bottomLeft = isoToScreen(0, GRID_SIZE, originX, originY);
      lines.push(
        <Line
          key={`lw-v-${i}`}
          x1={topLeft.x}
          y1={y}
          x2={bottomLeft.x}
          y2={y + GRID_SIZE * tileHeightOnWall}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      );
    }
    return lines;
  };

  const renderRightWallGridLines = () => {
    const lines = [];
    const topLeft = isoToScreen(0, 0, originX, originY);
    const tileHeightOnWall = TILE_HEIGHT / 2;
    
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = isoToScreen(i, 0, originX, originY);
      lines.push(
        <Line
          key={`rw-h-${i}`}
          x1={pos.x}
          y1={pos.y}
          x2={pos.x}
          y2={pos.y - WALL_HEIGHT}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      );
    }
    
    const wallTileHeight = WALL_HEIGHT / WALL_TILES;
    for (let i = 0; i <= WALL_TILES; i++) {
      const y = topLeft.y - i * wallTileHeight;
      const topRight = isoToScreen(GRID_SIZE, 0, originX, originY);
      lines.push(
        <Line
          key={`rw-v-${i}`}
          x1={topLeft.x}
          y1={y}
          x2={topRight.x}
          y2={y + GRID_SIZE * tileHeightOnWall}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      );
    }
    return lines;
  };

  const activeWallItems = useMemo(() => {
    const result: { left: RoomItem | null; right: RoomItem | null } = { left: null, right: null };
    placedItems.forEach(p => {
      const item = roomItems.find(i => i.id === p.itemId);
      if (item && item.category === 'wall' && item.wallSide && item.image) {
        result[item.wallSide] = item;
      }
    });
    return result;
  }, [placedItems, roomItems]);

  const activeFlooringPlaced = useMemo(() => {
    return placedItems.find(p => {
      const item = roomItems.find(i => i.id === p.itemId);
      return item && item.category === 'flooring';
    }) || null;
  }, [placedItems, roomItems]);

  const handleFlooringPlace = async () => {
    if (!selectedItem || selectedItem.category !== 'flooring') return;
    const isOwned = ownedRoomItems.includes(selectedItem.id) || selectedItem.price === 0;
    if (!isOwned) {
      const purchased = await purchaseRoomItem(selectedItem.id, selectedItem.price);
      if (!purchased) {
        if (Platform.OS === 'web') {
          alert('You need more crowns to purchase this item.');
        } else {
          Alert.alert('Not Enough Crowns', 'You need more crowns to purchase this item.');
        }
        return;
      }
    }
    const existingFlooring = placedItems.filter(p => {
      const ri = roomItems.find(i => i.id === p.itemId);
      return ri && ri.category === 'flooring';
    });
    existingFlooring.forEach(c => removeItem(c.id));
    const newPlaced: PlacedItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      itemId: selectedItem.id,
      x: 0,
      y: 0,
      rotation: 0,
    };
    placeItem(newPlaced);
    setSelectedItem(null);
    setPreviewPosition(null);
  };

  const renderWallImages = () => {
    const topLeft = isoToScreen(0, 0, originX, originY);
    const bottomLeft = isoToScreen(0, GRID_SIZE, originX, originY);
    const topRight = isoToScreen(GRID_SIZE, 0, originX, originY);

    const elements: React.ReactNode[] = [];

    if (activeWallItems.left) {
      const lwMinX = bottomLeft.x;
      const lwMinY = topLeft.y - WALL_HEIGHT;
      const lwW = topLeft.x - bottomLeft.x;
      const lwH = bottomLeft.y - lwMinY;
      elements.push(
        <G key="leftWallImg">
          <Defs>
            <ClipPath id="leftWallClip">
              <Path d={leftWallPath} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#leftWallClip)">
            <SvgImage
              href={activeWallItems.left.image}
              x={lwMinX}
              y={lwMinY}
              width={lwW}
              height={lwH}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        </G>
      );
    }

    if (activeWallItems.right) {
      const rwMinX = topLeft.x;
      const rwMinY = topLeft.y - WALL_HEIGHT;
      const rwW = topRight.x - topLeft.x;
      const rwH = topRight.y - rwMinY;
      elements.push(
        <G key="rightWallImg">
          <Defs>
            <ClipPath id="rightWallClip">
              <Path d={rightWallPath} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#rightWallClip)">
            <SvgImage
              href={activeWallItems.right.image}
              x={rwMinX}
              y={rwMinY}
              width={rwW}
              height={rwH}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        </G>
      );
    }

    return elements.length > 0 ? <G>{elements}</G> : null;
  };

  const getRenderLayer = (item: RoomItem, placed: PlacedItem): number => {
    if (item.category === 'wall') return 0;
    if (item.category === 'flooring') return 1;
    if (item.placementSurface === 'wall') return 2;
    if (item.placementSurface === 'stacked') {
      const baseItem = placedItems.find(p => p.id !== placed.id && p.x === placed.x && p.y === placed.y);
      if (baseItem) {
        const baseRoomItem = roomItems.find(i => i.id === baseItem.itemId);
        if (baseRoomItem) {
          const baseLayer = baseRoomItem.placementSurface === 'floor' ? 3 : baseRoomItem.placementSurface === 'wall' ? 2 : 3;
          return baseLayer;
        }
      }
      return 3;
    }
    return 3;
  };

  const renderPlacedItemImages = () => {
    const itemsWithImages = placedItems
      .map(placed => ({ placed, item: roomItems.find(i => i.id === placed.itemId) }))
      .filter(({ item }) => item && item.image && !item.wallSide)
      .sort((a, b) => {
        const layerA = getRenderLayer(a.item!, a.placed);
        const layerB = getRenderLayer(b.item!, b.placed);
        if (layerA !== layerB) return layerA - layerB;
        return (a.placed.x + a.placed.y) - (b.placed.x + b.placed.y);
      });

    if (itemsWithImages.length === 0) return null;

    return (
      <G>
        {itemsWithImages.map(({ placed, item }) => {
          if (!item) return null;
          const w = item.width || 1;
          const d = item.depth || 1;
          const isSelected = selectedPlacedItem?.id === placed.id;
          const isBeingMoved = isMovingItem && isSelected;

          const topV = isoToScreen(placed.x, placed.y, originX, originY);
          const rightV = isoToScreen(placed.x + w, placed.y, originX, originY);
          const bottomV = isoToScreen(placed.x + w, placed.y + d, originX, originY);
          const leftV = isoToScreen(placed.x, placed.y + d, originX, originY);

          const minX = leftV.x;
          const minY = topV.y;
          const bboxW = rightV.x - leftV.x;
          const bboxH = bottomV.y - topV.y;

          const clipId = `iclip${placed.id.replace(/\W/g, '')}`;
          const diamondPath = `M ${topV.x} ${topV.y} L ${rightV.x} ${rightV.y} L ${bottomV.x} ${bottomV.y} L ${leftV.x} ${leftV.y} Z`;

          return (
            <G key={`pimg-${placed.id}`}>
              <Defs>
                <ClipPath id={clipId}>
                  <Path d={diamondPath} />
                </ClipPath>
              </Defs>
              <G clipPath={`url(#${clipId})`} opacity={isBeingMoved ? 0.4 : 1}>
                <SvgImage
                  href={item.image}
                  x={minX}
                  y={minY}
                  width={bboxW}
                  height={bboxH}
                  preserveAspectRatio="xMidYMid slice"
                />
              </G>
              {isSelected && !isBeingMoved && (
                <Path
                  d={diamondPath}
                  fill="rgba(34,211,238,0.12)"
                  stroke={Colors.primary}
                  strokeWidth={2}
                />
              )}
            </G>
          );
        })}
      </G>
    );
  };

  const renderTileHitAreas = () => {
    const tileData: { x: number; y: number; depth: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        tileData.push({ x, y, depth: x + y });
      }
    }
    tileData.sort((a, b) => a.depth - b.depth);

    return tileData.map(({ x, y }) => {
      const center = isoToScreen(x + 0.5, y + 0.5, originX, originY);
      const placedHere = placedItems.find(p => p.x === x && p.y === y);
      const item = placedHere ? roomItems.find(i => i.id === placedHere.itemId) : null;
      const isSelectedTile = selectedPlacedItem?.x === x && selectedPlacedItem?.y === y;
      const hasImage = item && item.image;

      return (
        <Pressable
          key={`tile-${x}-${y}`}
          onPress={() => handleTilePress(x, y)}
          style={[
            styles.tileHitArea,
            {
              left: (center.x - TILE_WIDTH / 2) * ROOM_SCALE,
              top: (center.y - TILE_HEIGHT / 2) * ROOM_SCALE,
              width: TILE_WIDTH * ROOM_SCALE,
              height: TILE_HEIGHT * ROOM_SCALE,
            },
          ]}
        >
          {item && !hasImage && (
            <View style={[styles.placedItemMarker, { borderColor: isSelectedTile ? Colors.primary : 'transparent' }]}>
              <View style={[styles.itemIcon, { backgroundColor: RARITY_COLORS[item.rarity] + '30' }]}>
                <Ionicons name="cube" size={10} color={RARITY_COLORS[item.rarity]} />
              </View>
            </View>
          )}
          {isSelectedTile && !item && (
            <View style={styles.selectedTileIndicator} />
          )}
        </Pressable>
      );
    });
  };

  const renderItem = ({ item }: { item: RoomItem }) => {
    const status = getItemStatus(item);
    const isSelected = selectedItem?.id === item.id;
    const isLocked = status === 'locked';

    return (
      <Pressable
        onPress={() => {
          if (isLocked) return;
          if (isSelected) {
            setSelectedItem(null);
            setPreviewPosition(null);
          } else {
            setSelectedItem(item);
            setPreviewPosition(null);
            setSelectedPlacedItem(null);
            setIsMovingItem(false);
          }
        }}
        style={[
          styles.itemCard,
          {
            backgroundColor: isSelected ? Colors.primary + '20' : colors.card,
            borderColor: isSelected ? Colors.primary : colors.cardBorder,
            borderWidth: isSelected ? 2 : 1,
            opacity: isLocked ? 0.5 : 1,
          },
        ]}
      >
        <View style={[styles.itemPreview, { backgroundColor: colors.cardBorder }]}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.itemThumbnail}
              resizeMode="cover"
            />
          ) : (
            <Ionicons
              name={isLocked ? 'lock-closed' : 'cube'}
              size={22}
              color={isLocked ? colors.textMuted : RARITY_COLORS[item.rarity]}
            />
          )}
          {isLocked && item.image ? (
            <View style={styles.lockedOverlay}>
              <Ionicons name="lock-closed" size={16} color="#FFF" />
            </View>
          ) : null}
        </View>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemFooter}>
          {status === 'owned' && (
            <Text style={[styles.ownedText, { color: Colors.success }]}>Owned</Text>
          )}
          {status === 'purchasable' && (
            <View style={styles.priceRow}>
              <MaterialCommunityIcons name="crown" size={10} color="#FFD700" />
              <Text style={styles.priceText}>{item.price}</Text>
            </View>
          )}
          {status === 'locked' && (
            <Text style={[styles.lockedText, { color: colors.textMuted }]}>Locked</Text>
          )}
        </View>
        {item.url && (
          <Ionicons name="link" size={10} color={Colors.primary} style={styles.linkIcon} />
        )}
        {item.wallSide && (
          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>{item.wallSide === 'left' ? 'LEFT' : 'RIGHT'}</Text>
          </View>
        )}
        <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[item.rarity] }]} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#0F0F1A' }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Room Builder</Text>
          <Text style={styles.headerSubtitle}>Design Your Space</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setShowGrid(g => !g)} style={styles.headerIconBtn}>
            <Ionicons name={showGrid ? 'grid' : 'grid-outline'} size={18} color={showGrid ? Colors.primary : 'rgba(255,255,255,0.5)'} />
          </Pressable>
          <Pressable onPress={() => setIsZoomed(z => !z)} style={styles.headerIconBtn}>
            <Ionicons name={isZoomed ? 'remove-circle-outline' : 'add-circle-outline'} size={18} color={isZoomed ? Colors.primary : 'rgba(255,255,255,0.5)'} />
          </Pressable>
          <View style={styles.crownsDisplay}>
            <MaterialCommunityIcons name="crown" size={16} color="#FFD700" />
            <Text style={styles.crownsText}>{crowns.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.roomWrapper} contentContainerStyle={styles.roomWrapperContent} horizontal={false} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minWidth: '100%' as any }}>
        <View style={[styles.roomContainer, { width: roomWidth * ROOM_SCALE, height: roomHeight * ROOM_SCALE }]}>
          <Svg width={roomWidth * ROOM_SCALE} height={roomHeight * ROOM_SCALE} viewBox={`0 0 ${roomWidth} ${roomHeight}`}>
            <Defs>
              <LinearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#4A4A5A" />
                <Stop offset="100%" stopColor="#3A3A4A" />
              </LinearGradient>
              <LinearGradient id="leftWallGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#6B6B7B" />
                <Stop offset="100%" stopColor="#5A5A6A" />
              </LinearGradient>
              <LinearGradient id="rightWallGrad" x1="100%" y1="0%" x2="0%" y2="0%">
                <Stop offset="0%" stopColor="#7B7B8B" />
                <Stop offset="100%" stopColor="#6A6A7A" />
              </LinearGradient>
              <LinearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#3A3A4A" />
                <Stop offset="100%" stopColor="#2A2A3A" />
              </LinearGradient>
            </Defs>
            
            <Path d={leftWallPath} fill="url(#leftWallGrad)" />
            <Path d={rightWallPath} fill="url(#rightWallGrad)" />
            {renderWallImages()}
            {showGrid && <G>{renderLeftWallGridLines()}</G>}
            {showGrid && <G>{renderRightWallGridLines()}</G>}
            
            {selectedItem?.wallSide === 'left' && (
              <G>
                <Path d={leftWallPath} fill="rgba(34,211,238,0.15)" stroke={Colors.primary} strokeWidth={2} />
              </G>
            )}
            {selectedItem?.wallSide === 'right' && (
              <G>
                <Path d={rightWallPath} fill="rgba(34,211,238,0.15)" stroke={Colors.primary} strokeWidth={2} />
              </G>
            )}
            
            <Path d={floorPath} fill="url(#floorGrad)" />
            {showGrid && <G>{renderFloorGridLines()}</G>}

            {renderPlacedItemImages()}

            {activeItem?.category === 'flooring' && (
              <G>
                <Path d={floorPath} fill="rgba(34,211,238,0.15)" stroke={Colors.primary} strokeWidth={2} />
              </G>
            )}

            {activeItem && activeItem.category !== 'flooring' && validTileSet.size > 0 && (
              <G>
                {Array.from(validTileSet).map(key => {
                  const [tx, ty] = key.split('-').map(Number);
                  const isPreview = previewPosition && tx === previewPosition.x && ty === previewPosition.y;
                  if (isPreview) return null;
                  return (
                    <Path
                      key={`valid-${key}`}
                      d={getTileDiamondPath(tx, ty, originX, originY)}
                      fill="rgba(34,211,238,0.06)"
                      stroke="rgba(34,211,238,0.45)"
                      strokeWidth={1.2}
                    />
                  );
                })}
              </G>
            )}

            {previewPosition && activeItem && (
              <G>
                <Path
                  d={getBoundingBoxPath(
                    previewPosition.x,
                    previewPosition.y,
                    activeItem.width || 1,
                    activeItem.depth || 1,
                    originX,
                    originY
                  )}
                  fill="rgba(34,211,238,0.18)"
                  stroke={Colors.primary}
                  strokeWidth={2}
                  strokeDasharray="4,3"
                />
              </G>
            )}
            
            <Path d={basePath} fill="url(#baseGrad)" />
            <Path d={baseLeftPath} fill="#2A2A3A" />
          </Svg>
          
          <View style={[styles.tileOverlay, { width: roomWidth * ROOM_SCALE, height: roomHeight * ROOM_SCALE }]}>
            {renderTileHitAreas()}
            {selectedItem?.wallSide && (() => {
              const topLeft = isoToScreen(0, 0, originX, originY);
              const bottomLeft = isoToScreen(0, GRID_SIZE, originX, originY);
              const topRight = isoToScreen(GRID_SIZE, 0, originX, originY);
              
              if (selectedItem.wallSide === 'left') {
                const lwLeft = bottomLeft.x * ROOM_SCALE;
                const lwTop = (topLeft.y - WALL_HEIGHT) * ROOM_SCALE;
                const lwWidth = (topLeft.x - bottomLeft.x) * ROOM_SCALE;
                const lwHeight = (bottomLeft.y - (topLeft.y - WALL_HEIGHT)) * ROOM_SCALE;
                return (
                  <Pressable
                    onPress={() => handleWallSidePlace('left')}
                    style={{
                      position: 'absolute',
                      left: lwLeft,
                      top: lwTop,
                      width: lwWidth,
                      height: lwHeight,
                      zIndex: 10,
                    }}
                  />
                );
              } else {
                const rwLeft = topLeft.x * ROOM_SCALE;
                const rwTop = (topLeft.y - WALL_HEIGHT) * ROOM_SCALE;
                const rwWidth = (topRight.x - topLeft.x) * ROOM_SCALE;
                const rwHeight = (topRight.y - (topLeft.y - WALL_HEIGHT)) * ROOM_SCALE;
                return (
                  <Pressable
                    onPress={() => handleWallSidePlace('right')}
                    style={{
                      position: 'absolute',
                      left: rwLeft,
                      top: rwTop,
                      width: rwWidth,
                      height: rwHeight,
                      zIndex: 10,
                    }}
                  />
                );
              }
            })()}
            {selectedItem?.category === 'flooring' && (() => {
              const topPt = isoToScreen(0, 0, originX, originY);
              const rightPt = isoToScreen(GRID_SIZE, 0, originX, originY);
              const bottomPt = isoToScreen(GRID_SIZE, GRID_SIZE, originX, originY);
              const leftPt = isoToScreen(0, GRID_SIZE, originX, originY);
              const fLeft = leftPt.x * ROOM_SCALE;
              const fTop = topPt.y * ROOM_SCALE;
              const fWidth = (rightPt.x - leftPt.x) * ROOM_SCALE;
              const fHeight = (bottomPt.y - topPt.y) * ROOM_SCALE;
              return (
                <Pressable
                  onPress={handleFlooringPlace}
                  style={{
                    position: 'absolute',
                    left: fLeft,
                    top: fTop,
                    width: fWidth,
                    height: fHeight,
                    zIndex: 10,
                  }}
                />
              );
            })()}
            {!selectedItem && !isMovingItem && activeWallItems.left && (() => {
              const topLeft = isoToScreen(0, 0, originX, originY);
              const bottomLeft = isoToScreen(0, GRID_SIZE, originX, originY);
              const lwLeft = bottomLeft.x * ROOM_SCALE;
              const lwTop = (topLeft.y - WALL_HEIGHT) * ROOM_SCALE;
              const lwWidth = (topLeft.x - bottomLeft.x) * ROOM_SCALE;
              const lwHeight = (bottomLeft.y - (topLeft.y - WALL_HEIGHT)) * ROOM_SCALE;
              return (
                <Pressable
                  onPress={() => {
                    const placed = placedItems.find(p => {
                      const ri = roomItems.find(i => i.id === p.itemId);
                      return ri && ri.category === 'wall' && ri.wallSide === 'left';
                    });
                    if (placed) setSelectedPlacedItem(placed);
                  }}
                  style={{
                    position: 'absolute',
                    left: lwLeft,
                    top: lwTop,
                    width: lwWidth,
                    height: lwHeight,
                    zIndex: 10,
                  }}
                />
              );
            })()}
            {!selectedItem && !isMovingItem && activeWallItems.right && (() => {
              const topLeft = isoToScreen(0, 0, originX, originY);
              const topRight = isoToScreen(GRID_SIZE, 0, originX, originY);
              const rwLeft = topLeft.x * ROOM_SCALE;
              const rwTop = (topLeft.y - WALL_HEIGHT) * ROOM_SCALE;
              const rwWidth = (topRight.x - topLeft.x) * ROOM_SCALE;
              const rwHeight = (topRight.y - (topLeft.y - WALL_HEIGHT)) * ROOM_SCALE;
              return (
                <Pressable
                  onPress={() => {
                    const placed = placedItems.find(p => {
                      const ri = roomItems.find(i => i.id === p.itemId);
                      return ri && ri.category === 'wall' && ri.wallSide === 'right';
                    });
                    if (placed) setSelectedPlacedItem(placed);
                  }}
                  style={{
                    position: 'absolute',
                    left: rwLeft,
                    top: rwTop,
                    width: rwWidth,
                    height: rwHeight,
                    zIndex: 10,
                  }}
                />
              );
            })()}
            {!selectedItem && !isMovingItem && activeFlooringPlaced && (() => {
              const topPt = isoToScreen(0, 0, originX, originY);
              const rightPt = isoToScreen(GRID_SIZE, 0, originX, originY);
              const bottomPt = isoToScreen(GRID_SIZE, GRID_SIZE, originX, originY);
              const leftPt = isoToScreen(0, GRID_SIZE, originX, originY);
              const fLeft = leftPt.x * ROOM_SCALE;
              const fTop = topPt.y * ROOM_SCALE;
              const fWidth = (rightPt.x - leftPt.x) * ROOM_SCALE;
              const fHeight = (bottomPt.y - topPt.y) * ROOM_SCALE;
              return (
                <Pressable
                  onPress={() => setSelectedPlacedItem(activeFlooringPlaced)}
                  style={{
                    position: 'absolute',
                    left: fLeft,
                    top: fTop,
                    width: fWidth,
                    height: fHeight,
                    zIndex: 10,
                  }}
                />
              );
            })()}
          </View>
        </View>
        </ScrollView>
      </ScrollView>

      {selectedPlacedItem && (
        <View style={styles.actionBar}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>
              {roomItems.find(i => i.id === selectedPlacedItem.itemId)?.name}
            </Text>
            <Pressable onPress={() => handlePlacedItemAction('cancel')} style={styles.actionClose}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          {isMovingItem && (
            <View style={styles.moveHintRow}>
              <Ionicons name="move" size={14} color={Colors.primary} />
              <Text style={styles.moveHintText}>Tap a tile to move this item</Text>
            </View>
          )}
          <View style={styles.actionButtons}>
            {roomItems.find(i => i.id === selectedPlacedItem.itemId)?.url && (
              <Pressable
                onPress={() => handlePlacedItemAction('url')}
                style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              >
                <Ionicons name="open-outline" size={16} color="#000" />
                <Text style={styles.actionBtnText}>Visit</Text>
              </Pressable>
            )}
            {(() => {
              const selItem = roomItems.find(i => i.id === selectedPlacedItem.itemId);
              const isWallOrFlooring = selItem?.category === 'wall' || selItem?.category === 'flooring';
              if (isWallOrFlooring) return null;
              return (
                <Pressable
                  onPress={() => handlePlacedItemAction('move')}
                  style={[styles.actionBtn, { backgroundColor: isMovingItem ? '#F59E0B' : 'rgba(255,255,255,0.15)' }]}
                >
                  <Ionicons name="move" size={16} color={isMovingItem ? '#000' : '#FFF'} />
                  <Text style={[styles.actionBtnText, { color: isMovingItem ? '#000' : '#FFF' }]}>Move</Text>
                </Pressable>
              );
            })()}
            <Pressable
              onPress={() => handlePlacedItemAction('remove')}
              style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
            >
              <Ionicons name="trash-outline" size={16} color="#FFF" />
              <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.placementHintContainer}>
        {previewPosition && activeItem ? (
          <View style={styles.previewActions}>
            <View style={styles.previewInfo}>
              <Ionicons name="grid-outline" size={14} color={Colors.primary} />
              <Text style={styles.hintText}>
                {activeItem.name} at ({previewPosition.x}, {previewPosition.y})
              </Text>
            </View>
            <View style={styles.previewButtons}>
              <Pressable onPress={handleCancelPreview} style={styles.cancelPreviewBtn}>
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
              </Pressable>
              <Pressable onPress={handleConfirmPlacement} style={styles.placeBtn}>
                <Ionicons name="checkmark" size={16} color="#000" />
                <Text style={styles.placeBtnText}>Place</Text>
              </Pressable>
            </View>
          </View>
        ) : (selectedItem || (isMovingItem && selectedPlacedItem)) && !previewPosition ? (
          <View style={styles.placementHint}>
            <Ionicons name="finger-print" size={14} color={Colors.primary} />
            <Text style={styles.hintText}>
              {isMovingItem ? 'Tap a highlighted tile to reposition' : selectedItem?.category === 'flooring' ? `Tap the floor to apply: ${selectedItem?.name}` : selectedItem?.wallSide ? `Tap the ${selectedItem.wallSide} wall to apply: ${selectedItem?.name}` : `Tap a highlighted tile to place: ${selectedItem?.name}`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomPanel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.categoryTab,
                activeCategory === cat && styles.categoryTabActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === cat && styles.categoryTextActive,
                ]}
              >
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          data={categoryItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          horizontal
          contentContainerStyle={[styles.itemsList, { paddingBottom: insets.bottom + 8 }]}
          showsHorizontalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  crownsText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
  roomWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  roomWrapperContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  roomContainer: {
    position: 'relative',
    ...Platform.select({
      web: { boxShadow: '0 10px 20px rgba(0,0,0,0.5)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
    }),
    elevation: 10,
  },
  tileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  tileHitArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placedItemMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 20,
    padding: 2,
  },
  itemIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTileIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  placementHintContainer: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placementHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 15, 26, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)',
  },
  hintText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  previewActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: 'rgba(15, 15, 26, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    width: '100%' as unknown as number,
    marginHorizontal: 16,
  },
  previewInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flex: 1,
  },
  previewButtons: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  cancelPreviewBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  placeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  placeBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#000',
  },
  actionBar: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 30, 50, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  actionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  actionClose: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
    flex: 1,
  },
  moveHintRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
  },
  moveHintText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
  bottomPanel: {
    backgroundColor: 'rgba(20, 20, 35, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  categoryScroll: {
    maxHeight: 40,
    marginBottom: 10,
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.6)',
  },
  categoryTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  itemsList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  itemCard: {
    width: 90,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  itemPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  itemThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  itemName: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 4,
  },
  itemFooter: {
    minHeight: 14,
  },
  ownedText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  priceText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },
  lockedText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
  },
  linkIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  coverBadgeText: {
    color: '#000',
    fontSize: 7,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  rarityDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

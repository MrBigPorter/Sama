/**
 * Full-screen image viewer with pinch-to-zoom and swipe-to-dismiss.
 *
 * Navigation params: { url: string }
 *
 * Derived from Flutter's photo_preview_page.dart pattern:
 * - Pinch-to-zoom via react-native-gesture-handler PinchGestureHandler
 * - Double-tap to zoom in/out
 * - Swipe down to dismiss
 * - Dark overlay background
 */
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated as RNAnimated,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { RootStackParamList } from '@/Navigation';
import { useFront } from '@/lib/theme/ThemeContext';

type ImageViewerRouteProp = RouteProp<RootStackParamList, 'ImageViewer'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerScreen() {
  const route = useRoute<ImageViewerRouteProp>();
  const navigation = useNavigation();
  const { url } = route.params;
  const { colors } = useFront();

  // ── Zoom state ──────────────────────────────────────────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const [isZoomed, setIsZoomed] = useState(false);
  const imageSize = useRef({ width: SCREEN_WIDTH, height: SCREEN_WIDTH });

  // ── Swipe-to-dismiss ───────────────────────────────────────
  const dismissOpacity = useSharedValue(1);

  const goBack = () => {
    navigation.goBack();
  };

  // ── Pinch gesture ──────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else if (scale.value > 3) {
        scale.value = withTiming(3);
        savedScale.value = 3;
        runOnJS(setIsZoomed)(true);
      } else {
        savedScale.value = scale.value;
        runOnJS(setIsZoomed)(scale.value > 1.1);
      }
    });

  // ── Pan gesture (pan to move when zoomed, swipe to dismiss when not) ──
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isZoomed) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        // Swipe down to dismiss
        if (e.translationY > 0) {
          dismissOpacity.value = interpolate(
            e.translationY,
            [0, SCREEN_HEIGHT * 0.4],
            [1, 0],
          );
        }
      }
    })
    .onEnd((e) => {
      if (isZoomed) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        if (e.translationY > SCREEN_HEIGHT * 0.2) {
          dismissOpacity.value = withTiming(0);
          runOnJS(goBack)();
        } else {
          dismissOpacity.value = withTiming(1);
        }
      }
    });

  // ── Double-tap to toggle zoom ──────────────────────────────
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (isZoomed) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setIsZoomed)(false);
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(setIsZoomed)(true);
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const allGestures = Gesture.Exclusive(doubleTapGesture, composedGesture);

  // ── Animated styles ────────────────────────────────────────
  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dismissOpacity.value,
  }));

  // ── Single tap to toggle close button ──────────────────────
  const [showUI, setShowUI] = useState(true);
  const singleTapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(setShowUI)((prev) => !prev);
  });

  const tapOrDoubleTap = Gesture.Exclusive(doubleTapGesture, singleTapGesture);
  const finalGesture = Gesture.Race(tapOrDoubleTap, composedGesture);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Dark background */}
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        <GestureDetector gesture={finalGesture}>
          <Animated.View style={[styles.imageWrapper, imageAnimatedStyle]}>
            <Image
              source={{ uri: url }}
              style={styles.image}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {/* Close button (fades with showUI) */}
      {showUI && (
        <TouchableOpacity
          style={[styles.closeButton]}
          onPress={goBack}
          activeOpacity={0.7}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

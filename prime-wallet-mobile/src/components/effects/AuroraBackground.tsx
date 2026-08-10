import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

/** Aurora blobs — thay WebGLBackground trên mobile. */
export function AuroraBackground() {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    t2.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, true);
    t3.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [t1, t2, t3]);

  const blob1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: -40 + t1.value * 60 },
      { translateY: 20 + t2.value * 40 },
      { scale: 1 + t3.value * 0.15 },
    ],
  }));
  const blob2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: width * 0.3 + t2.value * 50 },
      { translateY: height * 0.15 + t1.value * 30 },
      { scale: 1.1 + t1.value * 0.1 },
    ],
  }));
  const blob3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: width * 0.1 + t3.value * 70 },
      { translateY: height * 0.35 + t2.value * 50 },
      { scale: 0.9 + t2.value * 0.2 },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.blob, blob1]}>
        <LinearGradient colors={["rgba(252,114,255,0.35)", "transparent"]} style={styles.gradient} />
      </Animated.View>
      <Animated.View style={[styles.blob, blob2]}>
        <LinearGradient colors={["rgba(180,120,255,0.28)", "transparent"]} style={styles.gradient} />
      </Animated.View>
      <Animated.View style={[styles.blob, blob3]}>
        <LinearGradient colors={["rgba(76,130,251,0.22)", "transparent"]} style={styles.gradient} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width,
    overflow: "hidden",
  },
  gradient: { flex: 1, borderRadius: width },
});

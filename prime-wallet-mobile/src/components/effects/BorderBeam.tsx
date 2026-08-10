import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

/** Border glow đơn giản — thay BorderBeam CSS offset-path. */
export function BorderBeam({ children }: { children: React.ReactNode }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false);
  }, [rotation]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none">
        <LinearGradient
          colors={["#fc72ff", "#4c82fb", "transparent", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", borderRadius: 24, overflow: "hidden" },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    padding: 2,
  },
  gradient: { flex: 1, borderRadius: 24, opacity: 0.7 },
  inner: {
    margin: 2,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(27,27,27,0.92)",
  },
});

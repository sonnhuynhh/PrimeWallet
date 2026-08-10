import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type Props = {
  end: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
};

export function CountUp({ end, prefix = "", suffix = "", decimals = 0, className }: Props) {
  const value = useSharedValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    value.value = withSpring(end, { damping: 18, stiffness: 60 });
  }, [end, value]);

  useAnimatedReaction(
    () => value.value,
    (v) => {
      runOnJS(setDisplay)(v.toFixed(decimals));
    },
  );

  return (
    <Text className={className}>
      {prefix}
      {display}
      {suffix}
    </Text>
  );
}

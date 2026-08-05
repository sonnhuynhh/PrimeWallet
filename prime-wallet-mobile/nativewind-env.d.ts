import "react-native";
import "react-native-safe-area-context";
import "react-native-gesture-handler";

/// <reference types="nativewind/types" />

declare module "*.css";

declare const process: {
	env: Record<string, string | undefined>;
};

declare module "react-native" {
	interface ViewProps {
		className?: string;
	}

	interface TextProps {
		className?: string;
	}

	interface PressableProps {
		className?: string;
	}

	interface TextInputProps {
		className?: string;
	}

	interface ScrollViewProps {
		className?: string;
	}
}

declare module "react-native-safe-area-context" {
	interface SafeAreaViewProps {
		className?: string;
	}
}

declare module "react-native-gesture-handler" {
	interface GestureHandlerRootViewProps {
		style?: unknown;
	}
}

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { WalletLayout } from "../components/layout/WalletLayout";
import { useAuth } from "../context/AuthContext";
import { HomeScreen } from "./HomeScreen";
import { HistoryScreen } from "./HistoryScreen";
import { ProfileScreen } from "./ProfileScreen";
import { shellTheme } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

const Tab = createBottomTabNavigator();
type Props = NativeStackScreenProps<RootStackParamList, "Fiat">;

function FiatTabs() {
  const theme = shellTheme.fiat;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1b1b1b",
          borderTopColor: "rgba(255,255,255,0.08)",
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: "#9b9b9b",
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
            Overview: "view-dashboard-outline",
            History: "history",
            Profile: "account-circle-outline",
          };
          return <MaterialCommunityIcons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview" component={HomeScreen} options={{ title: "Tổng quan" }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: "Lịch sử" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Hồ sơ" }} />
    </Tab.Navigator>
  );
}

export function FiatShellScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <WalletLayout
      shell="fiat"
      title="Ví Fiat"
      subtitle="Nạp VNPAY · Chuyển tiền · Hóa đơn"
      onSwitchWallet={() => navigation.replace("WalletType")}
      onSignOut={() => signOut()}
    >
      <FiatTabs />
    </WalletLayout>
  );
}

import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await signIn({ email, password });
    } catch (error) {
      Alert.alert("Đăng nhập thất bại", error instanceof Error ? error.message : "Vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Đăng nhập"
      description="Truy cập ví Fiat & Crypto đã liên kết."
      tagline="Ví đa tài sản — Fiat & Crypto trong một app"
      footer={
        <Pressable onPress={() => navigation.navigate("Register")} className="items-center py-2">
          <Text className="text-muted-foreground">
            Chưa có tài khoản? <Text className="font-bold text-primary">Đăng ký</Text>
          </Text>
        </Pressable>
      }
    >
      <View className="gap-4">
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="user@example.com" keyboardType="email-address" />
        <Input label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
        <Button title="Đăng nhập" onPress={() => void handleSubmit()} loading={loading} />
      </View>
    </AuthLayout>
  );
}

import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await signUp({ fullName, email, phone, password });
    } catch (error) {
      Alert.alert("Đăng ký thất bại", error instanceof Error ? error.message : "Vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Tạo tài khoản"
      description="Một tài khoản — ví Fiat VND và Crypto Web3."
      tagline="Bắt đầu hành trình tài chính đa tài sản"
      footer={
        <Pressable onPress={() => navigation.goBack()} className="items-center py-2">
          <Text className="text-muted-foreground">
            Đã có tài khoản? <Text className="font-bold text-primary">Đăng nhập</Text>
          </Text>
        </Pressable>
      }
    >
      <View className="gap-4">
        <Input label="Họ tên" value={fullName} onChangeText={setFullName} placeholder="Nguyễn Văn A" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="user@example.com" keyboardType="email-address" />
        <Input label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="0912345678" keyboardType="phone-pad" />
        <Input label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="Tối thiểu 6 ký tự" secureTextEntry />
        <Button title="Đăng ký" onPress={() => void handleSubmit()} loading={loading} />
      </View>
    </AuthLayout>
  );
}

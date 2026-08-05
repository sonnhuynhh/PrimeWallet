import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";

export function LoginScreen({ navigation }: any) {
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
    <Screen>
      <View className="flex-1 justify-center gap-6 py-8">
        <View>
          <Text className="text-sm uppercase tracking-[0.35em] text-emerald-300">Prime Wallet</Text>
          <Text className="mt-2 text-4xl font-black text-white">Quản lý ví, gọn và nhanh</Text>
          <Text className="mt-3 text-base leading-6 text-slate-300">Đăng nhập để truy cập số dư, lịch sử giao dịch và chuyển tiền đa nền tảng.</Text>
        </View>

        <Card className="gap-4">
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="user@example.com" keyboardType="email-address" />
          <Input label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          <Button title="Đăng nhập" onPress={handleSubmit} loading={loading} />
        </Card>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}> 
          <Text className="text-center text-slate-300">Chưa có tài khoản? <Text className="font-semibold text-emerald-300">Đăng ký ngay</Text></Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

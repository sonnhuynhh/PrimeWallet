import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";

export function RegisterScreen({ navigation }: any) {
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
    <Screen>
      <View className="flex-1 justify-center gap-6 py-8">
        <View>
          <Text className="text-sm uppercase tracking-[0.35em] text-cyan-300">Tạo tài khoản</Text>
          <Text className="mt-2 text-4xl font-black text-white">Bắt đầu với một ví Prime Wallet mới</Text>
        </View>

        <Card className="gap-4">
          <Input label="Họ tên" value={fullName} onChangeText={setFullName} placeholder="Nguyễn Văn A" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="user@example.com" keyboardType="email-address" />
          <Input label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="0912345678" keyboardType="phone-pad" />
          <Input label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="Tối thiểu 6 ký tự" secureTextEntry />
          <Button title="Đăng ký" onPress={handleSubmit} loading={loading} />
        </Card>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-center text-slate-300">Đã có tài khoản? <Text className="font-semibold text-cyan-300">Quay về đăng nhập</Text></Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

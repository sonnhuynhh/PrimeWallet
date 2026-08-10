import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { toastErr, toastOk } from "../components/feedback/toast";
import { useAuth } from "../context/AuthContext";
import { shellTheme } from "../theme/tokens";

export function ProfileScreen() {
  const { session, signOut, updateProfile, changePassword } = useAuth();
  const theme = shellTheme.fiat;
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [editName, setEditName] = useState(session?.profile.fullName ?? "");
  const [editDob, setEditDob] = useState(session?.profile.dateOfBirth ?? "");
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const joinedAt = useMemo(() => {
    const value = session?.profile.createdAt ?? session?.account?.createdAt;
    return value ? new Date(value).toLocaleDateString("vi-VN") : "-";
  }, [session?.profile.createdAt, session?.account?.createdAt]);

  const kycVariant =
    session?.profile.kycStatus === "VERIFIED" ? "success" : session?.profile.kycStatus === "REJECTED" ? "danger" : "warning";

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName: editName, dateOfBirth: editDob || null });
      setEditOpen(false);
      toastOk("Cập nhật thông tin thành công");
    } catch (e) {
      toastErr(e, "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (pwdNew !== pwdConfirm) {
      toastErr("Mật khẩu xác nhận không khớp");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: pwdCurrent, newPassword: pwdNew, confirmNewPassword: pwdConfirm });
      setPwdOpen(false);
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      toastOk("Đổi mật khẩu thành công");
    } catch (e) {
      toastErr(e, "Đổi mật khẩu thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      <Card className="mb-4 items-center gap-3 py-6">
        <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: theme.primarySoft }}>
          <MaterialCommunityIcons name="account" size={40} color={theme.primary} />
        </View>
        <Text className="text-2xl font-extrabold text-white">{session?.profile.fullName}</Text>
        <Text className="text-muted-foreground">{session?.profile.email}</Text>
        <Badge variant={kycVariant}>{session?.profile.kycStatus ?? "PENDING"}</Badge>
      </Card>

      <Card className="mb-4 gap-3">
        <Row label="Số điện thoại" value={session?.profile.phone ?? "-"} />
        <Row label="Ngày tham gia" value={joinedAt} />
        <Row label="Số tài khoản" value={session?.account?.accountNumber ?? "—"} mono />
      </Card>

      <View className="gap-3">
        <Button title="Chỉnh sửa hồ sơ" onPress={() => { setEditName(session?.profile.fullName ?? ""); setEditDob(session?.profile.dateOfBirth ?? ""); setEditOpen(true); }} />
        <Button title="Đổi mật khẩu" variant="ghost" onPress={() => setPwdOpen(true)} />
        <Button title="Đăng xuất" variant="ghost" onPress={() => void signOut().then(() => Alert.alert("Đã đăng xuất"))} />
      </View>

      <Modal visible={editOpen} title="Chỉnh sửa hồ sơ" onClose={() => setEditOpen(false)}>
        <Input label="Họ tên" value={editName} onChangeText={setEditName} />
        <Input label="Ngày sinh (YYYY-MM-DD)" value={editDob} onChangeText={setEditDob} />
        <Button title="Lưu" onPress={() => void saveProfile()} loading={saving} />
      </Modal>

      <Modal visible={pwdOpen} title="Đổi mật khẩu" onClose={() => setPwdOpen(false)}>
        <Input label="Mật khẩu hiện tại" value={pwdCurrent} onChangeText={setPwdCurrent} secureTextEntry />
        <Input label="Mật khẩu mới" value={pwdNew} onChangeText={setPwdNew} secureTextEntry />
        <Input label="Xác nhận mật khẩu" value={pwdConfirm} onChangeText={setPwdConfirm} secureTextEntry />
        <Button title="Đổi mật khẩu" onPress={() => void savePassword()} loading={saving} />
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className={`font-semibold text-white ${mono ? "font-mono text-xs" : ""}`}>{value}</Text>
    </View>
  );
}

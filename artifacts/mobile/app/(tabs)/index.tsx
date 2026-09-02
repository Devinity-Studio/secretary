import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { colors, spacing, fontSize } from '@/constants/theme';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);
  const router = useRouter();

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>MyDesk</Text>
        <Text style={styles.subtitle}>เลขาการเงิน + บันทึกประจำวัน</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => void continueAsGuest('ฉัน')}
        >
          <Text style={styles.primaryBtnText}>เริ่มใช้งาน (โหมดออฟไลน์)</Text>
        </Pressable>
        <Text style={styles.hint}>ข้อมูลเก็บในเครื่องของคุณ ไม่ต้องสมัครก่อน</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        สวัสดี{user.displayName ? `, ${user.displayName}` : ''} 👋
      </Text>
      <Text style={styles.sectionTitle}>วันนี้</Text>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.successLight }]}>
          <Text style={styles.summaryLabel}>รายรับ</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>฿0</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.dangerLight }]}>
          <Text style={styles.summaryLabel}>รายจ่าย</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>฿0</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.primaryLight }]}>
          <Text style={styles.summaryLabel}>สุทธิ</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>฿0</Text>
        </View>
      </View>

      <Pressable style={styles.captureBtn} onPress={() => router.push('/finance')}>
        <Text style={styles.captureBtnText}>+ บันทึกรายการเร็ว</Text>
        <Text style={styles.captureHint}>เช่น กาแฟ 65 / เงินเดือน 25000</Text>
      </Pressable>

      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>ยังไม่มีรายการวันนี้</Text>
        <Text style={styles.emptySub}>เริ่มบันทึกรายรับ-รายจ่ายหรือเป้าหมายได้เลย</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  logo: { fontSize: 36, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: 32 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  hint: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  greeting: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionTitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: fontSize.lg, fontWeight: '700' },
  captureBtn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  captureBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  captureHint: { fontSize: fontSize.sm, color: colors.gray400 },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: 4 },
  emptySub: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
});

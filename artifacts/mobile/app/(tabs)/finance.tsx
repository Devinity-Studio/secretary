import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fontSize } from '@/constants/theme';

export default function FinanceScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>การเงิน</Text>
      <Text style={styles.subtitle}>รายรับ • รายจ่าย • โอน • หลายบัญชี</Text>

      <View style={styles.periodRow}>
        {['วันนี้', 'สัปดาห์', 'เดือน', 'ปี'].map((p, i) => (
          <View key={p} style={[styles.periodChip, i === 2 && styles.periodChipActive]}>
            <Text style={[styles.periodText, i === 2 && styles.periodTextActive]}>{p}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>สรุปเดือนนี้</Text>
        <View style={styles.row}>
          <Text style={styles.label}>รายรับ</Text>
          <Text style={[styles.value, { color: colors.success }]}>฿0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>รายจ่าย</Text>
          <Text style={[styles.value, { color: colors.danger }]}>฿0</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.labelBold}>สุทธิ</Text>
          <Text style={styles.valueBold}>฿0</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>บัญชีของฉัน</Text>
        <Text style={styles.placeholder}>
          จะแสดงเงินสด / ธนาคาร / บัตรเครดิต / e-Wallet ที่นี่
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>รายการล่าสุด</Text>
        <Text style={styles.placeholder}>ยังไม่มีรายการ — เริ่มบันทึกได้ในขั้นถัดไป</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { fontSize: fontSize.sm, color: colors.textSecondary },
  periodTextActive: { color: colors.white, fontWeight: '600' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  rowLast: { borderBottomWidth: 0, marginTop: 4 },
  label: { fontSize: fontSize.md, color: colors.textSecondary },
  labelBold: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  value: { fontSize: fontSize.md, fontWeight: '600' },
  valueBold: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  placeholder: { fontSize: fontSize.sm, color: colors.gray400 },
});

/** หมวดหมู่รายรับ-รายจ่ายเริ่มต้น (ภาษาไทย) */

export interface CategoryItem {
  id: string;
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
}

export const defaultCategories: CategoryItem[] = [
  // รายจ่าย
  { id: 'food', name: 'อาหาร', type: 'expense', icon: '🍜' },
  { id: 'transport', name: 'เดินทาง', type: 'expense', icon: '🚗' },
  { id: 'utilities', name: 'สาธารณูปโภค', type: 'expense', icon: '🏠' },
  { id: 'phone', name: 'โทรศัพท์/เน็ต', type: 'expense', icon: '📱' },
  { id: 'shopping', name: 'ช้อปปิ้ง', type: 'expense', icon: '🛒' },
  { id: 'credit_payment', name: 'ชำระบัตรเครดิต', type: 'expense', icon: '💳' },
  { id: 'health', name: 'สุขภาพ', type: 'expense', icon: '🏥' },
  { id: 'gift', name: 'ของขวัญ', type: 'expense', icon: '🎁' },
  { id: 'entertainment', name: 'บันเทิง', type: 'expense', icon: '🎬' },
  { id: 'education', name: 'การศึกษา', type: 'expense', icon: '📚' },
  { id: 'other_expense', name: 'อื่นๆ', type: 'expense', icon: '📦' },
  // รายรับ
  { id: 'salary', name: 'เงินเดือน', type: 'income', icon: '💵' },
  { id: 'freelance', name: 'งานพิเศษ', type: 'income', icon: '💼' },
  { id: 'investment_return', name: 'ผลตอบแทน', type: 'income', icon: '📈' },
  { id: 'other_income', name: 'รายรับอื่นๆ', type: 'income', icon: '💰' },
];

export const defaultAccounts = [
  { name: 'เงินสด', accountType: 'cash' as const, icon: '💵', color: '#10B981' },
  { name: 'บัญชีธนาคาร', accountType: 'bank' as const, icon: '🏦', color: '#2563EB' },
];

/** สร้าง UUID แบบง่าย ไม่พึ่ง native module เพิ่ม */

export function createId(): string {
  // RFC4122-ish version 4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

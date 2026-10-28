/**
 * MicMeter — คำนวณ "ระดับเสียง" จากข้อมูล waveform ดิบของไมโครโฟน (pure, framework-free)
 *
 * เดิมที Web Speech API ไม่เปิดเผยความดังเสียง — เราจึงเปิด stream เสริมด้วย
 * Web Audio AnalyserNode แล้วอ่านค่า time-domain มาคำนวณ RMS ที่นี่
 * แยกฟังก์ชันออกจาก React เพื่อทดสอบได้ตรง ๆ
 */

/** ค่า RMS (0..1) ที่ต่ำกว่านี้ถือว่าเงียบ — กัน楼下 noise ทำให้ fill สั่นตลอด */
const NOISE_GATE = 0.02;

/** RMS คูณเข้าเพื่อให้ฟึดเต็มที่เร็วขึ้นเล็กน้อย (พูดปกติจะไม่ถึง RMS 1.0) */
const FULL_LEVEL_AT = 0.38;

/** แปลง RMS ดิบเป็นระดับ 0..1 สำหรับไล่เฉดบนปุ่มไมค์ */
export function levelFromRms(rms: number): number {
  if (!Number.isFinite(rms) || rms <= NOISE_GATE) return 0;
  const leveled = (rms - NOISE_GATE) / (FULL_LEVEL_AT - NOISE_GATE);
  return Math.min(1, Math.max(0, leveled));
}

/**
 * คำนวณระดับจากค่า time-domain ของ AnalyserNode (getByteTimeDomainData)
 * ค่าอยู่ช่วง 0..255 โดย 128 = จุดเงียบ
 */
export function rmsFromTimeDomain(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    const v = (bytes[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / bytes.length);
  return levelFromRms(rms);
}

/**
 * ค่าเฉลี่ยแบบ Exponential Moving Average — ทำให้ fill เลื่อนนุ่ม ไม่กระตุก
 * factor มาก = ตอบสนองไวแต่สั่นเร็ว, น้อย = นุ่มกว่า
 */
export function smoothLevel(previous: number, next: number, factor = 0.25): number {
  const clamped = Math.min(1, Math.max(0, Math.min(1, Math.max(0, next))));
  return previous + (clamped - previous) * factor;
}

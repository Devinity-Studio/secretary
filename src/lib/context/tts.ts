/**
 * TTS (SpeechSynthesis) — เสียงเลขาตอบกลับ
 *
 * ใช้ Web Speech API ฝั่ง SpeechSynthesis ซึ่งรองรับกว้างกว่าไมค์
 * หลังบันทึกบริบทสำเร็จ เลขาจะพูดทักทายแบบผู้ช่วยจริง ๆ
 * เช่น "เรียบร้อยแล้วค่ะบอส" พร้อมอ่านทวนสิ่งที่จับได้สั้น ๆ
 *
 * แยกออกจาก React เพื่อทดสอบ/เรียกจาก vanilla code ได้
 */

export const SECRETARY_TTS_PHRASES = [
  "เรียบร้อยแล้วค่ะบอส",
  "บันทึกให้แล้วค่ะบอส",
  "รับทราบค่ะบอส จดไว้ให้แล้ว",
  "เอาไว้ให้ค่ะบอส จำได้แล้ว",
] as const;

function pickPhrase(seed: string): string {
  // deterministic จาก seed (เช่น context id) กันเสียงซ้ำกันติด ๆ กันแบบสุ่มล้วน
  let acc = 0;
  for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) >>> 0;
  return SECRETARY_TTS_PHRASES[acc % SECRETARY_TTS_PHRASES.length];
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** ตัดข้อความทวนให้สั้น — ไม่อ่านทั้งย่อหน้า */
function shortEcho(text: string, max = 40): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * พูดข้อความเลขาตอบกลับ
 * @param seed ค่าใช้เลือกประโยค (เช่น context id)
 * @param echo ข้อความที่จะอ่านทวน (optional)
 */
export function speakSecretaryReply(seed: string, echo?: string): void {
  if (!ttsSupported()) return;
  try {
    const line = pickPhrase(seed);
    const full = echo ? `${line}  ${shortEcho(echo)}` : line;
    const utter = new SpeechSynthesisUtterance(full);
    utter.lang = "th-TH";
    utter.rate = 1.05;
    utter.pitch = 1.15;
    // เลือกเสียงไทยถ้ามี — ปล่อย default ได้ แต่ไทยจะออกเสียงชัดกว่า
    const voices = window.speechSynthesis.getVoices();
    const th = voices.find((v) => v.lang?.toLowerCase().startsWith("th"));
    if (th) utter.voice = th;
    window.speechSynthesis.cancel(); // กันคิวค้างจากรอบก่อน
    window.speechSynthesis.speak(utter);
  } catch {
    /* เงียบ ๆ — TTS เสียไม่ควรทำให้ flow พัง */
  }
}

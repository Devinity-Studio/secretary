/**
 * Receipt Capture — ถ่ายรูป/เลือกไฟล์ ใบเสร็จ → DataURL (JPEG, ย่อขนาด)
 *
 * หลักการ:
 * - รูปเป็น "หลักฐานดิบ" (immutable evidence) — เก็บสำเนาขนาดพอเหมาะใน
 *   content.data.imageDataUrl ของ Evidence ผ่าน hybrid content
 *   (โครงสร้าง EvidenceContent มี kind: "hybrid" = text + data อยู่แล้ว)
 * - ไม่แตะ Finance/Goals — สร้าง Context อย่างเดียว (Record First)
 * - ย่อรูปเหลือยาวด้านยาว ~1280px & JPEG q0.72 กัน localStorage ล้น
 */

export const RECEIPT_IMAGE_MAX_EDGE = 1280;
export const RECEIPT_IMAGE_QUALITY = 0.72;
/** dataURL ใหญ่กว่านี้ถือว่าเกินต่อ localStorage — ~2.6MB base64 */
export const RECEIPT_IMAGE_MAX_BYTES = 2_600_000;

export type ReceiptCaptureOrigin = "camera" | "file";

/**
 * ย่อ + เข้ารหัสรูปเป็น JPEG dataURL
 * @throws Error ถ้ารูปใหญ่เกินหลังย่อ (ป้องกัน localStorage quota)
 */
export async function resizeToDataUrl(
  source: Blob,
  maxEdge = RECEIPT_IMAGE_MAX_EDGE,
  quality = RECEIPT_IMAGE_QUALITY,
): Promise<string> {
  const bitmap = await loadBitmap(source);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (dataUrl.length > RECEIPT_IMAGE_MAX_BYTES) {
    throw new Error("รูปใหญ่เกินที่จัดเก็บได้");
  }
  return dataUrl;
}

async function loadBitmap(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source);
    } catch {
      /* fall through to <img> */
    }
  }
  // Safari เก่า — ใช้ <img> ผ่าน objectURL
  const url = URL.createObjectURL(source);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("อ่านรูปไม่สำเร็จ"));
      img.src = url;
    });
  } finally {
    // revoke หลังโหลดเสร็จ — img ยังวาดได้ตามสเปก (แต่กัน memory รั่วเป็นหลัก)
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/**
 * เปิดกล้องถ่ายรูป (getUserMedia) — คืน Blob ของภาพถ่าย
 * ผู้ใช้กดปุ่มบน overlay ตัวเองเพื่อถ่าย; reject ถ้าไม่ได้สิทธิ์/ไม่รองรับ
 */
export function captureFromCamera(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !video.videoWidth) {
      reject(new Error("กล้องยังไม่พร้อม"));
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("ถ่ายรูปไม่สำเร็จ"));
      },
      "image/jpeg",
      0.9,
    );
  });
}

/**
 * รวมสิ่งที่ UI ต้องเพิ่มลง Evidence content.data (metadata ของรูป)
 */
export function receiptEvidenceMeta(
  origin: ReceiptCaptureOrigin,
  dataUrl: string,
): Record<string, unknown> {
  return {
    imageDataUrl: dataUrl,
    captureOrigin: origin,
  };
}

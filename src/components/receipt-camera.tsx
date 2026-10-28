import { Camera, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  captureFromCamera,
  resizeToDataUrl,
  type ReceiptCaptureOrigin,
} from "@/lib/context/receipt";

/**
 * ReceiptCameraModal — ถ่ายใบเสร็จจากกล้องหน้าเว็บ หรือเลือกไฟล์รูป
 *
 * ผลลัพธ์: dataURL (JPEG ย่อแล้ว) ส่งให้ caller ผูกเป็น Evidence
 * - กล้อง: getUserMedia → <video> → snapshot
 * - เลือกไฟล์: <input type="file" accept="image/*" capture="environment">
 *   (บนมือถือเปิดกล้องของ OS ให้เลย — เป็น fallback ที่เสถียรกว่า)
 */
export function ReceiptCameraModal({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  /** ได้ dataURL + แหล่งที่มา หลังจับรูปสำเร็จ */
  onCaptured: (dataUrl: string, origin: ReceiptCaptureOrigin) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"pick" | "camera" | "preview">("pick");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  async function startCamera() {
    setMode("camera");
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCamError("ไม่ได้รับอนุญาตใช้กล้อง หรืออุปกรณ์นี้ไม่มีกล้อง");
      streamRef.current = null;
    }
  }

  function stopCamera() {
    stopStream();
    setMode("pick");
  }

  async function take() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    try {
      const blob = await captureFromCamera(video);
      const dataUrl = await resizeToDataUrl(blob);
      setShot(dataUrl);
      setMode("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ถ่ายรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      setShot(dataUrl);
      setMode("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อ่านรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!shot) return;
    onCaptured(
      shot,
      streamRef.current ? "camera" : "file",
    );
    setShot(null);
    stopStream();
    onClose();
  }

  // cleanup เมื่อปิด/ถอด
  useEffect(() => {
    if (!open) {
      stopStream();
      setShot(null);
      setMode("pick");
      setCamError(null);
    }
    return () => stopStream();
  }, [open, stopStream]);

  return (
    <Modal title="ถ่ายใบเสร็จ" open={open} onClose={() => { stopCamera(); onClose(); }}>
      {mode === "pick" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            ถ่ายรูปใบเสร็จ/เอกสาร หรือเลือกจากแกลเลอรี — รูปจะถูกแนบเป็นหลักฐาน
            ในบริบททันที
          </p>
          {camError ? <p className="text-sm text-expense">{camError}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={startCamera}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              <Camera className="size-6" strokeWidth={1.75} />
              เปิดกล้อง
            </button>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium transition-colors hover:bg-surface-2">
              <ImagePlus className="size-6" strokeWidth={1.75} />
              เลือกรูป
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      ) : null}

      {mode === "camera" ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-ink">
            <video
              ref={videoRef}
              playsInline
              muted
              className="max-h-[55dvh] w-full object-cover"
              aria-label="ภาพจากกล้อง"
            />
            {camError ? (
              <p className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-ink/70 px-3 py-1.5 text-xs text-white">
                {camError}
              </p>
            ) : null}
          </div>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              onClick={take}
              disabled={busy || !!camError}
              className="flex-1"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              ถ่ายภาพ
            </Button>
            <Button type="button" variant="secondary" onClick={stopCamera}>
              ออก
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "preview" && shot ? (
        <div className="space-y-3">
          <img
            src={shot}
            alt="ใบเสร็จที่จับได้"
            className="max-h-[55dvh] w-full rounded-xl object-contain"
          />
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={confirm}>
              <CheckIcon />
              แนบเป็นหลักฐาน
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="ถ่ายใหม่"
              onClick={() => {
                setShot(null);
                void startCamera();
              }}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function CheckIcon() {
  return <span className="text-sm">✓</span>;
}

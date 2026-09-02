import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { authEnabled, signInWithGoogle, supabase } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();

  // Redirect to home if already signed in
  useEffect(() => {
    if (!isPending && user) {
      window.location.href = "/";
    }
  }, [user, isPending]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">กำลังตรวจสอบ...</p>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight">MyDesk</h1>
          <p className="mt-2 text-sm text-muted">เลขาการเงินส่วนตัว</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <p className="text-center text-sm text-muted">เข้าสู่ระบบเพื่อบันทึกข้อมูลของคุณ</p>

          {authEnabled ? (
            <Button
              onClick={() => signInWithGoogle("/")}
              className="w-full"
              size="lg"
            >
              <svg className="mr-2 size-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              เข้าสู่ระบบด้วย Google
            </Button>
          ) : (
            <p className="text-center text-sm text-muted">
              Auth ยังไม่ได้เปิดใช้งาน
            </p>
          )}
        </div>

        <Link
          to="/"
          className="block text-center text-sm text-muted underline-offset-4 hover:underline"
        >
          ข้ามไปใช้งาน (ไม่ต้องเข้าสู่ระบบ)
        </Link>
      </div>
    </div>
  );
}

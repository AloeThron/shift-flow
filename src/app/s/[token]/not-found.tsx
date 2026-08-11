import Link from "next/link";

/** 404 สำหรับหน้า share — token ไม่พบ/หมดอายุ/เพิกถอน */
export default function ShareNotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">ไม่พบตารางเวร</h1>
      <p className="text-muted-foreground text-sm">ลิงก์นี้อาจหมดอายุ ถูกเพิกถอน หรือไม่ถูกต้อง</p>
      <Link href="/login" className="text-primary text-sm underline-offset-4 hover:underline">
        ไปหน้าเข้าสู่ระบบ
      </Link>
    </div>
  );
}

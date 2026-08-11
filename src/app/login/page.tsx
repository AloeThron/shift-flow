import { Suspense } from "react";

import { env } from "@/env";

import LoginForm from "./login-form";

/** หน้า login — wrap Suspense สำหรับ useSearchParams */
export default function LoginPage() {
  const showDevAccounts = env.NODE_ENV === "development";

  return (
    <Suspense fallback={<main className="p-6 text-center text-sm">กำลังโหลด...</main>}>
      <LoginForm showDevAccounts={showDevAccounts} />
    </Suspense>
  );
}

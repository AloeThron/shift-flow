import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/** provider สำหรับ client components ที่ใช้ session */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

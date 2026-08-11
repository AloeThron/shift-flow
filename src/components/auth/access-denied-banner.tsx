import { ACCESS_DENIED_MESSAGES } from "@/lib/auth/landing-path";

type AccessDeniedBannerProps = {
  error?: string;
};

/** แบนเนอร์แจ้งเตือนเมื่อถูก redirect จากหน้าที่ไม่มีสิทธิ์ */
export function AccessDeniedBanner({ error }: AccessDeniedBannerProps) {
  if (!error) {
    return null;
  }

  const message = ACCESS_DENIED_MESSAGES[error];
  if (!message) {
    return null;
  }

  return (
    <p
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
      role="alert"
    >
      {message}
    </p>
  );
}

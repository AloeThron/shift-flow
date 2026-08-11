import { Lock } from "lucide-react";

/** มาร์กเคอร์มุมเซลล์ที่ถูกล็อก */
export function CanvasCellLockMarker() {
  return (
    <span
      className="pointer-events-none absolute top-0 right-0 z-[1] flex size-4 items-center justify-center rounded-bl-md bg-amber-500 text-white shadow-sm"
      title="ล็อกแล้ว"
      aria-hidden
    >
      <Lock className="size-2.5" strokeWidth={2.5} />
    </span>
  );
}

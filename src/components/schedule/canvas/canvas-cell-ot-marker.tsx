/** มาร์ก OT มุมล่างขวาของเซลล์ — เรียบกว่า lock marker */
export function CanvasCellOtMarker() {
  return (
    <span
      className="text-orange-600/70 dark:text-orange-400/60 pointer-events-none absolute right-0 bottom-0 z-[1] px-0.5 text-[8px] leading-none font-medium"
      title="มี OT"
      aria-hidden
    >
      OT
    </span>
  );
}

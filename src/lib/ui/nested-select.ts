/** ตรวจว่า event มาจาก shadcn Select ที่ซ้อนใน Popover/Dialog หรือไม่ */
function isNestedSelectInteraction(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest('[data-slot="select-content"]') ||
      target.closest('[data-slot="select-trigger"]') ||
      target.closest('[data-slot="select-item"]') ||
      target.closest('[data-slot="select-scroll-up-button"]') ||
      target.closest('[data-slot="select-scroll-down-button"]'),
  );
}

/** กัน Popover/Dialog ปิดเมื่อโต้ตอบกับ Select ที่ portal ออกไปนอกกล่อง */
function keepOverlayOpenOnNestedSelect(event: Event): void {
  if (isNestedSelectInteraction(event.target)) {
    event.preventDefault();
  }
}

export { isNestedSelectInteraction, keepOverlayOpenOnNestedSelect };

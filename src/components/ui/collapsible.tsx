"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

/** ราก Collapsible จาก Radix */
const Collapsible = CollapsiblePrimitive.Root;

/** ปุ่มเปิด/ปิด Collapsible */
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

/** เนื้อหาที่ซ่อนได้ */
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };

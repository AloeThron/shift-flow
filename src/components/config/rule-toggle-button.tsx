"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toggleRuleInstanceAction } from "@/actions/config/rules";
import { Button } from "@/components/ui/button";

/** ปุ่มเปิด/ปิด rule instance */
export function RuleToggleButton({
  id,
  enabled,
  safetyLocked,
  canWrite,
}: {
  id: string;
  enabled: boolean;
  safetyLocked: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!canWrite || safetyLocked) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleRuleInstanceAction(id, !enabled);
          router.refresh();
        })
      }
    >
      {enabled ? "ปิดชั่วคราว" : "เปิดใช้งาน"}
    </Button>
  );
}

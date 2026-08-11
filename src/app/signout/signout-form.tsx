"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** ฟอร์มยืนยันออกจากระบบ — สไตล์เดียวกับหน้า login */
export default function SignOutForm() {
  const [pending, setPending] = useState(false);

  const onConfirm = async (): Promise<void> => {
    setPending(true);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>ออกจากระบบ</h1>
          </CardTitle>
          <CardDescription>ยืนยันการออกจากระบบ Shift-Flow</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button className="w-full" disabled={pending} type="button" onClick={onConfirm}>
            {pending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
          </Button>
          <Button asChild className="w-full" disabled={pending} variant="outline">
            <Link href="/">ยกเลิก</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEV_DEMO_PASSWORD } from "@/lib/auth/dev-demo-accounts";

import DevAccountTable from "./dev-account-table";

type LoginFormProps = {
  showDevAccounts: boolean;
};

/** ฟอร์ม login — invite-only */
export default function LoginForm({ showDevAccounts }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/schedule";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  /** login ด้วย credentials — ใช้ร่วมกันทั้งฟอร์มและ dev picker */
  const loginWithCredentials = async (
    nextUsername: string,
    nextPassword: string,
  ): Promise<void> => {
    setPending(true);
    setError(null);

    const result = await signIn("credentials", {
      username: nextUsername,
      password: nextPassword,
      redirect: false,
      callbackUrl,
    });

    setPending(false);
    setPendingUsername(null);

    if (result?.error) {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loginWithCredentials(username, password);
  };

  const onSelectDevAccount = async (nextUsername: string): Promise<void> => {
    setPendingUsername(nextUsername);
    setUsername(nextUsername);
    setPassword(DEV_DEMO_PASSWORD);
    await loginWithCredentials(nextUsername, DEV_DEMO_PASSWORD);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>เข้าสู่ระบบ</h1>
          </CardTitle>
          <CardDescription>บัญชีถูกสร้างโดยผู้ดูแลระบบเท่านั้น</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                autoComplete="username"
                id="username"
                name="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                autoComplete="current-password"
                id="password"
                name="password"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {showDevAccounts ? (
        <DevAccountTable
          disabled={pending}
          pendingUsername={pendingUsername}
          onSelect={onSelectDevAccount}
        />
      ) : null}
    </main>
  );
}

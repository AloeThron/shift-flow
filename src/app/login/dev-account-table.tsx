"use client";

import {
  DEV_DEMO_ACCOUNTS,
  DEV_DEMO_ROLE_LABELS,
  type DevDemoAccount,
} from "@/lib/auth/dev-demo-accounts";

type DevAccountTableProps = {
  disabled: boolean;
  onSelect: (username: string) => void;
  pendingUsername: string | null;
};

/** ตารางเลือกบัญชี demo — แสดงเฉพาะ local development */
export default function DevAccountTable({
  disabled,
  onSelect,
  pendingUsername,
}: DevAccountTableProps) {
  return (
    <section
      aria-label="บัญชีทดสอบ local"
      className="border-muted-foreground/40 bg-muted/30 mt-4 rounded-lg border border-dashed p-4"
    >
      <h2 className="text-sm font-medium">บัญชีทดสอบ (local เท่านั้น)</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        คลิกแถวเพื่อเข้าสู่ระบบด้วยบัญชี seed — ใช้ได้เฉพาะ development
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="pr-3 pb-2 font-medium">ชื่อ</th>
              <th className="pr-3 pb-2 font-medium">ชื่อผู้ใช้</th>
              <th className="pb-2 font-medium">บทบาท</th>
            </tr>
          </thead>
          <tbody>
            {DEV_DEMO_ACCOUNTS.map((account) => (
              <DevAccountRow
                account={account}
                disabled={disabled}
                key={account.username}
                pending={pendingUsername === account.username}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type DevAccountRowProps = {
  account: DevDemoAccount;
  disabled: boolean;
  pending: boolean;
  onSelect: (username: string) => void;
};

/** แถวบัญชี demo — คลิกเพื่อ login */
function DevAccountRow({ account, disabled, pending, onSelect }: DevAccountRowProps) {
  const isDisabled = disabled || pending;

  return (
    <tr
      className="hover:bg-muted/60 focus-within:bg-muted/60 cursor-pointer border-b last:border-b-0"
      tabIndex={isDisabled ? -1 : 0}
      onClick={() => {
        if (!isDisabled) {
          onSelect(account.username);
        }
      }}
      onKeyDown={(event) => {
        if (isDisabled) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(account.username);
        }
      }}
    >
      <td className="py-2 pr-3">{account.displayName}</td>
      <td className="py-2 pr-3 font-mono text-xs">{account.username}</td>
      <td className="py-2">
        {pending ? (
          <span className="text-muted-foreground text-xs">กำลังเข้าสู่ระบบ...</span>
        ) : (
          DEV_DEMO_ROLE_LABELS[account.role]
        )}
      </td>
    </tr>
  );
}

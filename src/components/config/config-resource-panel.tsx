"use client";

import { type ReactNode, useState } from "react";

import { configTableHeadClass } from "@/components/config/config-table-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfigPanelMode = { type: "idle" } | { type: "create" } | { type: "edit"; id: string };

export type ConfigPanelRowContext = {
  mode: ConfigPanelMode;
  openCreate: () => void;
  openEdit: (id: string) => void;
  isSelected: (id: string) => boolean;
  dialogOpen: boolean;
  canWrite: boolean;
};

type ConfigTableColumn = {
  id: string;
  label: string;
  width: string;
};

type ConfigResourcePanelProps = {
  canWrite: boolean;
  tableTitle: string;
  itemCount: number;
  createLabel: string;
  createTitle: string;
  minTableWidth?: string;
  editorVariant?: "card" | "dialog";
  columns?: readonly ConfigTableColumn[];
  tableHead?: ReactNode;
  renderRows: (ctx: ConfigPanelRowContext) => ReactNode;
  renderEditor: (mode: Exclude<ConfigPanelMode, { type: "idle" }>, close: () => void) => ReactNode;
  getEditTitle: (id: string) => string;
};

/** shell ตาราง + การ์ด/modal แก้ไขสำหรับหน้าตั้งค่า */
export function ConfigResourcePanel({
  canWrite,
  tableTitle,
  itemCount,
  createLabel,
  createTitle,
  minTableWidth = "640px",
  editorVariant = "card",
  columns,
  tableHead,
  renderRows,
  renderEditor,
  getEditTitle,
}: ConfigResourcePanelProps) {
  const [mode, setMode] = useState<ConfigPanelMode>({ type: "idle" });

  const close = () => setMode({ type: "idle" });
  const openCreate = () => setMode({ type: "create" });
  const openEdit = (id: string) => setMode({ type: "edit", id });
  const isSelected = (id: string) => mode.type === "edit" && mode.id === id;
  const dialogOpen = editorVariant === "dialog" && mode.type !== "idle";

  const ctx: ConfigPanelRowContext = {
    mode,
    openCreate,
    openEdit,
    isSelected,
    dialogOpen,
    canWrite,
  };

  const editorTitle =
    mode.type === "create"
      ? createTitle
      : mode.type === "edit"
        ? `แก้ไข: ${getEditTitle(mode.id)}`
        : null;

  const editorContent = mode.type !== "idle" ? renderEditor(mode, close) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">
            {tableTitle} ({itemCount})
          </CardTitle>
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              variant={mode.type === "create" && editorVariant === "card" ? "secondary" : "default"}
              disabled={dialogOpen}
              onClick={openCreate}
            >
              {createLabel}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table
            className={cn("w-full text-sm", columns && "table-fixed")}
            style={{ minWidth: minTableWidth }}
          >
            {columns ? (
              <colgroup>
                {columns.map((column) => (
                  <col key={column.id} style={{ width: column.width }} />
                ))}
              </colgroup>
            ) : null}
            <thead>
              <tr className="border-b">
                {columns
                  ? columns.map((column) => (
                      <th key={column.id} className={configTableHeadClass}>
                        {column.label}
                      </th>
                    ))
                  : tableHead}
              </tr>
            </thead>
            <tbody>{renderRows(ctx)}</tbody>
          </table>
        </CardContent>
      </Card>

      {editorVariant === "dialog" ? (
        <Dialog
          open={mode.type !== "idle"}
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <DialogContent className="max-h-[min(85vh,720px)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editorTitle}</DialogTitle>
            </DialogHeader>
            {editorContent}
          </DialogContent>
        </Dialog>
      ) : mode.type !== "idle" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">{editorTitle}</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              ยกเลิก
            </Button>
          </CardHeader>
          <CardContent>{editorContent}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** cell กลางตารางพร้อม wrapper จัดเนื้อหา */
export function ConfigTableCell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className={cn("px-2 py-2.5 text-center align-middle", className)}>
      <div className="flex flex-col items-center justify-center gap-1.5">{children}</div>
    </td>
  );
}

/** ปุ่มแก้ไข/ดูในแถวตาราง */
export function ConfigRowActionButton({
  canWrite,
  selected,
  disabled,
  onClick,
}: {
  canWrite: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "secondary" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {canWrite ? "แก้ไข" : "ดู"}
    </Button>
  );
}

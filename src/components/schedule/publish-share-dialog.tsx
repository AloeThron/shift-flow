"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { publishScheduleAction } from "@/actions/schedule/publish";
import {
  createShareLinkAction,
  listShareLinksAction,
  revokeShareLinkAction,
} from "@/actions/schedule/share";
import type { ScheduleAchievementStatus } from "@/components/schedule/canvas/schedule-achievement";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShareLinkView } from "@/lib/scheduling/load-share-links";

/** ข้อมูลรอบสำหรับ dialog เผยแพร่/แชร์ */
export type PublishShareDialogProps = {
  readonly cycleId: string;
  readonly draftId: string;
  readonly draftVersionId: string;
  readonly canPublish: boolean;
  readonly canShare: boolean;
  readonly achievement: ScheduleAchievementStatus;
  readonly publishedVersionId: string | null;
  readonly publishedVersionNumber: number | null;
  readonly initialShareLinks: readonly ShareLinkView[];
  readonly busy?: boolean;
};

/** แปลง ISO เป็นข้อความสั้น */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** เนื้อหาเผยแพร่และจัดการลิงก์แชร์ */
function PublishShareContent({
  cycleId,
  draftId,
  draftVersionId,
  canPublish,
  canShare,
  achievement,
  publishedVersionId: initialPublishedVersionId,
  publishedVersionNumber: initialPublishedVersionNumber,
  initialShareLinks,
}: Omit<PublishShareDialogProps, "busy">) {
  const router = useRouter();
  const publishReasonId = useId();
  const overrideReasonId = useId();
  const [pending, startTransition] = useTransition();
  const [shareLinks, setShareLinks] = useState<ShareLinkView[]>([...initialShareLinks]);
  const [latestShareUrl, setLatestShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishedVersionId, setPublishedVersionId] = useState(initialPublishedVersionId);
  const [publishedVersionNumber, setPublishedVersionNumber] = useState(
    initialPublishedVersionNumber,
  );

  const needsOverride = !achievement.passesHard;
  const canPublishNow = canPublish && (achievement.passesHard || overrideReason.trim().length > 0);

  const activeLinks = useMemo(() => shareLinks.filter((link) => link.isActive), [shareLinks]);

  const refreshLinks = () => {
    startTransition(async () => {
      const result = await listShareLinksAction(cycleId);
      if (result.ok) {
        setShareLinks(result.data);
      }
    });
  };

  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishScheduleAction({
        cycleId,
        draftId,
        draftVersionId,
        publishReason: publishReason.trim() || undefined,
        override:
          needsOverride && overrideReason.trim() ? { reason: overrideReason.trim() } : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPublishedVersionId(result.data.scheduleVersionId);
      setPublishedVersionNumber(result.data.versionNumber);
      setLatestShareUrl(result.data.shareUrl);
      refreshLinks();
      router.refresh();
    });
  };

  const handleCreateLink = () => {
    if (!publishedVersionId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createShareLinkAction({
        scheduleVersionId: publishedVersionId,
        expiresInDays: 90,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setLatestShareUrl(result.data.shareUrl);
      refreshLinks();
    });
  };

  const handleRevoke = (linkId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await revokeShareLinkAction({ linkId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refreshLinks();
    });
  };

  return (
    <div className="space-y-4">
      {publishedVersionNumber !== null ? (
        <p className="text-muted-foreground text-xs">
          เผยแพร่ล่าสุด: version {publishedVersionNumber}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">ยังไม่เคยเผยแพร่รอบนี้</p>
      )}

      {canPublish ? (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">เผยแพร่ draft ปัจจุบัน</p>
          {!achievement.isAchieved ? (
            <p className="text-destructive text-xs">
              ยังมี {achievement.remainingIssueCount} ปัญหา — hard violation ต้อง override
            </p>
          ) : (
            <p className="text-primary text-xs">พร้อมเผยแพร่</p>
          )}

          <div className="space-y-1">
            <Label htmlFor={publishReasonId}>เหตุผล (ไม่บังคับ)</Label>
            <Input
              id={publishReasonId}
              value={publishReason}
              onChange={(event) => setPublishReason(event.target.value)}
              placeholder="เช่น ตารางประจำเดือนส.ค."
              disabled={pending}
            />
          </div>

          {needsOverride ? (
            <div className="space-y-1">
              <Label htmlFor={overrideReasonId}>เหตุผล override (บังคับ)</Label>
              <Input
                id={overrideReasonId}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="อธิบายเหตุผลที่ยอมรับ hard violation"
                disabled={pending}
              />
            </div>
          ) : null}

          <Button
            type="button"
            size="sm"
            disabled={pending || !canPublishNow}
            onClick={handlePublish}
          >
            {pending ? "กำลังเผยแพร่…" : "เผยแพร่ตาราง"}
          </Button>
        </div>
      ) : null}

      {canShare && latestShareUrl ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">ลิงก์แชร์ (แสดงครั้งเดียว)</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted max-w-full truncate rounded px-2 py-1 text-xs">
              {latestShareUrl}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(latestShareUrl)}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </Button>
          </div>
        </div>
      ) : null}

      {canShare ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">ลิงก์แชร์ที่มีอยู่</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !publishedVersionId}
              onClick={handleCreateLink}
            >
              <Link2 className="size-4" aria-hidden />
              สร้างลิงก์ใหม่
            </Button>
          </div>

          {shareLinks.length === 0 ? (
            <p className="text-muted-foreground text-xs">ยังไม่มีลิงก์แชร์</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Version</th>
                    <th className="py-2 pr-2">สร้างเมื่อ</th>
                    <th className="py-2 pr-2">หมดอายุ</th>
                    <th className="py-2 pr-2">สถานะ</th>
                    <th className="py-2 pr-2">เข้าชม</th>
                    <th className="py-2">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {shareLinks.map((link) => (
                    <tr key={link.id} className="border-b">
                      <td className="py-2 pr-2">v{link.versionNumber}</td>
                      <td className="py-2 pr-2">{formatDateTime(link.createdAt)}</td>
                      <td className="py-2 pr-2">{formatDateTime(link.expiresAt)}</td>
                      <td className="py-2 pr-2">
                        {link.revokedAt ? "เพิกถอนแล้ว" : link.isActive ? "ใช้งานได้" : "หมดอายุ"}
                      </td>
                      <td className="py-2 pr-2">{link.viewCount}</td>
                      <td className="py-2">
                        {link.isActive ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={pending}
                            onClick={() => handleRevoke(link.id)}
                          >
                            เพิกถอน
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeLinks.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              ลิงก์ที่ใช้งานได้ {activeLinks.length} รายการ — token แสดงครั้งเดียวตอนสร้าง
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

/** Dialog เผยแพร่และจัดการลิงก์แชร์ — trigger ใน toolbar */
export function PublishShareDialog({
  busy = false,
  ...contentProps
}: PublishShareDialogProps) {
  const { canPublish, canShare } = contentProps;

  if (!canPublish && !canShare) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={busy}>
          <Share2 aria-hidden />
          เผยแพร่และแชร์
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4" aria-hidden />
            เผยแพร่และแชร์ตาราง
          </DialogTitle>
        </DialogHeader>
        <PublishShareContent {...contentProps} />
      </DialogContent>
    </Dialog>
  );
}

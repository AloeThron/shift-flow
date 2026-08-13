import { notFound } from "next/navigation";

import { PublishedRosterGrid } from "@/components/share/published-roster-grid";
import { loadPublishedShareView } from "@/lib/scheduling/load-published-share-view";

/** หน้า share สาธารณะ — อ่านตารางเวรด้วย token */
export default async function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grid = await loadPublishedShareView(token);

  if (!grid) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">{grid.schedule.cycleName}</h1>
        <p className="text-muted-foreground text-sm">
          {grid.schedule.periodStart} ถึง {grid.schedule.periodEnd}
          {grid.schedule.publishedAt
            ? ` · เผยแพร่ ${new Date(grid.schedule.publishedAt).toLocaleString("th-TH")}`
            : null}
        </p>
        <p className="text-muted-foreground text-xs">ตารางเวรแบบอ่านอย่างเดียว — ไม่ต้องเข้าสู่ระบบ</p>
      </header>
      <PublishedRosterGrid grid={grid} />
    </div>
  );
}

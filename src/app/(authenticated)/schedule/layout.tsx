import { PageContainer } from "@/components/layout/page-container";

/** layout หน้า schedule — กว้างกว่า workflow mobile */
export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer maxWidth="6xl" className="min-h-[calc(100vh-57px)]">
      <div className="space-y-6 px-4 py-4">{children}</div>
    </PageContainer>
  );
}

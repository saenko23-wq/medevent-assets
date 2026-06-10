import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { createReport } from "@/lib/actions";
import { dateUa, operationStatusLabels, operationTypeLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, events, users] = await Promise.all([
    prisma.operationTask.findMany({
      where: { type: { in: ["client_report", "client_report_6m", "client_report_12m", "analytics", "doclink", "event_page", "mailing", "moz_registration"] } },
      include: { event: true },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }]
    }),
    prisma.event.findMany({ orderBy: { startDate: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Звіти" subtitle="Дедлайни, статус готовності та відповідальні." />
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Задача</th><th>Тип</th><th>Захід</th><th>Дедлайн</th><th>Відповідальний</th><th>Статус</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{report.title}</td>
                    <td>{operationTypeLabels[report.type]}</td>
                    <td>{report.event.title}</td>
                    <td>{report.deadline ? dateUa(report.deadline) : "—"}</td>
                    <td>{report.assignee ?? "—"}</td>
                    <td><StatusBadge value={report.status} label={operationStatusLabels[report.status]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <EditorOnly>
        <form action={createReport} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Новий звіт</h2></div>
          <div className="space-y-4">
            <div className="space-y-1.5"><label>Назва</label><input name="title" required /></div>
            <div className="space-y-1.5"><label>Захід</label><select name="eventId">{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
            <div className="space-y-1.5"><label>Дедлайн</label><input name="deadline" type="date" required /></div>
            <div className="space-y-1.5"><label>Відповідальний</label><select name="assigneeId">{users.map((user) => <option key={user.id} value={user.id}>{user.name ?? user.email}</option>)}</select></div>
            <div className="space-y-1.5"><label>Статус</label><select name="status"><option value="not_started">Не розпочато</option><option value="ready">Готово</option></select></div>
            <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати звіт</button>
          </div>
        </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

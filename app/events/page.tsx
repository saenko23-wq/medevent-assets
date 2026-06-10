import { Plus } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { createEvent } from "@/lib/actions";
import { dateUa, eventFormatLabels, eventStatusLabels, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    include: { eventSpeakers: { include: { speaker: true } }, deals: true },
    orderBy: { startDate: "asc" }
  });

  return (
    <AppShell>
      <PageHeader title="Заходи" subtitle="Назви, дати, формат, бюджети та поточний статус." />
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Захід</th>
                  <th>Дати</th>
                  <th>Формат</th>
                  <th>План бюджет</th>
                  <th>Факт бюджет</th>
                  <th>Статус</th>
                  <th>Спікери</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <Link href={`/events/${event.id}`} className="font-medium text-brand-dark hover:underline">
                        {event.title}
                      </Link>
                      {event.eventCode ? <p className="text-xs text-slate-500">{event.eventCode}</p> : null}
                    </td>
                    <td>{dateUa(event.startDate)} - {dateUa(event.endDate)}</td>
                    <td>{eventFormatLabels[event.format]}</td>
                    <td>{money(event.plannedBudget)}</td>
                    <td>{money(event.actualBudget)}</td>
                    <td><StatusBadge value={event.status} label={eventStatusLabels[event.status]} /></td>
                    <td>{event.eventSpeakers.map((item) => item.speaker.fullName).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <EditorOnly>
        <form action={createEvent} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Новий захід</h2></div>
          <div className="space-y-4">
            <div className="space-y-1.5"><label>Назва</label><input name="title" required /></div>
            <div className="space-y-1.5"><label>Event ID</label><input name="eventCode" placeholder="ПН-01" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label>Початок</label><input name="startDate" type="date" required /></div>
              <div className="space-y-1.5"><label>Кінець</label><input name="endDate" type="date" required /></div>
            </div>
            <div className="space-y-1.5"><label>Деталі формату</label><input name="formatDetails" placeholder="2 дні | 14 год | 10 БПР" /></div>
            <div className="space-y-1.5"><label>Сторінка заходу</label><input name="pageUrl" type="url" /></div>
            <div className="space-y-1.5"><label>Формат</label><select name="format" defaultValue="hybrid"><option value="offline">Офлайн</option><option value="online">Онлайн</option><option value="hybrid">Гібрид</option></select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label>План</label><input name="plannedBudget" type="number" min="0" required /></div>
              <div className="space-y-1.5"><label>Факт</label><input name="actualBudget" type="number" min="0" defaultValue="0" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label>Середній чек</label><input name="averageCheck" type="number" min="0" defaultValue="0" /></div>
              <div className="space-y-1.5"><label>Гонорари</label><input name="totalSpeakerHonorarium" type="number" min="0" defaultValue="0" /></div>
            </div>
            <div className="space-y-1.5"><label>Статус</label><select name="status" defaultValue="planning"><option value="draft">Чернетка</option><option value="planning">Планування</option><option value="active">Активний</option><option value="completed">Завершено</option><option value="cancelled">Скасовано</option></select></div>
            <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати захід</button>
          </div>
        </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

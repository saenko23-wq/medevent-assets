import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { createDeal } from "@/lib/actions";
import { dealStatusLabels, money, paymentStatusLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, clients, events] = await Promise.all([
    prisma.deal.findMany({ include: { client: true, event: true }, orderBy: { createdAt: "desc" } }),
    prisma.client.findMany({ orderBy: { company: "asc" } }),
    prisma.event.findMany({ orderBy: { startDate: "asc" } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Угоди" subtitle="Клієнт, захід, пакет, сума та оплата." />
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Клієнт</th><th>Захід</th><th>Пакет</th><th>Сума</th><th>Угода</th><th>Оплата</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{deal.client.company}</td>
                    <td>{deal.event.title}</td>
                    <td>{deal.package}</td>
                    <td>{money(deal.amount)}</td>
                    <td><StatusBadge value={deal.status} label={dealStatusLabels[deal.status]} /></td>
                    <td><StatusBadge value={deal.paymentStatus} label={paymentStatusLabels[deal.paymentStatus]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <EditorOnly>
        <form action={createDeal} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Нова угода</h2></div>
          <div className="space-y-4">
            <div className="space-y-1.5"><label>Клієнт</label><select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company}</option>)}</select></div>
            <div className="space-y-1.5"><label>Захід</label><select name="eventId" required>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
            <div className="space-y-1.5"><label>Пакет</label><select name="package" defaultValue="Standart"><option>Standart</option><option>Plus</option><option>Mono</option><option>Combo</option></select></div>
            <div className="space-y-1.5"><label>Сума</label><input name="amount" type="number" min="0" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label>Статус</label><select name="status"><option value="lead">Лід</option><option value="proposal">Пропозиція</option><option value="won">Виграно</option><option value="lost">Втрачено</option></select></div>
              <div className="space-y-1.5"><label>Оплата</label><select name="paymentStatus"><option value="waiting">Очікуємо</option><option value="can_request">Можна просити</option><option value="paid">Оплачено</option><option value="overdue">Прострочено</option></select></div>
            </div>
            <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати угоду</button>
          </div>
        </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

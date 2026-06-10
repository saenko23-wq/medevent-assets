import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/actions";
import { dateUa, money, paymentStatusLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [payments, deals] = await Promise.all([
    prisma.payment.findMany({
      include: { deal: { include: { client: true, event: true } } },
      orderBy: { dueDate: "asc" }
    }),
    prisma.deal.findMany({ include: { client: true, event: true }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Оплати" subtitle="Статуси оплат, строки та фактичні надходження." />
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Клієнт</th><th>Захід</th><th>Сума</th><th>Факт</th><th>Дедлайн</th><th>Оплачено</th><th>Статус</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{payment.deal.client.company}</td>
                    <td>{payment.deal.event.title}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{money(payment.actualPaid)}</td>
                    <td>{dateUa(payment.dueDate)}</td>
                    <td>{payment.paidAt ? dateUa(payment.paidAt) : "—"}</td>
                    <td><StatusBadge value={payment.status} label={paymentStatusLabels[payment.status]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <EditorOnly>
        <form action={createPayment} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Нова оплата</h2></div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label>Угода</label>
              <select name="dealId">
                {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.client.company} - {deal.event.title}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><label>Статус</label><select name="status"><option value="waiting">Очікуємо</option><option value="can_request">Можна просити</option><option value="paid">Оплачено</option><option value="overdue">Прострочено</option></select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label>Сума</label><input name="amount" type="number" min="0" required /></div>
              <div className="space-y-1.5"><label>Факт</label><input name="actualPaid" type="number" min="0" defaultValue="0" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label>Дедлайн</label><input name="dueDate" type="date" required /></div>
              <div className="space-y-1.5"><label>Факт оплати</label><input name="paidAt" type="date" /></div>
            </div>
            <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати оплату</button>
          </div>
        </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

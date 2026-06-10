import { AlertTriangle, BadgeDollarSign, CalendarClock, Handshake, TrendingUp, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { dateUa, dealStatusLabels, money, operationStatusLabels, operationTypeLabels, paymentStatusLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [deals, clients, tasks, payments] = await Promise.all([
    prisma.deal.findMany({ include: { client: true, event: true } }),
    prisma.client.findMany({ include: { deals: true } }),
    prisma.operationTask.findMany({
      where: { status: { not: "ready" } },
      include: { event: true },
      orderBy: { deadline: "asc" },
      take: 5
    }),
    prisma.payment.findMany({
      where: { status: { in: ["overdue", "can_request", "waiting"] } },
      include: { deal: { include: { client: true } } },
      orderBy: { dueDate: "asc" },
      take: 5
    })
  ]);

  const salesPlan = deals.reduce((sum, deal) => sum + Number(deal.amount), 0);
  const salesFact = deals.filter((deal) => deal.status === "won").reduce((sum, deal) => sum + Number(deal.amount), 0);
  const pipeline = deals.filter((deal) => ["lead", "proposal"].includes(deal.status)).reduce((sum, deal) => sum + Number(deal.amount), 0);
  const paid = deals.filter((deal) => deal.paymentStatus === "paid").reduce((sum, deal) => sum + Number(deal.amount), 0);

  const topClients = clients
    .map((client) => ({
      id: client.id,
      company: client.company,
      amount: client.deals.reduce((sum, deal) => sum + Number(deal.amount), 0)
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <AppShell>
      <PageHeader title="Дашборд" subtitle="План/факт продажів, pipeline, топ клієнти й дедлайни що горять." />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="План продажів" value={money(salesPlan)} note="Сума всіх активних угод" icon={<TrendingUp size={21} />} />
        <MetricCard title="Факт продажів" value={money(salesFact)} note={`${Math.round((salesFact / Math.max(salesPlan, 1)) * 100)}% від плану`} icon={<BadgeDollarSign size={21} />} />
        <MetricCard title="Pipeline" value={money(pipeline)} note="Ліди та пропозиції в роботі" icon={<Handshake size={21} />} />
        <MetricCard title="Оплачено" value={money(paid)} note="Угоди зі статусом оплати" icon={<UsersRound size={21} />} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-950">Топ клієнти</h2>
          <div className="space-y-3">
            {topClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <span className="text-sm font-medium text-slate-800">{client.company}</span>
                <span className="text-sm font-semibold text-brand-dark">{money(client.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="text-brand" size={19} />
            <h2 className="text-base font-semibold text-slate-950">Дедлайни звітів</h2>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-md border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-900">{task.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {task.event.title} · {task.deadline ? dateUa(task.deadline) : "без дати"} · {task.assignee ?? "без відповідального"} · {operationTypeLabels[task.type]}
                </p>
                <div className="mt-2">
                  <StatusBadge value={task.status} label={operationStatusLabels[task.status]} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={19} />
            <h2 className="text-base font-semibold text-slate-950">Оплати в увазі</h2>
          </div>
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-md border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-900">{payment.deal.client.company}</p>
                <p className="mt-1 text-xs text-slate-500">{money(payment.amount)} · до {dateUa(payment.dueDate)}</p>
                <div className="mt-2">
                  <StatusBadge value={payment.status} label={paymentStatusLabels[payment.status]} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-950">Pipeline угод</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3">Клієнт</th>
                <th>Захід</th>
                <th>Пакет</th>
                <th>Сума</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td className="py-3 font-medium text-slate-900">{deal.client.company}</td>
                  <td>{deal.event.title}</td>
                  <td>{deal.package}</td>
                  <td>{money(deal.amount)}</td>
                  <td><StatusBadge value={deal.status} label={dealStatusLabels[deal.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

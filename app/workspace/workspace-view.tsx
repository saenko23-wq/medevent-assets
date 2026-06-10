import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { dateUa, money, operationStatusLabels, paymentStatusLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const tabs = [
  ["/workspace/sales", "Sales"],
  ["/workspace/project", "Project"],
  ["/workspace/docs", "Docs"],
  ["/workspace/finance", "Finance"],
  ["/workspace/reports", "Reports"],
  ["/workspace/deadlines", "Deadlines"]
];

export async function WorkspaceView({ type }: { type: "sales" | "project" | "docs" | "finance" | "reports" | "deadlines" }) {
  const [tasks, deals, payments] = await Promise.all([
    prisma.operationTask.findMany({
      where: taskWhere(type),
      include: { event: true, slot: { include: { client: true } } },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
      take: 120
    }),
    prisma.deal.findMany({
      where: type === "sales" ? { archived: false, status: { in: ["lead", "proposal"] } } : { archived: false },
      include: { client: true, event: true },
      orderBy: { updatedAt: "desc" },
      take: 80
    }),
    prisma.payment.findMany({
      where: type === "finance" ? { status: { in: ["waiting", "overdue", "can_request"] } } : {},
      include: { deal: { include: { client: true, event: true } } },
      orderBy: { dueDate: "asc" },
      take: 80
    })
  ]);

  return (
    <AppShell>
      <PageHeader title={`${label(type)} workspace`} subtitle="Рольовий view по тим самим задачам, участям, угодам і оплатам." />
      <nav className="mb-6 flex gap-2 overflow-x-auto">
        {tabs.map(([href, tabLabel]) => (
          <Link key={href} href={href} className={href.endsWith(type) ? "rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white" : "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"}>
            {tabLabel}
          </Link>
        ))}
      </nav>

      {type === "finance" ? (
        <Panel title="Expected / overdue payments">
          <Rows headers={["Компанія", "Захід", "Сума", "Факт", "Дедлайн", "Статус"]} rows={payments.map((payment) => [
            payment.deal.client.company,
            payment.deal.event.title,
            money(payment.amount),
            money(payment.actualPaid),
            dateUa(payment.dueDate),
            paymentStatusLabels[payment.status] ?? payment.status
          ])} />
        </Panel>
      ) : null}

      {type === "sales" ? (
        <Panel title="My partners / active pipeline">
          <Rows headers={["Компанія", "Захід", "Пакет", "Сума", "Продакт", "Наступний крок"]} rows={deals.map((deal) => [
            deal.client.company,
            deal.event.title,
            deal.package,
            money(deal.factAmount || deal.amount),
            deal.productManager ?? "—",
            deal.comment ?? "—"
          ])} />
        </Panel>
      ) : null}

      <Panel title={type === "deadlines" ? "Deadline hub" : "Tasks"}>
        <Rows headers={["Захід", "Компанія", "Process", "Task", "Deadline", "State", "Status", "Owner", "Next step"]} rows={tasks.map((task) => [
          task.event.title,
          task.slot?.client?.company ?? "MedEvent",
          task.process,
          task.title,
          task.deadline ? dateUa(task.deadline) : "—",
          task.deadlineState,
          operationStatusLabels[task.status] ?? task.status,
          task.ownerRole ?? task.assignee ?? "—",
          task.nextStep ?? "—"
        ])} />
      </Panel>
    </AppShell>
  );
}

function taskWhere(type: string) {
  if (type === "project") return { process: "project", status: { notIn: ["done", "cancelled"] } };
  if (type === "docs") return { process: "docs", status: { notIn: ["done", "cancelled"] } };
  if (type === "reports") return { process: "reports", status: { notIn: ["done", "cancelled"] } };
  if (type === "sales") return { process: "sales", status: { notIn: ["done", "cancelled"] } };
  if (type === "deadlines") return { deadlineState: { in: ["overdue", "today", "soon"] }, status: { notIn: ["done", "cancelled"] } };
  return {};
}

function label(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-slate-950">{title}</h2>{children}</section>;
}

function Rows({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr>{headers.map((header) => <th key={header} className="py-3 pr-4">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="py-3 pr-4">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

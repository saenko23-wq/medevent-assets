import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { createEventSlot, createOperationTask } from "@/lib/actions";
import { dateUa, deadlineStateFor, deadlineStateLabels, eventStatusLabels, money, operationStatusLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

const tabs = [
  ["overview", "Overview"],
  ["partners", "Partners & Sales"],
  ["program", "Program & Speakers"],
  ["tasks", "Package Tasks"],
  ["documents", "Documents"],
  ["finance", "Finance"],
  ["reports", "Reports"],
  ["activity", "Activity"]
];

export default async function EventDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const activeTab = searchParams.tab ?? "overview";
  const [event, clients, references] = await Promise.all([
    prisma.event.findUnique({
      where: { id: params.id },
      include: {
        slots: { include: { client: true, tasks: true }, orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }] },
        tasks: { orderBy: [{ deadline: "asc" }, { createdAt: "asc" }] },
        documents: { orderBy: { createdAt: "asc" } },
        deals: { include: { client: true, payments: true } }
      }
    }),
    prisma.client.findMany({ orderBy: { company: "asc" } }),
    prisma.referenceCategory.findMany({ include: { items: { where: { isActive: true }, orderBy: { value: "asc" } } } })
  ]);

  if (!event) notFound();

  const ref = new Map(references.map((category) => [category.name, category.items.map((item) => item.value)]));
  const partnerSlots = event.slots.filter((slot) => slot.rowTypeNormalized === "PARTNER");
  const medeventSlots = event.slots.filter((slot) => slot.rowTypeNormalized === "MEDEVENT_PROGRAM");
  const confirmed = event.deals.filter((deal) => deal.status === "won").reduce((sum, deal) => sum + Number(deal.factAmount || deal.amount), 0);
  const pipeline = event.deals.filter((deal) => ["lead", "proposal"].includes(deal.status)).reduce((sum, deal) => sum + Number(deal.factAmount || deal.amount), 0);
  const paid = event.deals.reduce((sum, deal) => sum + Number(deal.paidAmount || 0), 0);
  const debt = Math.max(confirmed + pipeline - paid, 0);
  const overdueTasks = event.tasks.filter((task) => deadlineStateFor(task.deadline, task.status) === "overdue").length;
  const todayTasks = event.tasks.filter((task) => deadlineStateFor(task.deadline, task.status) === "today").length;
  const waitingClientTasks = event.tasks.filter((task) => task.status === "waiting_client").length;
  const missingInputs = partnerSlots.filter((slot) => slot.missingInputs).length;

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand">
          <ArrowLeft size={16} />
          До всіх заходів
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-dark">{event.eventCode ?? "Без Event ID"}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{event.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {dateUa(event.startDate)} - {dateUa(event.endDate)} · {event.deliveryFormat} · {event.therapeuticDirection || event.formatDetails || "напрям не вказано"}
            </p>
          </div>
          <StatusBadge value={event.status} label={eventStatusLabels[event.status] ?? event.status} />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="План" value={money(event.plannedBudget)} href="?tab=partners" />
          <Kpi label="Факт" value={money(confirmed)} href="?tab=partners" />
          <Kpi label="Pipeline" value={money(pipeline)} href="?tab=partners" />
          <Kpi label="Оплачено" value={money(paid)} href="?tab=finance" />
          <Kpi label="Борг" value={money(debt)} href="?tab=finance" />
          <Kpi label="Overdue tasks" value={String(overdueTasks)} href="?tab=tasks" danger={overdueTasks > 0} />
          <Kpi label="PARTNER rows" value={String(partnerSlots.length)} href="?tab=partners" />
          <Kpi label="MEDEVENT rows" value={String(medeventSlots.length)} href="?tab=program" />
          <Kpi label="Усього програми" value={String(event.slots.length)} href="?tab=program" />
          <Kpi label="Сьогодні" value={String(todayTasks)} href="?tab=tasks" />
          <Kpi label="Waiting client" value={String(waitingClientTasks)} href="?tab=tasks" />
          <Kpi label="Missing input" value={String(missingInputs)} href="?tab=partners" danger={missingInputs > 0} />
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto border-t border-slate-100 pt-4">
          {tabs.map(([key, label]) => (
            <Link key={key} href={`/events/${event.id}?tab=${key}`} className={activeTab === key ? "rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white" : "rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand"}>
              {label}
            </Link>
          ))}
        </nav>
      </section>

      {activeTab === "overview" ? <Overview event={event} partnerSlots={partnerSlots} medeventSlots={medeventSlots} /> : null}
      {activeTab === "partners" ? <Partners event={event} slots={partnerSlots} clients={clients} ref={ref} /> : null}
      {activeTab === "program" ? <Program slots={event.slots} /> : null}
      {activeTab === "tasks" ? <Tasks event={event} /> : null}
      {activeTab === "documents" ? <Documents event={event} /> : null}
      {activeTab === "finance" ? <Finance event={event} /> : null}
      {activeTab === "reports" ? <Reports event={event} /> : null}
      {activeTab === "activity" ? <Activity event={event} /> : null}
    </AppShell>
  );
}

function Kpi({ label, value, href, danger }: { label: string; value: string; href: string; danger?: boolean }) {
  return (
    <Link href={href} className="rounded-md border border-slate-200 bg-slate-50 p-3 hover:border-brand hover:bg-brand-soft">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={danger ? "mt-1 font-semibold text-red-600" : "mt-1 font-semibold text-slate-950"}>{value}</p>
    </Link>
  );
}

function Overview({ event, partnerSlots, medeventSlots }: any) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <h2 className="font-semibold text-slate-950">Event Workspace</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Info label="Delivery format" value={event.deliveryFormat} />
          <Info label="Therapeutic direction" value={event.therapeuticDirection || "—"} />
          <Info label="BPR points" value={event.bprPoints ? String(event.bprPoints) : "—"} />
          <Info label="Project manager" value={event.projectManager || "—"} />
          <Info label="Partner rows" value={String(partnerSlots.length)} />
          <Info label="MedEvent program rows" value={String(medeventSlots.length)} />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-950">Links</h2>
        <External href={event.pageUrl} label="Сторінка заходу" />
        <External href={event.programDraftUrl} label="Драфт програми" />
        <External href={event.youtubeDay1Url} label="Трансляція День 1" />
        <External href={event.youtubeDay2Url} label="Трансляція День 2" />
      </div>
    </section>
  );
}

function Partners({ event, slots, clients, ref }: any) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]">
      <DataTable
        title="Partners & Sales"
        headers={["Компанія", "Продакт", "Менеджер", "Статус", "Пакет", "Сума", "Спікер", "Тема", "Бренд", "Mode", "Missing"]}
        rows={slots.map((slot: any) => [
          slot.client?.company ?? "—",
          slot.productManager ?? "—",
          slot.manager ?? "—",
          slot.salesStatus,
          slot.package,
          slot.price ? money(slot.price) : "—",
          slot.speakerName ?? "—",
          slot.talkTitle ?? "—",
          slot.brandTopic ?? "—",
          slot.speakerParticipationMode ?? "—",
          slot.missingInputs ? "Missing input" : "OK"
        ])}
      />
      <NewSlotForm event={event} clients={clients} ref={ref} />
    </section>
  );
}

function Program({ slots }: any) {
  return (
    <section className="mt-6">
      <DataTable
        title="Program & Speakers"
        headers={["Тип", "Компанія", "Спікер", "Модератор", "Тема", "Тривалість", "Mode", "Topic status", "Presentation", "Project comment"]}
        rows={slots.map((slot: any) => [
          slot.rowTypeNormalized,
          slot.client?.company ?? "MedEvent",
          slot.speakerName ?? "—",
          slot.moderatorName ?? "—",
          slot.talkTitle ?? "—",
          slot.duration ?? "—",
          slot.speakerParticipationMode ?? "—",
          slot.talkTitle ? "topic_present" : "missing_topic",
          slot.documentsSent ? "received" : "not_received",
          slot.programComment ?? slot.managerComment ?? "—"
        ])}
      />
    </section>
  );
}

function Tasks({ event }: any) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
      <DataTable
        title="Package Tasks"
        headers={["Process", "Group", "Task", "Deadline", "State", "Status", "Owner role", "Next step", "Comment", "Source"]}
        rows={event.tasks.map((task: any) => [
          task.process,
          task.group ?? "—",
          task.title,
          task.deadline ? dateUa(task.deadline) : "—",
          deadlineStateLabels[deadlineStateFor(task.deadline, task.status)],
          task.status,
          task.ownerRole ?? task.assignee ?? "—",
          task.nextStep ?? "—",
          task.comment ?? "—",
          task.source
        ])}
      />
      <EditorOnly>
        <form action={createOperationTask} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="eventId" value={event.id} />
          <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Manual task</h2></div>
          <div className="grid gap-3">
            <input name="title" placeholder="Назва задачі" required />
            <select name="type"><option value="custom">Custom</option><option value="documents">Documents</option><option value="client_report">Report</option></select>
            <input name="deadline" type="date" />
            <input name="assignee" placeholder="Відповідальний" />
            <select name="status"><option value="not_started">not_started</option><option value="in_progress">in_progress</option><option value="waiting_client">waiting_client</option><option value="done">done</option></select>
            <textarea name="comment" rows={3} placeholder="Коментар" />
            <button className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати задачу</button>
          </div>
        </form>
      </EditorOnly>
    </section>
  );
}

function Documents({ event }: any) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-slate-950">Documents</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {event.documents.map((document: any) => (
          <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 p-3 text-sm hover:border-brand hover:bg-brand-soft">
            <p className="font-medium text-slate-950">{document.title}</p>
            <p className="mt-1 text-xs text-slate-500">{document.type}{document.owner ? ` · ${document.owner}` : ""}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function Finance({ event }: any) {
  const payments = event.deals.flatMap((deal: any) => deal.payments.map((payment: any) => ({ deal, payment })));
  return (
    <section className="mt-6">
      <DataTable
        title="Finance"
        headers={["Компанія", "Пакет", "Очікується", "Оплачено", "Борг", "Дедлайн", "Статус"]}
        rows={event.deals.map((deal: any) => {
          const paid = Number(deal.paidAmount || 0) || deal.payments.reduce((sum: number, payment: any) => sum + Number(payment.actualPaid || 0), 0);
          const expected = Number(deal.factAmount || deal.amount || 0);
          return [deal.client.company, deal.package, money(expected), money(paid), money(Math.max(expected - paid, 0)), deal.paymentDeadline ? dateUa(deal.paymentDeadline) : payments.find((item: any) => item.deal.id === deal.id)?.payment.dueDate ? dateUa(payments.find((item: any) => item.deal.id === deal.id).payment.dueDate) : "—", deal.paymentStatus];
        })}
      />
    </section>
  );
}

function Reports({ event }: any) {
  return (
    <section className="mt-6">
      <DataTable
        title="Reports"
        headers={["Task", "Deadline", "Status", "Owner", "Comment"]}
        rows={event.tasks.filter((task: any) => task.process === "reports").map((task: any) => [task.title, task.deadline ? dateUa(task.deadline) : "—", task.status, task.ownerRole ?? task.assignee ?? "—", task.comment ?? "—"])}
      />
    </section>
  );
}

function Activity({ event }: any) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">Activity / Comments</h2>
      <div className="mt-4 space-y-3">
        {event.slots.filter((slot: any) => slot.programComment || slot.managerComment).map((slot: any) => (
          <div key={slot.id} className="rounded-md border border-slate-100 p-3 text-sm">
            <p className="font-medium text-slate-900">{slot.client?.company ?? "MedEvent"} · {slot.speakerName ?? "без спікера"}</p>
            <p className="mt-1 text-slate-600">{slot.programComment || slot.managerComment}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NewSlotForm({ event, clients, ref }: any) {
  return (
    <EditorOnly>
      <form action={createEventSlot} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="eventId" value={event.id} />
        <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Нова участь</h2></div>
        <div className="grid gap-3">
          <div className="space-y-1.5"><label>Row type</label><select name="rowType"><option value="PARTNER">PARTNER</option><option value="MEDEVENT_PROGRAM">MEDEVENT_PROGRAM</option></select></div>
          <div className="space-y-1.5"><label>Компанія</label><select name="clientId"><option value="">MedEvent / без компанії</option>{clients.map((client: any) => <option key={client.id} value={client.id}>{client.company}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <input name="productManager" placeholder="Продакт" />
            <FieldSelect name="manager" values={ref.get("Менеджери") ?? []} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect name="salesStatus" values={ref.get("Статуси продажу") ?? []} />
            <FieldSelect name="package" values={ref.get("Пакети") ?? ["Standart", "Plus", "Mono", "Combo"]} />
          </div>
          <input name="price" placeholder="Сума" />
          <input name="speakerName" placeholder="Спікер" />
          <select name="speakerParticipationMode"><option value="LIVE_ONLINE">LIVE_ONLINE</option><option value="LIVE_OFFLINE">LIVE_OFFLINE</option><option value="RECORDED">RECORDED</option><option value="STUDIO_RECORDING">STUDIO_RECORDING</option></select>
          <textarea name="talkTitle" rows={3} placeholder="Тема" />
          <input name="brandTopic" placeholder="Препарат / бренд" />
          <textarea name="programComment" rows={2} placeholder="Коментар проєкту" />
          <button className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати участь</button>
        </div>
      </form>
    </EditorOnly>
  );
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-950">{title}</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index} className="align-top">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>;
}

function External({ href, label }: { href?: string | null; label: string }) {
  if (!href) return <div className="mb-2 rounded-md border border-slate-200 p-3 text-sm text-slate-400">{label}</div>;
  return <a href={href} target="_blank" rel="noreferrer" className="mb-2 flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand">{label}<ExternalLink size={15} /></a>;
}

function FieldSelect({ name, values }: { name: string; values: string[] }) {
  return <select name={name}>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select>;
}

import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Handshake,
  Percent,
  TrendingDown,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { updateDealFromDashboard } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { dateUa, dealStatusLabels, money, paymentStatusLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

const months = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень"
];

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = normalizeFilters(searchParams);

  const [allDeals, clients, events] = await Promise.all([
    prisma.deal.findMany({
      where: { archived: false },
      include: {
        client: { include: { productManagers: true } },
        event: true,
        payments: true
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.client.findMany({ include: { productManagers: true }, orderBy: { company: "asc" } }),
    prisma.event.findMany({ orderBy: { startDate: "asc" } })
  ]);

  const commercialDealIds = await commercialDealsForDashboard();
  const filteredDeals = allDeals.filter((deal) => commercialDealIds.has(deal.id) && matchesFilters(deal, filters));
  const source = buildRows(filteredDeals);
  const allRows = buildRows(allDeals.filter((deal) => commercialDealIds.has(deal.id)));

  const plan = sum(source, "plan");
  const fact = sum(source, "fact");
  const paid = sum(source, "paid");
  const pipeline = source.filter((row) => ["lead", "proposal"].includes(row.status)).reduce((total, row) => total + row.fact, 0);
  const receivable = source.reduce((total, row) => total + Math.max(row.fact - row.paid, 0), 0);
  const percent = plan ? Math.round((fact / plan) * 100) : 0;
  const variance = fact - plan;

  const uniqueCompanies = new Set(source.map((row) => row.clientId)).size;
  const uniqueProductManagers = new Set(source.map((row) => row.productManager).filter(Boolean)).size;
  const uniqueEvents = new Set(source.map((row) => row.eventId)).size;

  const years = Array.from(new Set(allRows.map((row) => row.year).filter(Boolean))).sort();
  const managers = Array.from(new Set(allRows.map((row) => row.manager).filter(Boolean))).sort();
  const productManagers = Array.from(new Set(allRows.map((row) => row.productManager).filter(Boolean))).sort();

  const byMonth = aggregate(source, (row) => `${row.monthNumber}|${row.month}`, { limit: 12, sortByKey: true });
  const byEvent = aggregate(source, (row) => row.event, { limit: 8 });
  const byCompany = aggregate(source, (row) => row.company, { limit: 8 });
  const byManager = aggregate(source, (row) => row.manager || "Без менеджера", { limit: 8 });
  const byProduct = aggregate(source, (row) => row.productManager || "Без продакта", { limit: 8 });
  const byStatus = aggregate(source, (row) => dealStatusLabels[row.status] ?? row.status, { limit: 8 });
  const paymentsByMonth = aggregate(source, (row) => `${row.monthNumber}|${row.month}`, { value: "paid", limit: 12, sortByKey: true });

  const overduePayments = source
    .filter((row) => row.paymentStatus === "overdue" || (row.paymentDeadline && row.paymentDeadline < new Date() && row.paid < row.fact))
    .slice(0, 8);
  const activeDeals = source.filter((row) => ["lead", "proposal"].includes(row.status)).slice(0, 8);
  const quality = buildQuality(allRows, clients, events);
  const details = source.slice(0, 60);

  return (
    <AppShell>
      <PageHeader
        title="Dashboard продажів"
        subtitle="План/факт, pipeline, оплати, джерела розрахунку та перевірка даних з єдиної бази угод."
      />

      <Filters filters={filters} years={years} events={events} clients={clients} managers={managers} productManagers={productManagers} />

      <section id="source" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <a href="#details"><MetricCard title="План продажів" value={money(plan)} note={`${source.length} угод у розрахунку`} icon={<TrendingUp size={21} />} /></a>
        <a href="#details"><MetricCard title="Факт продажів" value={money(fact)} note="Складається з відфільтрованих угод" icon={<CircleDollarSign size={21} />} /></a>
        <MetricCard title="% виконання" value={`${percent}%`} note={money(variance)} icon={<Percent size={21} />} />
        <a href="#active"><MetricCard title="Pipeline" value={money(pipeline)} note="Ліди та пропозиції" icon={<Handshake size={21} />} /></a>
        <a href="#payments"><MetricCard title="Оплачено" value={money(paid)} note={`Дебіторка: ${money(receivable)}`} icon={<BadgeDollarSign size={21} />} /></a>
        <MetricCard title="Відхилення" value={money(variance)} note={variance >= 0 ? "Вище плану" : "Нижче плану"} icon={variance >= 0 ? <TrendingUp size={21} /> : <TrendingDown size={21} />} />
        <MetricCard title="Очікується оплат" value={money(receivable)} note="Факт мінус оплачено" icon={<AlertTriangle size={21} />} />
        <MetricCard title="Компанії" value={String(uniqueCompanies)} note="Унікальні компанії в роботі" icon={<Building2 size={21} />} />
        <MetricCard title="Продакт-менеджери" value={String(uniqueProductManagers)} note="Пов'язані з угодами" icon={<UsersRound size={21} />} />
        <MetricCard title="Заходи" value={String(uniqueEvents)} note="З продажами або pipeline" icon={<CalendarDays size={21} />} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <BarPanel title="План / факт по місяцях" rows={byMonth.map(stripMonthKey)} mode="planFact" />
        <BarPanel title="План / факт по заходах" rows={byEvent} mode="planFact" />
        <BarPanel title="Продажі по компаніях" rows={byCompany} mode="fact" />
        <BarPanel title="Продажі по менеджерах" rows={byManager} mode="fact" />
        <BarPanel title="Продажі по продакт-менеджерах" rows={byProduct} mode="fact" />
        <BarPanel title="Оплати по місяцях" rows={paymentsByMonth.map(stripMonthKey)} mode="paid" />
        <BarPanel title="Pipeline по статусах" rows={byStatus} mode="fact" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <SimpleTable title="Топ компаній" rows={byCompany.map((row) => [row.label, money(row.fact), money(row.paid)])} headers={["Компанія", "Факт", "Оплачено"]} />
        <SimpleTable id="active" title="Угоди в роботі" rows={activeDeals.map((row) => [row.company, row.event, money(row.fact), dealStatusLabels[row.status] ?? row.status])} headers={["Компанія", "Захід", "Сума", "Статус"]} />
        <SimpleTable id="payments" title="Прострочені / очікувані оплати" rows={overduePayments.map((row) => [row.company, money(row.fact - row.paid), row.paymentDeadline ? dateUa(row.paymentDeadline) : "—", paymentStatusLabels[row.paymentStatus] ?? row.paymentStatus])} headers={["Компанія", "Залишок", "Дедлайн", "Статус"]} />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Перевірка даних</h2>
            <p className="text-sm text-slate-500">Пояснює, чому цифри можуть відрізнятися від Excel або потребувати ручної правки.</p>
          </div>
          <a href="#details" className="text-sm font-medium text-brand-dark hover:underline">Перейти до деталізації</a>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quality.map((item) => (
            <div key={item.label} className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className={item.count ? "mt-2 text-2xl font-semibold text-red-600" : "mt-2 text-2xl font-semibold text-emerald-600"}>{item.count}</p>
              <p className="mt-1 text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="details" className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold text-slate-950">Джерело розрахунку та деталізація</h2>
          <p className="mt-1 text-sm text-slate-500">Кожен KPI вище рахується з цих угод. Змініть рядок, і Dashboard перерахується після збереження.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Компанія</th><th>Продакт</th><th>Менеджер</th><th>Захід</th><th>Дата</th><th>Місяць</th><th>Пакет</th><th>План</th><th>Факт</th><th>Оплачено</th><th>Залишок</th><th>Угода</th><th>Оплата</th><th>Дедлайн</th><th>Коментар</th><th>Редагування</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-3 font-medium text-slate-900">{row.company}</td>
                  <td>{row.productManager || "—"}</td>
                  <td>{row.manager || "—"}</td>
                  <td><Link href={`/events/${row.eventId}`} className="text-brand-dark hover:underline">{row.event}</Link></td>
                  <td>{dateUa(row.eventDate)}</td>
                  <td>{row.month}</td>
                  <td>{row.package}</td>
                  <td>{money(row.plan)}</td>
                  <td>{money(row.fact)}</td>
                  <td>{money(row.paid)}</td>
                  <td>{money(Math.max(row.fact - row.paid, 0))}</td>
                  <td><StatusBadge value={row.status} label={dealStatusLabels[row.status] ?? row.status} /></td>
                  <td><StatusBadge value={row.paymentStatus} label={paymentStatusLabels[row.paymentStatus] ?? row.paymentStatus} /></td>
                  <td>{row.paymentDeadline ? dateUa(row.paymentDeadline) : "—"}</td>
                  <td className="max-w-xs">{row.comment || "—"}</td>
                  <td><EditDeal row={row} clients={clients} events={events} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

async function commercialDealsForDashboard() {
  const deals = await prisma.deal.findMany({
    include: {
      client: true,
      event: {
        include: {
          slots: true
        }
      }
    }
  });
  const ids = new Set<string>();
  for (const deal of deals) {
    const matchingInternal = deal.event.slots.some((slot) =>
      slot.rowTypeNormalized === "MEDEVENT_PROGRAM" &&
      slot.clientId === deal.clientId &&
      slot.package === deal.package
    );
    if (!matchingInternal) ids.add(deal.id);
  }
  return ids;
}

function normalizeFilters(searchParams: SearchParams) {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  return {
    year: get("year"),
    month: get("month"),
    eventId: get("eventId"),
    clientId: get("clientId"),
    manager: get("manager"),
    productManager: get("productManager"),
    dealStatus: get("dealStatus"),
    paymentStatus: get("paymentStatus")
  };
}

function matchesFilters(deal: any, filters: ReturnType<typeof normalizeFilters>) {
  const date = new Date(deal.event.startDate);
  if (filters.year && String(date.getFullYear()) !== filters.year) return false;
  if (filters.month && String(date.getMonth() + 1) !== filters.month) return false;
  if (filters.eventId && deal.eventId !== filters.eventId) return false;
  if (filters.clientId && deal.clientId !== filters.clientId) return false;
  if (filters.manager && (deal.manager ?? "") !== filters.manager) return false;
  if (filters.productManager && productManagerOf(deal) !== filters.productManager) return false;
  if (filters.dealStatus && deal.status !== filters.dealStatus) return false;
  if (filters.paymentStatus && deal.paymentStatus !== filters.paymentStatus) return false;
  return true;
}

function productManagerOf(deal: any) {
  return deal.productManager || deal.client.productManagers?.[0]?.name || "";
}

function buildRows(deals: any[]) {
  return deals.map((deal) => {
    const eventDate = new Date(deal.event.startDate);
    const paidFromPayments = deal.payments.reduce((total: number, payment: any) => total + Number(payment.actualPaid ?? 0), 0);
    const paid = Number(deal.paidAmount || 0) || paidFromPayments;
    const plan = Number(deal.planAmount || 0) || Number(deal.amount || 0);
    const fact = Number(deal.factAmount || 0) || Number(deal.amount || 0);
    return {
      id: deal.id,
      clientId: deal.clientId,
      eventId: deal.eventId,
      company: deal.client.company,
      productManager: productManagerOf(deal),
      manager: deal.manager || "",
      event: deal.event.title,
      eventDate,
      year: eventDate.getFullYear(),
      monthNumber: eventDate.getMonth() + 1,
      month: months[eventDate.getMonth()],
      package: deal.package,
      plan,
      fact,
      paid,
      status: deal.status,
      paymentStatus: deal.paymentStatus,
      paymentDeadline: deal.paymentDeadline || deal.payments[0]?.dueDate || null,
      reportDeadline: deal.reportDeadline,
      comment: deal.comment || "",
      archived: deal.archived
    };
  });
}

function sum(rows: Array<Record<string, any>>, key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function aggregate(rows: ReturnType<typeof buildRows>, keyFn: (row: ReturnType<typeof buildRows>[number]) => string, options: { value?: "fact" | "paid"; limit?: number; sortByKey?: boolean } = {}) {
  const map = new Map<string, { label: string; plan: number; fact: number; paid: number }>();
  for (const row of rows) {
    const key = keyFn(row) || "Не вказано";
    const current = map.get(key) ?? { label: key, plan: 0, fact: 0, paid: 0 };
    current.plan += row.plan;
    current.fact += row.fact;
    current.paid += row.paid;
    map.set(key, current);
  }
  const list = Array.from(map.values());
  list.sort(options.sortByKey ? (a, b) => a.label.localeCompare(b.label, "uk") : (a, b) => b[options.value ?? "fact"] - a[options.value ?? "fact"]);
  return list.slice(0, options.limit ?? 10);
}

function stripMonthKey(row: { label: string; plan: number; fact: number; paid: number }) {
  return { ...row, label: row.label.split("|")[1] ?? row.label };
}

function Filters({ filters, years, events, clients, managers, productManagers }: any) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        <Select name="year" label="Рік" value={filters.year} options={years.map((year: number) => [String(year), String(year)])} />
        <Select name="month" label="Місяць" value={filters.month} options={months.map((month, index) => [String(index + 1), month])} />
        <Select name="eventId" label="Захід" value={filters.eventId} options={events.map((event: any) => [event.id, event.title])} />
        <Select name="clientId" label="Компанія" value={filters.clientId} options={clients.map((client: any) => [client.id, client.company])} />
        <Select name="manager" label="Менеджер" value={filters.manager} options={managers.map((value: string) => [value, value])} />
        <Select name="productManager" label="Продакт" value={filters.productManager} options={productManagers.map((value: string) => [value, value])} />
        <Select name="dealStatus" label="Статус угоди" value={filters.dealStatus} options={Object.entries(dealStatusLabels)} />
        <Select name="paymentStatus" label="Статус оплати" value={filters.paymentStatus} options={Object.entries(paymentStatusLabels)} />
      </div>
      <div className="mt-4 flex gap-3">
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Застосувати</button>
        <Link href="/dashboard" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand">Скинути</Link>
      </div>
    </form>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value?: string; options: Array<[string, string]> }) {
  return (
    <div className="space-y-1.5">
      <label>{label}</label>
      <select name={name} defaultValue={value ?? ""}>
        <option value="">Усі</option>
        {options.map(([optionValue, optionLabel]) => <option key={`${name}-${optionValue}`} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  );
}

function BarPanel({ title, rows, mode }: { title: string; rows: Array<{ label: string; plan: number; fact: number; paid: number }>; mode: "planFact" | "fact" | "paid" }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.plan, row.fact, row.paid)));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-slate-950">{title}</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs text-slate-500">
              <span className="truncate">{row.label}</span>
              <span>{mode === "paid" ? money(row.paid) : money(row.fact)}</span>
            </div>
            {mode === "planFact" ? (
              <div className="space-y-1">
                <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-slate-300" style={{ width: `${Math.min(100, (row.plan / max) * 100)}%` }} /></div>
                <div className="h-2 rounded bg-brand-soft"><div className="h-2 rounded bg-brand" style={{ width: `${Math.min(100, (row.fact / max) * 100)}%` }} /></div>
              </div>
            ) : (
              <div className="h-2 rounded bg-brand-soft"><div className="h-2 rounded bg-brand" style={{ width: `${Math.min(100, ((mode === "paid" ? row.paid : row.fact) / max) * 100)}%` }} /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleTable({ title, headers, rows, id }: { title: string; headers: string[]; rows: string[][]; id?: string }) {
  return (
    <div id={id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-slate-950">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr>{headers.map((header) => <th key={header} className="pb-2">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="py-2 pr-3">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function buildQuality(rows: ReturnType<typeof buildRows>, clients: any[], events: any[]) {
  const duplicateCompanies = countDuplicates(clients.map((client) => client.company));
  const duplicateEvents = countDuplicates(events.map((event) => event.title));
  const duplicateProducts = countDuplicates(rows.map((row) => row.productManager).filter(Boolean));
  return [
    { label: "Угоди без компанії", count: rows.filter((row) => !row.clientId).length, note: "Не потраплять у компанійний аналіз" },
    { label: "Угоди без заходу", count: rows.filter((row) => !row.eventId).length, note: "Не потраплять у календар" },
    { label: "Без продакт-менеджера", count: rows.filter((row) => !row.productManager).length, note: "Потрібно заповнити для аналітики" },
    { label: "Без суми", count: rows.filter((row) => row.fact <= 0 && row.plan <= 0).length, note: "Не впливають на KPI" },
    { label: "Оплати без дедлайну", count: rows.filter((row) => row.fact > row.paid && !row.paymentDeadline).length, note: "Немає дати контролю" },
    { label: "Факт ≠ план", count: rows.filter((row) => row.plan !== row.fact).length, note: "Перевірити відхилення" },
    { label: "Дублі компаній", count: duplicateCompanies, note: "Схожі назви з Excel" },
    { label: "Дублі продактів", count: duplicateProducts, note: "Однакові ПМ у різних написаннях" },
    { label: "Дублі заходів", count: duplicateEvents, note: "Перевірити назви подій" }
  ];
}

function countDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  }
  return duplicates.size;
}

function EditDeal({ row, clients, events }: { row: ReturnType<typeof buildRows>[number]; clients: any[]; events: any[] }) {
  return (
    <EditorOnly>
      <details className="min-w-[340px]">
        <summary className="cursor-pointer text-sm font-medium text-brand-dark">Редагувати</summary>
        <form action={updateDealFromDashboard} className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="id" value={row.id} />
          <select name="clientId" defaultValue={row.clientId}>{clients.map((client) => <option key={client.id} value={client.id}>{client.company}</option>)}</select>
          <select name="eventId" defaultValue={row.eventId}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
          <input name="productManager" defaultValue={row.productManager} placeholder="Продакт-менеджер" />
          <input name="manager" defaultValue={row.manager} placeholder="Менеджер MedEvent" />
          <input name="package" defaultValue={row.package} placeholder="Пакет" />
          <div className="grid grid-cols-3 gap-2">
            <input name="planAmount" type="number" defaultValue={row.plan} />
            <input name="factAmount" type="number" defaultValue={row.fact} />
            <input name="paidAmount" type="number" defaultValue={row.paid} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select name="status" defaultValue={row.status}>{Object.entries(dealStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select name="paymentStatus" defaultValue={row.paymentStatus}>{Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
          <input name="paymentDeadline" type="date" defaultValue={row.paymentDeadline ? new Date(row.paymentDeadline).toISOString().slice(0, 10) : ""} />
          <textarea name="comment" defaultValue={row.comment} placeholder="Коментар" rows={2} />
          <label className="flex items-center gap-2 text-xs normal-case tracking-normal"><input name="archived" type="checkbox" className="h-4 w-4" /> Архівувати</label>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">Зберегти</button>
        </form>
      </details>
    </EditorOnly>
  );
}

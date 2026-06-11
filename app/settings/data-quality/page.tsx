import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { dateUa, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DataQualityPage() {
  const [events, clients, productManagers, speakers, deals, tasks, payments, reports] = await Promise.all([
    prisma.event.findMany({ include: { slots: { include: { client: true } } }, orderBy: { startDate: "asc" } }),
    prisma.client.findMany({ include: { productManagers: true } }),
    prisma.productManager.findMany({ include: { client: true } }),
    prisma.speaker.findMany(),
    prisma.deal.findMany({ include: { client: true, event: true } }),
    prisma.operationTask.findMany({ include: { event: true }, orderBy: [{ deadline: "asc" }, { createdAt: "desc" }] }),
    prisma.payment.findMany({ include: { deal: { include: { client: true, event: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.report.findMany({ include: { event: true } })
  ]);

  const now = new Date();
  const partnerSlots = events.flatMap((event) => event.slots.map((slot) => ({ ...slot, event }))).filter((slot) => slot.rowTypeNormalized === "PARTNER");
  const programSlots = events.flatMap((event) => event.slots.map((slot) => ({ ...slot, event }))).filter((slot) => slot.rowTypeNormalized === "MEDEVENT_PROGRAM");
  const checks = [
    section("PARTNER without company", partnerSlots.filter((slot) => !slot.clientId), (slot: any) => [slot.event.title, slot.productManager || "No product manager", slot.package]),
    section("PARTNER without product manager", partnerSlots.filter((slot) => !slot.productManager), (slot: any) => [slot.event.title, slot.client?.company || "No company", slot.package]),
    section("Confirmed partner without amount", partnerSlots.filter((slot) => String(slot.salesStatus).includes("100") && Number(slot.price || 0) <= 0), (slot: any) => [slot.event.title, slot.client?.company || "No company", slot.salesStatus]),
    section("Missing required inputs", partnerSlots.filter((slot) => slot.missingInputs), (slot: any) => [slot.event.title, slot.client?.company || "No company", slot.missingInputs || ""]),
    section("Program item without speaker", programSlots.filter((slot) => !slot.speakerName), (slot: any) => [slot.event.title, slot.talkTitle || "No topic", slot.rowTypeNormalized]),
    section("Program item without topic", programSlots.filter((slot) => !slot.talkTitle), (slot: any) => [slot.event.title, slot.speakerName || "No speaker", slot.rowTypeNormalized]),
    section("Task without deadline", tasks.filter((task) => !task.deadline), (task: any) => [task.event.title, task.title, task.status]),
    section("Overdue task", tasks.filter((task) => task.deadline && task.deadline < now && !["ready", "done"].includes(task.status)), (task: any) => [task.event.title, task.title, task.deadline ? dateUa(task.deadline) : ""]),
    section("Payment expected but no payment date", deals.filter((deal) => Number(deal.factAmount || deal.amount || 0) > Number(deal.paidAmount || 0) && !deal.paymentDeadline), (deal: any) => [deal.event.title, deal.client.company, money(deal.factAmount || deal.amount)]),
    section("Payment overdue", payments.filter((payment) => payment.status !== "paid" && payment.dueDate < now), (payment: any) => [payment.deal.event.title, payment.deal.client.company, `${dateUa(payment.dueDate)} / ${money(payment.amount)}`]),
    section("Report required but no deadline", reports.filter((report) => !report.deadline), (report: any) => [report.event.title, report.title, report.status]),
    section("Duplicate companies", duplicates(clients, (client: any) => client.company), (client: any) => [client.company, client.directions || "", client.id]),
    section("Duplicate product managers", duplicates(productManagers, (manager: any) => manager.name), (manager: any) => [manager.name, manager.client.company, manager.id]),
    section("Duplicate speakers", duplicates(speakers, (speaker: any) => speaker.fullName), (speaker: any) => [speaker.fullName, speaker.specialization, speaker.id]),
    section("Duplicate event names", duplicates(events, (event: any) => event.title), (event: any) => [event.title, dateUa(event.startDate), event.id])
  ];

  return (
    <AppShell>
      <PageHeader title="Data Quality" subtitle="Контроль якості даних після імпорту Excel і щоденної роботи команди." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => (
          <a key={check.title} href={`#${slug(check.title)}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-brand">
            <p className="text-sm font-medium text-slate-600">{check.title}</p>
            <p className={check.rows.length ? "mt-2 text-2xl font-semibold text-red-600" : "mt-2 text-2xl font-semibold text-emerald-600"}>{check.rows.length}</p>
          </a>
        ))}
      </section>
      <section className="mt-6 space-y-6">
        {checks.map((check) => (
          <div key={check.title} id={slug(check.title)} className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">{check.title}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Event / Entity</th><th>Context</th><th>Details</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {check.rows.slice(0, 100).map((row, index) => (
                    <tr key={`${check.title}-${index}`}>
                      {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3">{cell}</td>)}
                    </tr>
                  ))}
                  {!check.rows.length ? <tr><td className="px-3 py-4 text-slate-500" colSpan={3}>No issues found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
      <div className="mt-6"><Link href="/dashboard" className="text-sm font-medium text-brand-dark hover:underline">Back to dashboard</Link></div>
    </AppShell>
  );
}

function section(title: string, items: any[], mapRow: (item: any) => string[]) {
  return { title, rows: items.map(mapRow) };
}

function normalize(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function duplicates<T>(items: T[], keyFn: (item: T) => string) {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = normalize(keyFn(item));
    if (!key) continue;
    buckets.set(key, [...(buckets.get(key) || []), item]);
  }
  return Array.from(buckets.values()).filter((bucket) => bucket.length > 1).flat();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

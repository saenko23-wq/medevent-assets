import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { createEventSlot, createOperationTask } from "@/lib/actions";
import {
  dateUa,
  eventFormatLabels,
  eventStatusLabels,
  money,
  operationStatusLabels,
  operationTypeLabels
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const [event, clients, references] = await Promise.all([
    prisma.event.findUnique({
      where: { id: params.id },
      include: {
        slots: { include: { client: true }, orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }] },
        tasks: { orderBy: [{ deadline: "asc" }, { createdAt: "asc" }] },
        documents: { orderBy: { createdAt: "asc" } }
      }
    }),
    prisma.client.findMany({ orderBy: { company: "asc" } }),
    prisma.referenceCategory.findMany({ include: { items: { where: { isActive: true }, orderBy: { value: "asc" } } } })
  ]);

  if (!event) notFound();

  const ref = new Map(references.map((category) => [category.name, category.items.map((item) => item.value)]));
  const slotRevenue = event.slots.reduce((sum, slot) => sum + Number(slot.price ?? 0), 0);
  const honorarium = event.slots.reduce((sum, slot) => sum + Number(slot.speakerHonorarium ?? 0), 0);

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand">
          <ArrowLeft size={16} />
          До всіх заходів
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-dark">{event.eventCode ?? "Без Event ID"}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{event.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {dateUa(event.startDate)} - {dateUa(event.endDate)} · {eventFormatLabels[event.format]} · {event.formatDetails || "формат не деталізовано"}
            </p>
          </div>
          <StatusBadge value={event.status} label={eventStatusLabels[event.status]} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Info label="План бюджет" value={money(event.plannedBudget)} />
          <Info label="Факт бюджет" value={money(event.actualBudget)} />
          <Info label="Факт по слотах" value={money(slotRevenue)} />
          <Info label="Середній чек" value={money(event.averageCheck)} />
          <Info label="Гонорари" value={money(Number(event.totalSpeakerHonorarium) || honorarium)} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <External href={event.pageUrl} label="Сторінка заходу" />
          <External href={event.programDraftUrl} label="Драфт програми" />
          <External href={event.youtubeDay1Url} label="Трансляція День 1" />
          <External href={event.youtubeDay2Url} label="Трансляція День 2" />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Програма та партнери</h2>
            <p className="text-sm text-slate-500">Аналог рядків окремої вкладки заходу.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">№</th><th>Тип</th><th>Компанія</th><th>Продакт</th><th>Менеджер</th><th>Статус</th><th>Пакет</th><th>Вартість</th><th>Спікер</th><th>Формат</th><th>Тема</th><th>Бренд</th><th>Студія/запис</th><th>Чекліст</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {event.slots.map((slot) => (
                  <tr key={slot.id} className="align-top">
                    <td className="px-4 py-3">{slot.rowNumber ?? "—"}</td>
                    <td>{slot.rowType}</td>
                    <td className="font-medium text-slate-900">{slot.client?.company ?? "MedEvent"}</td>
                    <td>{slot.productManager ?? "—"}</td>
                    <td>{slot.manager ?? "—"}</td>
                    <td>{slot.salesStatus}</td>
                    <td>{slot.package}</td>
                    <td>{slot.price ? money(slot.price) : "—"}</td>
                    <td>{slot.speakerName ?? "—"}</td>
                    <td>{slot.participationFormat ?? "—"}</td>
                    <td className="max-w-sm">{slot.talkTitle ?? "—"}</td>
                    <td>{slot.brandTopic ?? "—"}</td>
                    <td>{slot.studioRecord ?? "—"}</td>
                    <td className="text-xs text-slate-600">
                      Драфт: {slot.draftSent ? "так" : "ні"} · Док: {slot.documentsSent ? "так" : "ні"} · Звіт: {slot.reportSent ? "так" : "ні"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <EditorOnly>
          <form action={createEventSlot} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="eventId" value={event.id} />
            <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Новий рядок програми</h2></div>
            <div className="grid gap-3">
              <FieldSelect label="Тип рядка" name="rowType" values={ref.get("Тип рядка") ?? ["Партнер", "Без фарм"]} />
              <div className="space-y-1.5"><label>Компанія</label><select name="clientId"><option value="">MedEvent / без компанії</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label>Продакт</label><input name="productManager" /></div>
                <FieldSelect label="Менеджер" name="manager" values={ref.get("Менеджери") ?? []} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldSelect label="Статус" name="salesStatus" values={ref.get("Статуси продажу") ?? []} />
                <FieldSelect label="Пакет" name="package" values={ref.get("Пакети") ?? []} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label>Вартість</label><input name="price" /></div>
                <FieldSelect label="Формат" name="participationFormat" values={ref.get("Формат участі") ?? []} />
              </div>
              <div className="space-y-1.5"><label>Спікер</label><input name="speakerName" /></div>
              <div className="space-y-1.5"><label>Тема доповіді</label><textarea name="talkTitle" rows={3} /></div>
              <div className="space-y-1.5"><label>Препарат / тема бренду</label><input name="brandTopic" /></div>
              <div className="grid grid-cols-2 gap-3">
                <FieldSelect label="Студія/запис" name="studioRecord" values={ref.get("Студія/запис") ?? []} />
                <FieldSelect label="Тривалість" name="duration" values={ref.get("Тривалість") ?? []} />
              </div>
              <div className="space-y-1.5"><label>Напрям</label><input name="direction" /></div>
              <button className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати рядок</button>
            </div>
          </form>
        </EditorOnly>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">Операційні дедлайни</h2>
          <div className="space-y-3">
            {event.tasks.map((task) => (
              <div key={task.id} className="grid gap-3 rounded-md border border-slate-100 p-3 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium text-slate-900">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {operationTypeLabels[task.type]} · {task.assignee || "без відповідального"} · {task.deadline ? dateUa(task.deadline) : "без дедлайну"}
                  </p>
                  {task.comment ? <p className="mt-2 text-sm text-slate-600">{task.comment}</p> : null}
                </div>
                <StatusBadge value={task.status} label={operationStatusLabels[task.status]} />
              </div>
            ))}
          </div>
        </div>

        <EditorOnly>
          <form action={createOperationTask} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="eventId" value={event.id} />
            <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Нова задача</h2></div>
            <div className="grid gap-3">
              <div className="space-y-1.5"><label>Назва</label><input name="title" required /></div>
              <div className="space-y-1.5"><label>Тип</label><select name="type">{Object.entries(operationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label>Дедлайн</label><input name="deadline" type="date" /></div>
                <div className="space-y-1.5"><label>Факт дата</label><input name="factDate" type="date" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label>Відповідальний</label><input name="assignee" /></div>
                <div className="space-y-1.5"><label>Статус</label><select name="status">{Object.entries(operationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              </div>
              <div className="space-y-1.5"><label>Посилання</label><input name="link" type="url" /></div>
              <div className="space-y-1.5"><label>Коментар</label><textarea name="comment" rows={3} /></div>
              <button className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати задачу</button>
            </div>
          </form>
        </EditorOnly>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-950">Документи та посилання</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {event.documents.map((document) => (
            <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-200 p-3 text-sm hover:border-brand hover:bg-brand-soft">
              <p className="font-medium text-slate-950">{document.title}</p>
              <p className="mt-1 text-xs text-slate-500">{document.type}{document.owner ? ` · ${document.owner}` : ""}</p>
            </a>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function External({ href, label }: { href?: string | null; label: string }) {
  if (!href) return <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-400">{label}</div>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand">
      {label}
      <ExternalLink size={15} />
    </a>
  );
}

function FieldSelect({ label, name, values }: { label: string; name: string; values: string[] }) {
  return (
    <div className="space-y-1.5">
      <label>{label}</label>
      <select name={name}>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select>
    </div>
  );
}

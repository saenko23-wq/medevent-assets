import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { dateUa, eventFormatLabels, eventStatusLabels, operationStatusLabels, operationTypeLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const events = await prisma.event.findMany({
    include: { tasks: true, slots: true },
    orderBy: { startDate: "asc" }
  });

  const grouped = events.reduce<Record<string, typeof events>>((acc, event) => {
    const key = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(event.startDate);
    acc[key] = acc[key] ?? [];
    acc[key].push(event);
    return acc;
  }, {});

  const urgentTasks = events
    .flatMap((event) => event.tasks.map((task) => ({ ...task, event })))
    .filter((task) => task.status !== "ready")
    .sort((a, b) => Number(a.deadline ?? 0) - Number(b.deadline ?? 0))
    .slice(0, 12);

  return (
    <AppShell>
      <PageHeader title="Загальний календар" subtitle="Єдиний календар подій і найближчих операційних дедлайнів." />
      <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold capitalize text-slate-950">{month}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="rounded-md border border-slate-200 p-4 transition hover:border-brand hover:bg-brand-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{dateUa(event.startDate)} - {dateUa(event.endDate)} · {eventFormatLabels[event.format]}</p>
                      </div>
                      <StatusBadge value={event.status} label={eventStatusLabels[event.status]} />
                    </div>
                    <div className="mt-3 flex gap-3 text-xs text-slate-500">
                      <span>{event.slots.length} рядків програми</span>
                      <span>{event.tasks.filter((task) => task.status !== "ready").length} задач в роботі</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">Найближчі дедлайни</h2>
          <div className="space-y-3">
            {urgentTasks.map((task) => (
              <Link key={task.id} href={`/events/${task.eventId}`} className="block rounded-md border border-slate-100 p-3 hover:border-brand">
                <p className="text-sm font-medium text-slate-900">{task.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {task.event.title} · {task.deadline ? dateUa(task.deadline) : "без дати"} · {operationTypeLabels[task.type]}
                </p>
                <div className="mt-2">
                  <StatusBadge value={task.status} label={operationStatusLabels[task.status]} />
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

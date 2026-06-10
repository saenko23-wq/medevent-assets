import type { ReactNode } from "react";

export function MetricCard({
  title,
  value,
  note,
  icon
}: {
  title: string;
  value: string;
  note?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-md bg-brand-soft p-2 text-brand">{icon}</div>
      </div>
      {note ? <p className="mt-3 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}

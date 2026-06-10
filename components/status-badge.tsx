import { clsx } from "clsx";

const tones: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  active: "bg-brand-soft text-brand-dark ring-brand/20",
  can_request: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  proposal: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  planning: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  waiting: "bg-amber-50 text-amber-700 ring-amber-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  lost: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  not_started: "bg-slate-100 text-slate-700 ring-slate-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function StatusBadge({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tones[value] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      {label}
    </span>
  );
}

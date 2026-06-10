import { format } from "date-fns";

export function money(value: number | string | { toString(): string }) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0
  }).format(Number(value));
}

export function dateUa(value: Date | string) {
  return format(new Date(value), "dd.MM.yyyy");
}

export const roleLabels: Record<string, string> = {
  admin: "Адмін",
  manager: "Менеджер",
  operations: "Операції",
  viewer: "Перегляд"
};

export const eventFormatLabels: Record<string, string> = {
  offline: "Офлайн",
  online: "Онлайн",
  hybrid: "Гібрид"
};

export const eventStatusLabels: Record<string, string> = {
  draft: "Чернетка",
  planning: "Планування",
  active: "Активний",
  completed: "Завершено",
  cancelled: "Скасовано"
};

export const dealStatusLabels: Record<string, string> = {
  lead: "Лід",
  proposal: "Пропозиція",
  won: "Виграно",
  lost: "Втрачено"
};

export const reportStatusLabels: Record<string, string> = {
  not_started: "Не розпочато",
  ready: "Готово"
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "Оплачено",
  waiting: "Очікуємо",
  overdue: "Прострочено",
  can_request: "Можна просити"
};

export const operationStatusLabels: Record<string, string> = {
  not_started: "Не розпочато",
  in_progress: "В роботі",
  ready: "Готово",
  blocked: "Блокер"
};

export const operationTypeLabels: Record<string, string> = {
  doclink: "DocLink",
  event_page: "Сторінка",
  moz_registration: "МОЗ / ТЦ",
  mailing: "Розсилка",
  analytics: "Аналітика",
  client_report: "Звіт клієнту",
  client_report_6m: "Звіт 6 міс.",
  client_report_12m: "Звіт 12 міс.",
  draft_program: "Драфт програми",
  documents: "Документи",
  custom: "Інше"
};

export const deadlineStateLabels: Record<string, string> = {
  overdue: "Прострочено",
  today: "Сьогодні",
  soon: "Скоро",
  later: "Пізніше",
  done: "Готово",
  no_date: "Без дати"
};

export function deadlineStateFor(deadline: Date | string | null, status?: string | null) {
  if (status === "ready") return "done";
  if (!deadline) return "no_date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "soon";
  return "later";
}

export function parseMoney(value: FormDataEntryValue | null) {
  if (!value) return 0;
  return Number(String(value).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
}

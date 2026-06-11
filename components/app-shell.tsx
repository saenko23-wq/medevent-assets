import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileText,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mic2,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { roleLabels } from "@/lib/format";
import { SignOutButton } from "@/components/sign-out-button";

const items = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/calendar", label: "Календар", icon: CalendarRange },
  { href: "/workspace/deadlines", label: "Задачі", icon: ClipboardList },
  { href: "/clients", label: "Клієнти", icon: UsersRound },
  { href: "/speakers", label: "Спікери", icon: Mic2 },
  { href: "/events", label: "Заходи", icon: CalendarDays },
  { href: "/deals", label: "Угоди", icon: Handshake },
  { href: "/reports", label: "Звіти", icon: FileText },
  { href: "/payments", label: "Оплати", icon: BadgeDollarSign },
  { href: "/packages", label: "Пакети", icon: Package },
  { href: "/references", label: "Довідники", icon: SlidersHorizontal },
  { href: "/settings/data-quality", label: "Data Quality", icon: ShieldCheck }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white">
            <BarChart3 size={22} />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-950">MedEvent CRM</p>
            <p className="text-xs text-slate-500">Освітні медичні заходи</p>
          </div>
        </Link>

        <nav className="mt-8 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand-soft hover:text-brand-dark"
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950">{session?.user.name ?? session?.user.email}</p>
              <p className="text-xs text-slate-500">{roleLabels[session?.user.role ?? "viewer"] ?? "Перегляд"}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 overflow-x-auto lg:hidden">
                {items.slice(0, 5).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md border border-slate-200 bg-white p-2 text-slate-600"
                    title={item.label}
                  >
                    <item.icon size={18} />
                  </Link>
                ))}
              </div>
              <SignOutButton>
                <LogOut size={17} />
              </SignOutButton>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

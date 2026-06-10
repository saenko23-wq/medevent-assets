import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: { productManagers: true, contacts: true, deals: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppShell>
      <PageHeader title="Клієнти" subtitle="Компанії, продакт-менеджери, напрямки та контакти." />
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Компанія</th>
                  <th>Напрямки</th>
                  <th>Продакт-менеджер</th>
                  <th>Контакт</th>
                  <th>Угод</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{client.company}</td>
                    <td className="max-w-xs text-slate-600">{client.directions}</td>
                    <td>{client.productManagers[0]?.name ?? "—"}</td>
                    <td>{client.contacts[0]?.name ?? "—"}</td>
                    <td>{client.deals.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <EditorOnly>
        <form action={createClient} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="text-brand" size={18} />
            <h2 className="font-semibold text-slate-950">Новий клієнт</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5"><label>Компанія</label><input name="company" required /></div>
            <div className="space-y-1.5"><label>Напрямки</label><input name="directions" placeholder="Кардіологія, онкологія..." required /></div>
            <div className="space-y-1.5"><label>Нотатки</label><textarea name="notes" rows={3} /></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-1.5"><label>Продакт-менеджер</label><input name="managerName" required /></div>
              <div className="space-y-1.5"><label>Email PM</label><input name="managerEmail" type="email" /></div>
              <div className="space-y-1.5"><label>Телефон PM</label><input name="managerPhone" /></div>
              <div className="space-y-1.5"><label>Контакт</label><input name="contactName" required /></div>
              <div className="space-y-1.5"><label>Посада</label><input name="contactPosition" /></div>
              <div className="space-y-1.5"><label>Email контакту</label><input name="contactEmail" type="email" /></div>
              <div className="space-y-1.5"><label>Телефон контакту</label><input name="contactPhone" /></div>
            </div>
            <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати клієнта</button>
          </div>
        </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

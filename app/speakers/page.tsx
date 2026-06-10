import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { createSpeaker } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SpeakersPage() {
  const speakers = await prisma.speaker.findMany({
    include: { eventSpeakers: { include: { event: true } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppShell>
      <PageHeader title="Спікери" subtitle="ПІБ, телефон, спеціалізація та прив'язка до заходів." />
      <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 md:grid-cols-2">
          {speakers.map((speaker) => (
            <article key={speaker.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">{speaker.fullName}</h2>
              <p className="mt-1 text-sm text-slate-500">{speaker.specialization}</p>
              <p className="mt-3 text-sm text-slate-700">{speaker.phone}</p>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Заходи</p>
                <p className="mt-1 text-sm text-slate-700">
                  {speaker.eventSpeakers.map((item) => item.event.title).join(", ") || "Ще не прив'язано"}
                </p>
              </div>
            </article>
          ))}
        </div>
        <EditorOnly>
        <form action={createSpeaker} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Новий спікер</h2></div>
          <div className="space-y-4">
            <div className="space-y-1.5"><label>ПІБ</label><input name="fullName" required /></div>
            <div className="space-y-1.5"><label>Телефон</label><input name="phone" required /></div>
            <div className="space-y-1.5"><label>Спеціалізація</label><input name="specialization" required /></div>
            <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати спікера</button>
          </div>
        </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

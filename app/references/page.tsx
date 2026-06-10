import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EditorOnly } from "@/components/editor-only";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { createReferenceItem } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ReferencesPage() {
  const categories = await prisma.referenceCategory.findMany({
    include: { items: { orderBy: { value: "asc" } } },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell>
      <PageHeader title="Довідники" subtitle="Розширювані списки для dropdown-ів, як у вкладці «Довідники»." />
      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <article key={category.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-slate-950">{category.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {category.items.map((item) => (
                  <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{item.value}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <EditorOnly>
          <form action={createReferenceItem} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><Plus className="text-brand" size={18} /><h2 className="font-semibold">Додати значення</h2></div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label>Існуюча категорія</label>
                <select name="categoryId">
                  <option value="">Створити нову</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label>Нова категорія</label><input name="categoryName" placeholder="Наприклад: Формат участі" /></div>
              <div className="space-y-1.5"><label>Значення</label><input name="value" required /></div>
              <div className="space-y-1.5"><label>Нотатка</label><textarea name="notes" rows={3} /></div>
              <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Додати в довідник</button>
            </div>
          </form>
        </EditorOnly>
      </section>
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const packages = await prisma.participationPackage.findMany({
    include: { features: { orderBy: { name: "asc" } } },
    orderBy: { price: "asc" }
  });

  return (
    <AppShell>
      <PageHeader title="Пакети участі" subtitle="Матриця Standart / Plus / Mono / Combo з цінами та включеними сервісами." />
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {packages.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-slate-950">{item.name}</h2>
              <p className="mt-2 text-2xl font-semibold text-brand-dark">{money(item.price)}</p>
              <p className="mt-2 text-sm text-slate-500">{item.format}</p>
              <p className="mt-1 text-sm text-slate-500">{item.duration}</p>
            </div>
            <dl className="mt-4 space-y-3">
              {item.features.map((feature) => (
                <div key={feature.id}>
                  <dt className="text-xs font-semibold uppercase text-slate-500">{feature.name}</dt>
                  <dd className="mt-1 text-sm text-slate-800">{feature.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

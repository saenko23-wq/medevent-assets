import { NextResponse } from "next/server";
import { filterDashboardRows, getDashboardRows } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rows = await getDashboardRows();
  const filtered = filterDashboardRows(rows, searchParams);
  const plan = sum(filtered, "plan");
  const confirmed = sum(filtered.filter((row) => row.status === "won"), "fact");
  const pipeline = sum(filtered.filter((row) => ["lead", "proposal"].includes(row.status)), "fact");
  const paid = sum(filtered, "paid");
  const debt = filtered.reduce((total, row) => total + Math.max(row.fact - row.paid, 0), 0);

  return NextResponse.json({
    filters: Object.fromEntries(searchParams),
    kpis: {
      planSales: plan,
      confirmedSales: confirmed,
      planCompletionPercent: plan ? Math.round((confirmed / plan) * 100) : 0,
      planDeviation: confirmed - plan,
      pipeline,
      paid,
      debt,
      companiesInWork: new Set(filtered.map((row) => row.clientId)).size,
      productManagersInWork: new Set(filtered.map((row) => row.productManager).filter(Boolean)).size,
      eventsInWork: new Set(filtered.map((row) => row.eventId)).size
    },
    sourceRows: filtered.length
  });
}

function sum(rows: Array<Record<string, any>>, key: string) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

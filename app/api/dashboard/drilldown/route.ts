import { NextResponse } from "next/server";
import { filterDashboardRows, getDashboardRows } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") || "confirmed";
  const rows = filterDashboardRows(await getDashboardRows(), searchParams).filter((row) => {
    if (metric === "confirmed") return row.status === "won";
    if (metric === "pipeline") return ["lead", "proposal"].includes(row.status);
    if (metric === "paid") return row.paid > 0;
    if (metric === "debt") return row.fact > row.paid;
    return true;
  });

  return NextResponse.json({
    metric,
    count: rows.length,
    total: rows.reduce((sum, row) => sum + (metric === "paid" ? row.paid : metric === "debt" ? Math.max(row.fact - row.paid, 0) : row.fact), 0),
    rows
  });
}

import { prisma } from "@/lib/prisma";

export async function getDashboardRows() {
  const deals = await prisma.deal.findMany({
    where: { archived: false },
    include: { client: true, event: true, payments: true }
  });

  return deals.map((deal) => {
    const eventDate = new Date(deal.event.startDate);
    const paidFromPayments = deal.payments.reduce((total, payment) => total + Number(payment.actualPaid || 0), 0);
    return {
      id: deal.id,
      clientId: deal.clientId,
      eventId: deal.eventId,
      company: deal.client.company,
      event: deal.event.title,
      eventDate,
      year: eventDate.getFullYear(),
      month: eventDate.getMonth() + 1,
      productManager: deal.productManager || "",
      salesManager: deal.manager || "",
      package: deal.package,
      status: deal.status,
      paymentStatus: deal.paymentStatus,
      plan: Number(deal.planAmount || deal.amount || 0),
      fact: Number(deal.factAmount || deal.amount || 0),
      paid: Number(deal.paidAmount || 0) || paidFromPayments,
      paymentDeadline: deal.paymentDeadline,
      reportDeadline: deal.reportDeadline,
      comment: deal.comment || ""
    };
  });
}

export function filterDashboardRows(rows: Awaited<ReturnType<typeof getDashboardRows>>, searchParams: URLSearchParams) {
  return rows.filter((row) => {
    if (searchParams.get("year") && String(row.year) !== searchParams.get("year")) return false;
    if (searchParams.get("month") && String(row.month) !== searchParams.get("month")) return false;
    if (searchParams.get("eventId") && row.eventId !== searchParams.get("eventId")) return false;
    if (searchParams.get("clientId") && row.clientId !== searchParams.get("clientId")) return false;
    if (searchParams.get("productManager") && row.productManager !== searchParams.get("productManager")) return false;
    if (searchParams.get("salesManager") && row.salesManager !== searchParams.get("salesManager")) return false;
    if (searchParams.get("package") && row.package !== searchParams.get("package")) return false;
    if (searchParams.get("salesStatus") && row.status !== searchParams.get("salesStatus")) return false;
    if (searchParams.get("paymentStatus") && row.paymentStatus !== searchParams.get("paymentStatus")) return false;
    return true;
  });
}

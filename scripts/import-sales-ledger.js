const crypto = require("crypto");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const workbookPath = process.argv[2];

function text(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
}

function key(value) {
  return text(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function shortId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(text(value)).digest("hex").slice(0, 24)}`;
}

function money(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(text(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const shifted = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 12));
  }
  const raw = text(value);
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!match) return null;
  let first = Number(match[1]);
  let second = Number(match[2]);
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : 2026;
  if (first <= 12 && second > 12) {
    [first, second] = [second, first];
  }
  return new Date(Date.UTC(year, second - 1, first, 12));
}

function paymentStatus(value) {
  const raw = key(value);
  if (raw.includes("оплач")) return "paid";
  if (raw.includes("простр")) return "overdue";
  if (raw.includes("можна")) return "can_request";
  return "waiting";
}

function dealStatus(value) {
  return text(value).includes("100") ? "won" : "proposal";
}

function eventStatus(startDate) {
  const now = new Date();
  return startDate > now ? "planning" : "completed";
}

function rowObjects(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    cellDates: true
  });

  return rows
    .slice(2)
    .map((row, index) => ({
      sourceRow: index + 3,
      month: text(row[0]),
      eventDate: cleanExcelDate(row[1]),
      eventTitle: text(row[2]),
      eventNumber: text(row[3]),
      rowType: text(row[4]),
      company: text(row[5]),
      productManager: text(row[6]),
      packageName: text(row[7]) || "Individual",
      manager: text(row[8]),
      eventType: text(row[9]),
      approval: text(row[10]),
      amount: money(row[11]),
      crm: text(row[12]),
      speaker: text(row[13]),
      topic: text(row[14]),
      brand: text(row[15]),
      reportDeadline: cleanExcelDate(row[16]),
      reportSent: Boolean(row[17]),
      paymentDeadline: cleanExcelDate(row[18]),
      paidAt: cleanExcelDate(row[19]),
      paymentStatus: paymentStatus(row[20]),
      rawPaymentStatus: text(row[20]),
      marinaBonusPercent: money(row[21]),
      marinaBonus: money(row[22]),
      oleksandraBonusPercent: money(row[23]),
      oleksandraBonus: money(row[24]),
      comment: text(row[25]),
      technicalKey: text(row[26]),
      originalRow: text(row[27])
    }))
    .filter((row) => row.eventTitle && row.company && row.amount > 0);
}

async function ensureClient(company, productManager) {
  const clients = await prisma.client.findMany({
    where: { company: { equals: company, mode: "insensitive" } },
    include: { productManagers: true }
  });
  let client = clients[0];
  if (!client) {
    client = await prisma.client.create({
      data: {
        company,
        directions: "",
        notes: "Created from sales ledger",
        productManagers: productManager ? { create: { name: productManager } } : undefined
      },
      include: { productManagers: true }
    });
  }

  if (productManager && !client.productManagers.some((item) => key(item.name) === key(productManager))) {
    await prisma.productManager.create({ data: { clientId: client.id, name: productManager } });
  }
  return client;
}

async function ensureEvent(row) {
  const normalizedTitle = key(row.eventTitle);
  const events = await prisma.event.findMany();
  let event =
    events.find((item) => key(item.title) === normalizedTitle) ||
    events.find((item) => key(item.eventCode) === normalizedTitle) ||
    events.find((item) => key(item.title).endsWith(normalizedTitle));

  const startDate = row.eventDate || new Date(Date.UTC(2026, 0, 1, 12));
  if (!event) {
    event = await prisma.event.create({
      data: {
        title: row.eventTitle,
        eventCode: row.eventTitle,
        startDate,
        endDate: startDate,
        format: row.eventType || "online",
        deliveryFormat: "ONLINE",
        plannedBudget: 0,
        actualBudget: 0,
        status: eventStatus(startDate)
      }
    });
    return event;
  }

  if (event.title !== row.eventTitle || Number(event.startDate) !== Number(startDate)) {
    event = await prisma.event.update({
      where: { id: event.id },
      data: {
        title: row.eventTitle,
        eventCode: row.eventTitle,
        startDate,
        endDate: startDate,
        format: row.eventType || event.format,
        status: eventStatus(startDate)
      }
    });
  }
  return event;
}

function commentFor(row) {
  return [
    row.rawPaymentStatus ? `Payment source: ${row.rawPaymentStatus}` : "",
    row.topic ? `Topic: ${row.topic}` : "",
    row.brand ? `Brand: ${row.brand}` : "",
    row.speaker ? `Speaker: ${row.speaker}` : "",
    row.comment ? `Comment: ${row.comment}` : "",
    row.technicalKey ? `Source key: ${row.technicalKey}` : "",
    row.originalRow ? `Original row: ${row.originalRow}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
}

async function main() {
  if (!workbookPath) {
    throw new Error("Usage: node scripts/import-sales-ledger.js <xlsx-path>");
  }

  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const rows = rowObjects(workbook);
  if (!rows.length) throw new Error("No sales rows found.");

  const deals = [];
  const payments = [];

  for (const row of rows) {
    const client = await ensureClient(row.company, row.productManager);
    const event = await ensureEvent(row);
    const idSeed = row.technicalKey || `${row.eventTitle}|${row.eventNumber}|${row.company}|${row.productManager}|${row.amount}|${row.sourceRow}`;
    const dealId = shortId("sales", idSeed);
    const paidAmount = row.paymentStatus === "paid" ? row.amount : 0;

    deals.push({
      id: dealId,
      clientId: client.id,
      eventId: event.id,
      package: row.packageName,
      amount: row.amount,
      planAmount: row.amount,
      factAmount: row.amount,
      paidAmount,
      productManager: row.productManager || null,
      manager: row.manager || null,
      status: dealStatus(row.approval),
      paymentStatus: row.paymentStatus,
      paymentDeadline: row.paymentDeadline,
      reportDeadline: row.reportDeadline,
      comment: commentFor(row)
    });

    payments.push({
      id: shortId("payment", idSeed),
      dealId,
      status: row.paymentStatus,
      dueDate: row.paymentDeadline || row.eventDate || new Date(Date.UTC(2026, 0, 1, 12)),
      paidAt: row.paymentStatus === "paid" ? row.paidAt : null,
      amount: row.amount,
      actualPaid: paidAmount
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany();
    await tx.deal.deleteMany();
    await tx.deal.createMany({ data: deals, skipDuplicates: true });
    await tx.payment.createMany({ data: payments, skipDuplicates: true });
  });

  const eventIds = Array.from(new Set(deals.map((deal) => deal.eventId)));
  for (const eventId of eventIds) {
    const eventDeals = await prisma.deal.findMany({ where: { eventId, archived: false } });
    const total = eventDeals.reduce((sum, deal) => sum + Number(deal.factAmount || deal.amount || 0), 0);
    await prisma.event.update({
      where: { id: eventId },
      data: {
        plannedBudget: total,
        actualBudget: total,
        averageCheck: eventDeals.length ? total / eventDeals.length : 0,
        talkCount: eventDeals.length
      }
    });
  }

  const paid = payments.reduce((sum, payment) => sum + Number(payment.actualPaid || 0), 0);
  console.log(
    JSON.stringify(
      {
        importedRows: rows.length,
        deals: deals.length,
        payments: payments.length,
        total: deals.reduce((sum, deal) => sum + Number(deal.factAmount || 0), 0),
        paid
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

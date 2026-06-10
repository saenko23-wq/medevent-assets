const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const workbookPath = process.argv[2] || "medevent-source.xlsx";

function cellText(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
}

function slug(value) {
  return cellText(value)
    .toLowerCase()
    .replace(/[`'"’‘]/g, "")
    .replace(/[^a-zа-яіїєґ0-9]+/giu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

function money(value) {
  const text = cellText(value).replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value, fallbackYear = 2026) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = cellText(value);
  const match = text.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : fallbackYear;
  return new Date(Date.UTC(year, month - 1, day));
}

function rowsOf(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true, cellDates: true });
}

function eventStatusFromDates(start, end) {
  const now = new Date();
  if (end && end < now) return "completed";
  if (start && start > now) return "planning";
  return "active";
}

function opStatus(value) {
  const text = cellText(value).toLowerCase();
  if (text.includes("готов")) return "ready";
  if (text.includes("блок") || text.includes("проблем")) return "blocked";
  if (text.includes("робот")) return "in_progress";
  return "not_started";
}

async function createMany(model, data, chunk = 250) {
  for (let i = 0; i < data.length; i += chunk) {
    await model.createMany({ data: data.slice(i, i + chunk), skipDuplicates: true });
  }
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });

  await prisma.payment.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.operationTask.deleteMany();

  const clients = await prisma.client.findMany();
  const clientBySlug = new Map(clients.map((client) => [slug(client.company), client]));
  const events = await prisma.event.findMany();
  const eventByKey = new Map();
  for (const event of events) {
    eventByKey.set(slug(event.title), event);
    if (event.eventCode) eventByKey.set(slug(event.eventCode), event);
  }

  async function ensureClient(company, productManager, manager) {
    const key = slug(company);
    if (clientBySlug.has(key)) return clientBySlug.get(key);
    const client = await prisma.client.create({
      data: {
        company: cellText(company),
        directions: "Не вказано",
        notes: manager ? `Менеджер: ${manager}` : "",
        productManagers: productManager ? { create: { name: productManager } } : undefined
      }
    });
    clientBySlug.set(key, client);
    return client;
  }

  async function ensureEvent(source, dateValue) {
    const key = slug(source);
    for (const [eventKey, event] of eventByKey.entries()) {
      if (eventKey.includes(key) || key.includes(eventKey)) return event;
    }
    const date = parseDate(dateValue) || new Date(Date.UTC(2026, 0, 1));
    const event = await prisma.event.create({
      data: {
        title: cellText(source),
        eventCode: cellText(source),
        startDate: date,
        endDate: date,
        format: "online",
        plannedBudget: 0,
        actualBudget: 0,
        status: eventStatusFromDates(date, date)
      }
    });
    eventByKey.set(key, event);
    return event;
  }

  const paymentRows = rowsOf(workbook, "Оплати_Комісії");
  const deals = [];
  const payments = [];
  for (let r = 2; r < paymentRows.length; r += 1) {
    const row = paymentRows[r] || [];
    const company = cellText(row[3]);
    const eventSource = cellText(row[2]);
    const amount = money(row[9]);
    if (!company || !eventSource || !amount) continue;
    const client = await ensureClient(company, cellText(row[4]), cellText(row[6]));
    const event = await ensureEvent(eventSource, row[1]);
    const statusText = cellText(row[15]).toLowerCase();
    const paymentStatus = statusText.includes("оплач") ? "paid" : statusText.includes("прост") ? "overdue" : "waiting";
    const dealId = `deal_${r + 1}_${slug(eventSource)}_${slug(company)}_${amount}`;
    deals.push({
      id: dealId,
      clientId: client.id,
      eventId: event.id,
      package: cellText(row[5]) || "Індивідуально",
      amount,
      status: cellText(row[8]).includes("100") ? "won" : "proposal",
      paymentStatus
    });
    payments.push({
      id: `payment_${r + 1}_${slug(eventSource)}_${slug(company)}_${amount}`,
      dealId,
      status: paymentStatus,
      dueDate: parseDate(row[13]) || parseDate(row[1]) || new Date(Date.UTC(2026, 0, 1)),
      paidAt: parseDate(row[14]),
      amount,
      actualPaid: paymentStatus === "paid" ? amount : 0
    });
  }
  await createMany(prisma.deal, deals, 200);
  await createMany(prisma.payment, payments, 200);

  const deadlineRows = rowsOf(workbook, "Дедлайн звітів");
  const taskDefs = [
    { type: "doclink", title: "DocLink", assignee: 18, status: 17, link: 16 },
    { type: "event_page", title: "Сторінка", deadline: 19, assignee: 20, status: 21, link: 11 },
    { type: "moz_registration", title: "МОЗ / ТЦ", deadline: 22, factDate: 23, assignee: 24, status: 25 },
    { type: "mailing", title: "Розсилка", deadline: 26, assignee: 27, status: 28 },
    { type: "analytics", title: "Аналітика", assignee: 32, status: 34, link: 33 },
    { type: "client_report", title: "Звіт клієнту", deadline: 36, assignee: 37, status: 38, link: 39 },
    { type: "client_report_6m", title: "Звіт клієнту через 6 місяців", deadline: 40, assignee: 41, status: 42, link: 43 },
    { type: "client_report_12m", title: "Звіт клієнту через 12 місяців", deadline: 44, assignee: 45, status: 46, link: 47 }
  ];
  const tasks = [];
  for (let r = 2; r < deadlineRows.length; r += 1) {
    const row = deadlineRows[r] || [];
    const eventName = cellText(row[2]);
    if (!eventName) continue;
    const event = await ensureEvent(eventName, row[1]);
    for (const def of taskDefs) {
      const checkedIndexes = [def.deadline, def.factDate, def.assignee, def.status, def.link].filter((idx) => idx !== undefined);
      if (!checkedIndexes.some((idx) => cellText(row[idx]))) continue;
      tasks.push({
        id: `task_${r + 1}_${def.type}_${slug(eventName)}_${slug(row[3])}`,
        eventId: event.id,
        type: def.type,
        title: `${def.title}: ${cellText(row[3]) || eventName}`,
        deadline: def.deadline !== undefined ? parseDate(row[def.deadline]) : null,
        factDate: def.factDate !== undefined ? parseDate(row[def.factDate]) : null,
        assignee: def.assignee !== undefined ? cellText(row[def.assignee]) || null : null,
        status: def.status !== undefined ? opStatus(row[def.status]) : "not_started",
        link: def.link !== undefined ? cellText(row[def.link]) || null : null,
        blocker: cellText(row[48]) || null,
        comment: cellText(row[49]) || null,
        nextOwner: cellText(row[50]) || null
      });
    }
  }
  await createMany(prisma.operationTask, tasks, 200);

  const counts = {
    clients: await prisma.client.count(),
    events: await prisma.event.count(),
    deals: await prisma.deal.count(),
    payments: await prisma.payment.count(),
    tasks: await prisma.operationTask.count()
  };
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

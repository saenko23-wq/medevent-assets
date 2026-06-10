const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const workbookPath = process.argv[2] || "medevent-source.xlsx";

function cellText(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
}

function isEmptyRow(row) {
  return row.every((cell) => cellText(cell) === "");
}

function slug(value) {
  return cellText(value)
    .toLowerCase()
    .replace(/[`'"’‘]/g, "")
    .replace(/[^a-zа-яіїєґ0-9]+/giu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function money(value) {
  const text = cellText(value).replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolUa(value) {
  const text = cellText(value).toLowerCase();
  return ["так", "true", "1", "готово", "🟢 готово"].includes(text);
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
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, cellDates: true });
}

function firstNonEmpty(row, indexes) {
  for (const index of indexes) {
    const value = cellText(row[index]);
    if (value) return value;
  }
  return "";
}

function eventStatusFromDates(start, end) {
  const now = new Date();
  if (end && end < now) return "completed";
  if (start && start > now) return "planning";
  return "active";
}

async function ensureRawTables() {
  await prisma.$executeRawUnsafe(`
    create table if not exists "ImportedSheet" (
      id text primary key,
      name text not null unique,
      "rowCount" integer not null,
      "columnCount" integer not null,
      "createdAt" timestamptz not null default now()
    );
  `);
  await prisma.$executeRawUnsafe(`
    create table if not exists "ImportedRow" (
      id text primary key,
      "sheetId" text not null references "ImportedSheet"(id) on delete cascade,
      "rowNumber" integer not null,
      data jsonb not null,
      "createdAt" timestamptz not null default now(),
      unique("sheetId", "rowNumber")
    );
  `);
}

async function clearBusinessData() {
  await prisma.payment.deleteMany();
  await prisma.report.deleteMany();
  await prisma.operationTask.deleteMany();
  await prisma.eventDocument.deleteMany();
  await prisma.eventSlot.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.eventSpeaker.deleteMany();
  await prisma.event.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.productManager.deleteMany();
  await prisma.client.deleteMany();
  await prisma.speaker.deleteMany();
  await prisma.packageFeature.deleteMany();
  await prisma.participationPackage.deleteMany();
  await prisma.referenceItem.deleteMany();
  await prisma.referenceCategory.deleteMany();
  await prisma.$executeRawUnsafe(`delete from "ImportedRow";`);
  await prisma.$executeRawUnsafe(`delete from "ImportedSheet";`);
}

async function importRaw(workbook) {
  for (const name of workbook.SheetNames) {
    const rows = rowsOf(workbook, name);
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const sheetId = `sheet_${slug(name) || "blank"}`;
    await prisma.importedSheet.upsert({
      where: { name },
      update: { rowCount: rows.length, columnCount },
      create: { id: sheetId, name, rowCount: rows.length, columnCount }
    });
    const payload = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (isEmptyRow(row)) continue;
      payload.push({
        id: `${sheetId}_${i + 1}`,
        sheetId,
        rowNumber: i + 1,
        data: row.map(cellText)
      });
    }
    for (let i = 0; i < payload.length; i += 100) {
      await prisma.importedRow.createMany({
        data: payload.slice(i, i + 100),
        skipDuplicates: true
      });
    }
  }
}

async function importReferences(workbook) {
  const rows = rowsOf(workbook, "Довідники");
  const headers = (rows[0] || []).map(cellText);
  const categoryIds = new Map();
  for (let c = 0; c < headers.length; c += 1) {
    const name = headers[c];
    if (!name) continue;
    if (!categoryIds.has(name)) {
      const category = await prisma.referenceCategory.upsert({
        where: { name },
        update: {},
        create: { name },
        select: { id: true }
      });
      categoryIds.set(name, category.id);
    }
  }
  const globalSeen = new Set();
  const items = [];
  for (let c = 0; c < headers.length; c += 1) {
    const name = headers[c];
    if (!name) continue;
    const categoryId = categoryIds.get(name);
    for (let r = 1; r < rows.length; r += 1) {
      const value = cellText(rows[r][c]);
      const key = `${categoryId}::${value.toLowerCase()}`;
      if (!value || globalSeen.has(key)) continue;
      globalSeen.add(key);
      items.push({ categoryId, value });
    }
  }
  for (let i = 0; i < items.length; i += 250) {
    await prisma.referenceItem.createMany({
      data: items.slice(i, i + 250),
      skipDuplicates: true
    });
  }
}

async function importPackages(workbook) {
  const rows = rowsOf(workbook, "Пакети участі");
  const names = (rows[0] || []).slice(1).map(cellText).filter(Boolean);
  for (let i = 0; i < names.length; i += 1) {
    const col = i + 1;
    const pack = await prisma.participationPackage.create({
      data: {
        name: names[i],
        price: money(rows[1]?.[col]) || 0,
        format: cellText(rows[2]?.[col]) || names[i],
        duration: cellText(rows[3]?.[col]) || ""
      },
      select: { id: true }
    });
    for (let r = 4; r < rows.length; r += 1) {
      const feature = cellText(rows[r]?.[0]);
      const value = cellText(rows[r]?.[col]);
      if (!feature || !value) continue;
      await prisma.packageFeature.upsert({
        where: { packageId_name: { packageId: pack.id, name: feature } },
        update: { value },
        create: { packageId: pack.id, name: feature, value }
      });
    }
  }
}

async function getOrCreateClient(company, directions = "", productManager = "", manager = "") {
  const normalized = cellText(company);
  if (!normalized) return null;
  const existing = await prisma.client.findFirst({ where: { company: { equals: normalized, mode: "insensitive" } } });
  if (existing) {
    if (productManager) {
      const hasPm = await prisma.productManager.findFirst({ where: { clientId: existing.id, name: productManager } });
      if (!hasPm) await prisma.productManager.create({ data: { clientId: existing.id, name: productManager } });
    }
    return existing;
  }
  return prisma.client.create({
    data: {
      company: normalized,
      directions: directions || "Не вказано",
      notes: manager ? `Менеджер: ${manager}` : "",
      productManagers: productManager ? { create: { name: productManager } } : undefined
    }
  });
}

async function getOrCreateSpeaker(fullName, specialization = "") {
  const normalized = cellText(fullName);
  if (!normalized) return null;
  const existing = await prisma.speaker.findFirst({ where: { fullName: { equals: normalized, mode: "insensitive" } } });
  if (existing) return existing;
  return prisma.speaker.create({
    data: {
      fullName: normalized,
      phone: "",
      specialization: specialization || "Не вказано"
    }
  });
}

function isEventSheet(name) {
  const trimmed = name.trim();
  return trimmed.startsWith("🎓") && !trimmed.includes("TEMPLATE") && !trimmed.startsWith("STD_");
}

async function importEventSheets(workbook) {
  const eventMap = new Map();
  for (const sheetName of workbook.SheetNames.filter(isEventSheet)) {
    const rows = rowsOf(workbook, sheetName);
    const info = rows[2] || [];
    const title = cellText(rows[0]?.[1]) || sheetName.trim();
    const startDate = parseDate(info[1]) || new Date(Date.UTC(2026, 0, 1));
    const endDate = parseDate(info[2]) || startDate;
    const event = await prisma.event.create({
      data: {
        title: title.replace(/^📅\s*/, ""),
        eventCode: cellText(info[0]) || sheetName.trim().replace(/^🎓\s*/, ""),
        startDate,
        endDate,
        format: cellText(info[3])?.toLowerCase().includes("оф") ? "offline" : "online",
        formatDetails: cellText(info[3]),
        talkCount: Number(cellText(info[4])) || 0,
        nonPharmaCount: Number(cellText(info[5])) || 0,
        pageUrl: cellText(info[6]) || null,
        programDraftUrl: cellText(info[8]) || null,
        slotPrice: cellText(info[10]) || null,
        plannedBudget: money(info[11]) || 0,
        actualBudget: money(info[12]) || 0,
        averageCheck: money(info[13]) || 0,
        totalSpeakerHonorarium: money(info[14]) || 0,
        youtubeDay1Url: cellText(info[16]) || null,
        youtubeDay2Url: cellText(info[17]) || null,
        status: eventStatusFromDates(startDate, endDate)
      }
    });
    eventMap.set(sheetName.trim().replace(/^🎓\s*/, ""), event);

    for (let r = 4; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const rowNumber = Number(cellText(row[0])) || null;
      const rowType = cellText(row[1]);
      const company = cellText(row[2]);
      const speakerName = cellText(row[9]);
      const talkTitle = cellText(row[15]);
      if (!rowType && !company && !speakerName && !talkTitle) continue;
      const client = company && company.toLowerCase() !== "medevent"
        ? await getOrCreateClient(company, cellText(row[19]), cellText(row[3]), cellText(row[4]))
        : null;
      const speaker = await getOrCreateSpeaker(speakerName, cellText(row[19]));
      if (speaker) {
        await prisma.eventSpeaker.upsert({
          where: { eventId_speakerId: { eventId: event.id, speakerId: speaker.id } },
          update: {},
          create: { eventId: event.id, speakerId: speaker.id, role: cellText(row[10]) || null }
        });
      }
      await prisma.eventSlot.create({
        data: {
          eventId: event.id,
          rowNumber,
          rowType: rowType || "Партнер",
          clientId: client?.id || null,
          productManager: cellText(row[3]) || null,
          manager: cellText(row[4]) || null,
          salesStatus: cellText(row[5]) || "Лід",
          package: cellText(row[6]) || "Індивідуально",
          price: money(row[7]),
          crmSource: cellText(row[8]) || null,
          speakerId: speaker?.id || null,
          speakerName: speakerName || null,
          participationFormat: cellText(row[10]) || null,
          contact: cellText(row[11]) || null,
          speakerHonorarium: money(row[12]),
          honorariumPayer: cellText(row[13]) || null,
          honorariumPaymentStatus: cellText(row[14]) || null,
          talkTitle: talkTitle || null,
          brandTopic: cellText(row[16]) || null,
          studioRecord: cellText(row[17]) || null,
          duration: cellText(row[18]) || null,
          direction: cellText(row[19]) || null,
          draftSent: boolUa(row[20]),
          documentsSent: boolUa(row[21]),
          reportSent: boolUa(row[22]),
          programComment: cellText(row[23]) || null,
          managerComment: cellText(row[24]) || null,
          technicalKey: `${slug(sheetName)}|${r + 1}|${slug(company)}|${slug(speakerName)}`
        }
      });
    }
  }
  return eventMap;
}

async function importPlanClients(workbook) {
  const rows = rowsOf(workbook, "План_продажів");
  for (let r = 15; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const company = cellText(row[1]);
    const product = cellText(row[2]);
    const direction = cellText(row[3]);
    const manager = cellText(row[4]);
    if (!company || company === "MedEvent") continue;
    await getOrCreateClient(company, direction, product, manager);
  }
}

async function importPayments(workbook) {
  const rows = rowsOf(workbook, "Оплати_Комісії");
  for (let r = 2; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const company = cellText(row[3]);
    const eventSource = cellText(row[2]);
    const amount = money(row[9]);
    if (!company || !eventSource || !amount) continue;
    const client = await getOrCreateClient(company, "", cellText(row[4]), cellText(row[6]));
    let event = await prisma.event.findFirst({
      where: {
        OR: [
          { title: { contains: eventSource, mode: "insensitive" } },
          { eventCode: { contains: eventSource, mode: "insensitive" } }
        ]
      }
    });
    if (!event) {
      const date = parseDate(row[1]) || new Date(Date.UTC(2026, 0, 1));
      event = await prisma.event.create({
        data: {
          title: eventSource,
          eventCode: eventSource,
          startDate: date,
          endDate: date,
          format: "online",
          plannedBudget: 0,
          actualBudget: 0,
          status: eventStatusFromDates(date, date)
        }
      });
    }
    const statusText = cellText(row[15]).toLowerCase();
    const paymentStatus = statusText.includes("оплач") ? "paid" : statusText.includes("прост") ? "overdue" : "waiting";
    const deal = await prisma.deal.create({
      data: {
        clientId: client.id,
        eventId: event.id,
        package: cellText(row[5]) || "Індивідуально",
        amount,
        planAmount: amount,
        factAmount: amount,
        paidAmount: paymentStatus === "paid" ? amount : 0,
        productManager: cellText(row[4]) || null,
        manager: cellText(row[6]) || null,
        status: cellText(row[8]).includes("100") ? "won" : "proposal",
        paymentStatus,
        paymentDeadline: parseDate(row[13]) || null,
        reportDeadline: parseDate(row[11]) || null,
        comment: cellText(row[20]) || null
      }
    });
    await prisma.payment.create({
      data: {
        dealId: deal.id,
        status: paymentStatus,
        dueDate: parseDate(row[13]) || parseDate(row[1]) || new Date(Date.UTC(2026, 0, 1)),
        paidAt: parseDate(row[14]),
        amount,
        actualPaid: paymentStatus === "paid" ? amount : 0
      }
    });
  }
}

function opStatus(value) {
  const text = cellText(value).toLowerCase();
  if (text.includes("готов")) return "ready";
  if (text.includes("блок") || text.includes("проблем")) return "blocked";
  if (text.includes("робот")) return "in_progress";
  return "not_started";
}

async function importDeadlines(workbook) {
  const rows = rowsOf(workbook, "Дедлайн звітів");
  const taskDefs = [
    { type: "doclink", title: "DocLink", deadline: null, assignee: 18, status: 17, link: 16 },
    { type: "event_page", title: "Сторінка", deadline: 19, assignee: 20, status: 21, link: 11 },
    { type: "moz_registration", title: "МОЗ / ТЦ", deadline: 22, factDate: 23, assignee: 24, status: 25 },
    { type: "mailing", title: "Розсилка", deadline: 26, assignee: 27, status: 28 },
    { type: "analytics", title: "Аналітика", assignee: 32, status: 34, link: 33 },
    { type: "client_report", title: "Звіт клієнту", deadline: 36, assignee: 37, status: 38, link: 39 },
    { type: "client_report_6m", title: "Звіт клієнту через 6 місяців", deadline: 40, assignee: 41, status: 42, link: 43 },
    { type: "client_report_12m", title: "Звіт клієнту через 12 місяців", deadline: 44, assignee: 45, status: 46, link: 47 }
  ];
  for (let r = 2; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const eventName = cellText(row[2]);
    if (!eventName) continue;
    let event = await prisma.event.findFirst({ where: { title: { contains: eventName, mode: "insensitive" } } });
    if (!event) {
      const date = parseDate(row[1]) || new Date(Date.UTC(2026, 0, 1));
      event = await prisma.event.create({
        data: {
          title: eventName,
          eventCode: eventName,
          startDate: date,
          endDate: date,
          format: "online",
          plannedBudget: 0,
          actualBudget: 0,
          status: eventStatusFromDates(date, date)
        }
      });
    }
    for (const def of taskDefs) {
      const hasAny = [def.deadline, def.factDate, def.assignee, def.status, def.link]
        .filter((v) => v !== undefined && v !== null)
        .some((idx) => cellText(row[idx]));
      if (!hasAny) continue;
      await prisma.operationTask.create({
        data: {
          eventId: event.id,
          type: def.type,
          title: `${def.title}: ${cellText(row[3]) || eventName}`,
          deadline: def.deadline !== undefined && def.deadline !== null ? parseDate(row[def.deadline]) : null,
          factDate: def.factDate !== undefined ? parseDate(row[def.factDate]) : null,
          assignee: def.assignee !== undefined ? cellText(row[def.assignee]) || null : null,
          status: def.status !== undefined ? opStatus(row[def.status]) : "not_started",
          link: def.link !== undefined ? cellText(row[def.link]) || null : null,
          blocker: cellText(row[48]) || null,
          comment: cellText(row[49]) || null,
          nextOwner: cellText(row[50]) || null
        }
      });
    }
  }
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  await ensureRawTables();
  await clearBusinessData();
  await importRaw(workbook);
  await importReferences(workbook);
  await importPackages(workbook);
  await importPlanClients(workbook);
  await importEventSheets(workbook);
  await importPayments(workbook);
  await importDeadlines(workbook);

  const counts = {
    importedSheets: await prisma.$queryRawUnsafe(`select count(*)::int as count from "ImportedSheet"`),
    importedRows: await prisma.$queryRawUnsafe(`select count(*)::int as count from "ImportedRow"`),
    clients: await prisma.client.count(),
    speakers: await prisma.speaker.count(),
    events: await prisma.event.count(),
    slots: await prisma.eventSlot.count(),
    deals: await prisma.deal.count(),
    payments: await prisma.payment.count(),
    tasks: await prisma.operationTask.count(),
    references: await prisma.referenceItem.count()
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

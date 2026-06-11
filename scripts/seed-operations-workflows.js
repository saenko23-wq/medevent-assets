const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const deals = await prisma.deal.findMany({ include: { event: true, client: true } });
  let documentWorkflows = 0;
  for (const deal of deals) {
    const existing = await prisma.documentWorkflow.count({ where: { dealId: deal.id } });
    if (existing) continue;
    const deadline = deal.paymentDeadline || deal.reportDeadline || deal.event.startDate;
    await prisma.documentWorkflow.createMany({
      data: [
        {
          eventId: deal.eventId,
          dealId: deal.id,
          documentType: "contract",
          status: deal.status === "won" ? "PREPARING" : "NOT_STARTED",
          deadlineAt: deadline,
          owner: "docs",
          comment: `Auto-created for ${deal.client.company} / ${deal.package}`
        },
        {
          eventId: deal.eventId,
          dealId: deal.id,
          documentType: "act",
          status: deal.paymentStatus === "paid" ? "PREPARING" : "NOT_STARTED",
          deadlineAt: deal.reportDeadline || deadline,
          owner: "docs",
          comment: "Auto-created from deal/payment source"
        }
      ]
    });
    documentWorkflows += 2;
  }

  const documents = await prisma.eventDocument.findMany();
  let files = 0;
  for (const document of documents) {
    const existing = await prisma.fileAttachment.count({
      where: { eventId: document.eventId, fileUrl: document.url, fileName: document.title }
    });
    if (existing) continue;
    await prisma.fileAttachment.create({
      data: {
        eventId: document.eventId,
        fileName: document.title,
        fileUrl: document.url,
        fileType: document.type,
        uploadedBy: document.owner || "migration"
      }
    });
    files += 1;
  }

  console.log(JSON.stringify({ documentWorkflows, files }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

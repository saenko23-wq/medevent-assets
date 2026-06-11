"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMoney } from "@/lib/format";

async function requireEditor() {
  const session = await getServerSession(authOptions);
  const role = session?.user.role?.toLowerCase();
  if (!role || !["admin", "manager", "operations", "head_of_sales", "sales_manager", "project_manager", "docs_manager", "finance_manager", "reports_manager"].includes(role)) {
    throw new Error("Недостатньо прав для зміни даних.");
  }
  return session!;
}

function decimalFrom(formData: FormData, key: string) {
  return Number(formData.get(key) || 0);
}

function nullableDate(formData: FormData, key: string) {
  const value = String(formData.get(key) || "");
  return value ? new Date(value) : null;
}

function normalizePackageCode(value: string) {
  const text = value.toUpperCase();
  if (text.includes("PLUS")) return "PLUS";
  if (text.includes("MONO")) return "MONO";
  if (text.includes("COMBO")) return "COMBO";
  if (text.includes("STANDART") || text.includes("STANDARD")) return "STANDART";
  return text;
}

function normalizeRowType(value: string) {
  return value.toLowerCase().includes("без фарм") || value === "MEDEVENT_PROGRAM" ? "MEDEVENT_PROGRAM" : "PARTNER";
}

async function createPackageTasks(eventId: string, slotId: string, packageCode: string) {
  const templates = await prisma.packageServiceTemplate.findMany({ where: { packageCode } });
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  if (!templates.length) return;

  await prisma.operationTask.createMany({
    data: templates.map((template) => ({
      eventId,
      slotId,
      type: "custom",
      process: template.process,
      group: "Package tasks",
      title: template.title,
      description: template.requiredInputs ? `Required inputs: ${template.requiredInputs}` : null,
      deadline,
      deadlineState: "soon",
      status: "not_started",
      ownerRole: template.defaultOwnerRole,
      source: "auto_package",
      packageCode
    })),
    skipDuplicates: true
  });
}

export async function createClient(formData: FormData) {
  await requireEditor();
  await prisma.client.create({
    data: {
      company: String(formData.get("company")),
      directions: String(formData.get("directions")),
      notes: String(formData.get("notes") || ""),
      productManagers: {
        create: {
          name: String(formData.get("managerName")),
          email: String(formData.get("managerEmail") || ""),
          phone: String(formData.get("managerPhone") || "")
        }
      },
      contacts: {
        create: {
          name: String(formData.get("contactName")),
          position: String(formData.get("contactPosition") || ""),
          email: String(formData.get("contactEmail") || ""),
          phone: String(formData.get("contactPhone") || "")
        }
      }
    }
  });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function createSpeaker(formData: FormData) {
  await requireEditor();
  await prisma.speaker.create({
    data: {
      fullName: String(formData.get("fullName")),
      phone: String(formData.get("phone")),
      specialization: String(formData.get("specialization"))
    }
  });
  revalidatePath("/speakers");
  redirect("/speakers");
}

export async function createEvent(formData: FormData) {
  await requireEditor();
  await prisma.event.create({
    data: {
      title: String(formData.get("title")),
      eventCode: String(formData.get("eventCode") || ""),
      pageUrl: String(formData.get("pageUrl") || ""),
      formatDetails: String(formData.get("formatDetails") || ""),
      startDate: new Date(String(formData.get("startDate"))),
      endDate: new Date(String(formData.get("endDate"))),
      format: String(formData.get("format")) as "offline" | "online" | "hybrid",
      plannedBudget: decimalFrom(formData, "plannedBudget"),
      actualBudget: decimalFrom(formData, "actualBudget"),
      averageCheck: decimalFrom(formData, "averageCheck"),
      totalSpeakerHonorarium: decimalFrom(formData, "totalSpeakerHonorarium"),
      status: String(formData.get("status")) as "draft" | "planning" | "active" | "completed" | "cancelled"
    }
  });
  revalidatePath("/events");
  redirect("/events");
}

export async function createReferenceItem(formData: FormData) {
  await requireEditor();
  const categoryName = String(formData.get("categoryName") || "");
  const categoryId = String(formData.get("categoryId") || "");
  const value = String(formData.get("value"));
  const notes = String(formData.get("notes") || "");

  const category = categoryId
    ? { connect: { id: categoryId } }
    : { connectOrCreate: { where: { name: categoryName }, create: { name: categoryName } } };

  await prisma.referenceItem.create({
    data: { value, notes, category }
  });
  revalidatePath("/references");
  redirect("/references");
}

export async function createEventSlot(formData: FormData) {
  await requireEditor();
  const eventId = String(formData.get("eventId"));
  const clientId = String(formData.get("clientId") || "");
  const rowType = String(formData.get("rowType"));
  const rowTypeNormalized = normalizeRowType(rowType);
  const packageName = String(formData.get("package") || "Standart");
  const packageCode = normalizePackageCode(packageName);
  const missingInputs = [
    ["company", clientId],
    ["product_manager", String(formData.get("productManager") || "")],
    ["speaker", String(formData.get("speakerName") || "")],
    ["topic", String(formData.get("talkTitle") || "")],
    ["drug_or_brand", String(formData.get("brandTopic") || "")],
    ["speaker_participation_mode", String(formData.get("studioRecord") || "")]
  ].filter(([, value]) => !value).map(([key]) => key);

  const slot = await prisma.eventSlot.create({
    data: {
      eventId,
      rowType,
      rowTypeNormalized,
      clientId: clientId || null,
      productManager: String(formData.get("productManager") || ""),
      manager: String(formData.get("manager") || ""),
      salesStatus: String(formData.get("salesStatus") || "Лід"),
      package: packageName,
      price: parseMoney(formData.get("price")),
      crmSource: String(formData.get("crmSource") || "CRM"),
      speakerName: String(formData.get("speakerName") || ""),
      participationFormat: String(formData.get("participationFormat") || ""),
      speakerParticipationMode: String(formData.get("speakerParticipationMode") || ""),
      contact: String(formData.get("contact") || ""),
      speakerHonorarium: parseMoney(formData.get("speakerHonorarium")),
      honorariumPayer: String(formData.get("honorariumPayer") || ""),
      honorariumPaymentStatus: String(formData.get("honorariumPaymentStatus") || ""),
      talkTitle: String(formData.get("talkTitle") || ""),
      brandTopic: String(formData.get("brandTopic") || ""),
      studioRecord: String(formData.get("studioRecord") || ""),
      duration: String(formData.get("duration") || ""),
      direction: String(formData.get("direction") || ""),
      programComment: String(formData.get("programComment") || ""),
      managerComment: String(formData.get("managerComment") || ""),
      missingInputs: missingInputs.length ? missingInputs.join(",") : null
    }
  });
  if (rowTypeNormalized === "PARTNER") {
    await createPackageTasks(eventId, slot.id, packageCode);
  }
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function createOperationTask(formData: FormData) {
  await requireEditor();
  const eventId = String(formData.get("eventId"));
  const deadline = String(formData.get("deadline") || "");
  const factDate = String(formData.get("factDate") || "");
  await prisma.operationTask.create({
    data: {
      eventId,
      type: String(formData.get("type")) as "doclink" | "event_page" | "moz_registration" | "mailing" | "analytics" | "client_report" | "client_report_6m" | "client_report_12m" | "draft_program" | "documents" | "custom",
      title: String(formData.get("title")),
      deadline: deadline ? new Date(deadline) : null,
      factDate: factDate ? new Date(factDate) : null,
      assignee: String(formData.get("assignee") || ""),
      status: String(formData.get("status")) as "not_started" | "in_progress" | "ready" | "blocked",
      link: String(formData.get("link") || ""),
      blocker: String(formData.get("blocker") || ""),
      comment: String(formData.get("comment") || ""),
      nextOwner: String(formData.get("nextOwner") || "")
    }
  });
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/calendar");
  redirect(`/events/${eventId}`);
}

export async function createDeal(formData: FormData) {
  await requireEditor();
  const amount = decimalFrom(formData, "amount");
  const paymentDeadline = String(formData.get("paymentDeadline") || "");
  const reportDeadline = String(formData.get("reportDeadline") || "");
  await prisma.deal.create({
    data: {
      clientId: String(formData.get("clientId")),
      eventId: String(formData.get("eventId")),
      package: String(formData.get("package")) as "Standart" | "Plus" | "Mono" | "Combo",
      amount,
      planAmount: decimalFrom(formData, "planAmount") || amount,
      factAmount: decimalFrom(formData, "factAmount") || amount,
      paidAmount: decimalFrom(formData, "paidAmount"),
      productManager: String(formData.get("productManager") || ""),
      manager: String(formData.get("manager") || ""),
      status: String(formData.get("status")) as "lead" | "proposal" | "won" | "lost",
      paymentStatus: String(formData.get("paymentStatus")) as "paid" | "waiting" | "overdue" | "can_request",
      paymentDeadline: paymentDeadline ? new Date(paymentDeadline) : null,
      reportDeadline: reportDeadline ? new Date(reportDeadline) : null,
      comment: String(formData.get("comment") || "")
    }
  });
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  redirect("/deals");
}

export async function updateDealFromDashboard(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const paymentDeadline = String(formData.get("paymentDeadline") || "");
  const reportDeadline = String(formData.get("reportDeadline") || "");
  const before = await prisma.deal.findUnique({ where: { id } });
  const updated = await prisma.deal.update({
    where: { id },
    data: {
      clientId: String(formData.get("clientId")),
      eventId: String(formData.get("eventId")),
      package: String(formData.get("package") || "Індивідуально"),
      amount: decimalFrom(formData, "factAmount"),
      planAmount: decimalFrom(formData, "planAmount"),
      factAmount: decimalFrom(formData, "factAmount"),
      paidAmount: decimalFrom(formData, "paidAmount"),
      productManager: String(formData.get("productManager") || ""),
      manager: String(formData.get("manager") || ""),
      status: String(formData.get("status")),
      paymentStatus: String(formData.get("paymentStatus")),
      paymentDeadline: paymentDeadline ? new Date(paymentDeadline) : null,
      reportDeadline: reportDeadline ? new Date(reportDeadline) : null,
      comment: String(formData.get("comment") || ""),
      archived: formData.get("archived") === "on"
    }
  });
  await prisma.activityLog.create({
    data: {
      eventId: updated.eventId,
      entityType: "PAYMENT",
      entityId: updated.id,
      userId: session.user.id,
      action: "update_deal",
      before: before as any,
      after: updated as any
    }
  });
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath(`/events/${updated.eventId}`);
}

export async function createReport(formData: FormData) {
  await requireEditor();
  await prisma.report.create({
    data: {
      title: String(formData.get("title")),
      deadline: new Date(String(formData.get("deadline"))),
      status: String(formData.get("status")) as "not_started" | "ready",
      eventId: String(formData.get("eventId")),
      assigneeId: String(formData.get("assigneeId"))
    }
  });
  revalidatePath("/reports");
  redirect("/reports");
}

export async function createPayment(formData: FormData) {
  await requireEditor();
  const paidAtValue = String(formData.get("paidAt") || "");
  await prisma.payment.create({
    data: {
      dealId: String(formData.get("dealId")),
      status: String(formData.get("status")) as "paid" | "waiting" | "overdue" | "can_request",
      dueDate: new Date(String(formData.get("dueDate"))),
      paidAt: paidAtValue ? new Date(paidAtValue) : null,
      amount: decimalFrom(formData, "amount"),
      actualPaid: decimalFrom(formData, "actualPaid")
    }
  });
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect("/payments");
}

export async function updateOperationTask(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.operationTask.findUnique({ where: { id } });
  if (!before) throw new Error("Task not found");

  const updated = await prisma.operationTask.update({
    where: { id },
    data: {
      status: String(formData.get("status") || before.status),
      deadline: nullableDate(formData, "deadline"),
      ownerRole: String(formData.get("ownerRole") || before.ownerRole || ""),
      assignee: String(formData.get("assignee") || before.assignee || ""),
      nextStep: String(formData.get("nextStep") || ""),
      comment: String(formData.get("comment") || "")
    }
  });

  await prisma.activityLog.create({
    data: {
      eventId: updated.eventId,
      entityType: "TASK",
      entityId: updated.id,
      userId: session.user.id,
      action: "update_task",
      before: before as any,
      after: updated as any
    }
  });

  revalidatePath(`/events/${updated.eventId}`);
  revalidatePath("/workspace/deadlines");
}

export async function createDocumentWorkflow(formData: FormData) {
  const session = await requireEditor();
  const eventId = String(formData.get("eventId"));
  const dealId = String(formData.get("dealId") || "");
  const workflow = await prisma.documentWorkflow.create({
    data: {
      eventId,
      dealId: dealId || null,
      documentType: String(formData.get("documentType") || "contract"),
      status: String(formData.get("status") || "NOT_STARTED"),
      sentAt: nullableDate(formData, "sentAt"),
      deadlineAt: nullableDate(formData, "deadlineAt"),
      owner: String(formData.get("owner") || ""),
      fileUrl: String(formData.get("fileUrl") || ""),
      comment: String(formData.get("comment") || "")
    }
  });

  await prisma.activityLog.create({
    data: {
      eventId,
      entityType: "DOCUMENT",
      entityId: workflow.id,
      userId: session.user.id,
      action: "create_document_workflow",
      after: workflow as any
    }
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/workspace/docs");
}

export async function createFileAttachment(formData: FormData) {
  const session = await requireEditor();
  const eventId = String(formData.get("eventId"));
  const file = await prisma.fileAttachment.create({
    data: {
      eventId,
      dealId: String(formData.get("dealId") || "") || null,
      taskId: String(formData.get("taskId") || "") || null,
      documentWorkflowId: String(formData.get("documentWorkflowId") || "") || null,
      fileName: String(formData.get("fileName")),
      fileUrl: String(formData.get("fileUrl")),
      fileType: String(formData.get("fileType") || ""),
      uploadedBy: session.user.email || session.user.name || ""
    }
  });

  await prisma.activityLog.create({
    data: {
      eventId,
      entityType: "EVENT",
      entityId: eventId,
      userId: session.user.id,
      action: "attach_file",
      after: file as any
    }
  });

  revalidatePath(`/events/${eventId}`);
}

export async function createActivityComment(formData: FormData) {
  const session = await requireEditor();
  const eventId = String(formData.get("eventId"));
  await prisma.activityLog.create({
    data: {
      eventId,
      entityType: String(formData.get("entityType") || "EVENT"),
      entityId: String(formData.get("entityId") || eventId),
      userId: session.user.id,
      action: "comment",
      comment: String(formData.get("comment") || "")
    }
  });

  revalidatePath(`/events/${eventId}`);
}

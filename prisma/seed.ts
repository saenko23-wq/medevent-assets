import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("medevent2026", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@medevent.local" },
    update: {},
    create: {
      name: "Адміністратор MedEvent",
      email: "admin@medevent.local",
      passwordHash,
      role: "admin"
    }
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@medevent.local" },
    update: {},
    create: {
      name: "Олена Менеджер",
      email: "manager@medevent.local",
      passwordHash,
      role: "manager"
    }
  });

  const cardio = await prisma.client.create({
    data: {
      company: "CardioNova Ukraine",
      directions: "Кардіологія, сімейна медицина",
      notes: "Ключовий клієнт для регіональних шкіл.",
      productManagers: {
        create: [{ name: "Ірина Коваленко", email: "iryna@cardionova.ua", phone: "+380671112233" }]
      },
      contacts: {
        create: [{ name: "Марко Савчук", position: "Marketing Lead", email: "marko@cardionova.ua", phone: "+380501112244" }]
      }
    }
  });

  const derma = await prisma.client.create({
    data: {
      company: "DermaLife",
      directions: "Дерматологія, естетична медицина",
      productManagers: {
        create: [{ name: "Анна Бойко", email: "anna@dermalife.ua", phone: "+380931234567" }]
      },
      contacts: {
        create: [{ name: "Світлана Миронюк", position: "Brand Manager", email: "svitlana@dermalife.ua" }]
      }
    }
  });

  const speaker1 = await prisma.speaker.create({
    data: {
      fullName: "д-р Андрій Мельник",
      phone: "+380671234001",
      specialization: "Інтервенційна кардіологія"
    }
  });

  const speaker2 = await prisma.speaker.create({
    data: {
      fullName: "проф. Наталія Гончар",
      phone: "+380501234002",
      specialization: "Дерматологія"
    }
  });

  const event1 = await prisma.event.create({
    data: {
      title: "Кардіо Академія 2026",
      eventCode: "CARDIO-01",
      startDate: new Date("2026-07-18"),
      endDate: new Date("2026-07-19"),
      format: "hybrid",
      formatDetails: "2 дні | гібрид",
      plannedBudget: 420000,
      actualBudget: 375000,
      status: "planning",
      eventSpeakers: { create: [{ speakerId: speaker1.id, role: "Головний спікер" }] }
    }
  });

  const event2 = await prisma.event.create({
    data: {
      title: "Derma Update: літня школа",
      eventCode: "DERMA-01",
      startDate: new Date("2026-06-28"),
      endDate: new Date("2026-06-28"),
      format: "offline",
      formatDetails: "1 день | офлайн",
      plannedBudget: 180000,
      actualBudget: 155000,
      status: "active",
      eventSpeakers: { create: [{ speakerId: speaker2.id, role: "Модератор" }] }
    }
  });

  const deal1 = await prisma.deal.create({
    data: {
      clientId: cardio.id,
      eventId: event1.id,
      package: "Combo",
      amount: 620000,
      status: "proposal",
      paymentStatus: "can_request"
    }
  });

  const deal2 = await prisma.deal.create({
    data: {
      clientId: derma.id,
      eventId: event2.id,
      package: "Plus",
      amount: 240000,
      status: "won",
      paymentStatus: "paid"
    }
  });

  await prisma.payment.createMany({
    data: [
      {
        dealId: deal1.id,
        status: "can_request",
        dueDate: new Date("2026-06-20"),
        amount: 310000,
        actualPaid: 0
      },
      {
        dealId: deal2.id,
        status: "paid",
        dueDate: new Date("2026-06-05"),
        paidAt: new Date("2026-06-04"),
        amount: 240000,
        actualPaid: 240000
      }
    ]
  });

  await prisma.report.createMany({
    data: [
      {
        title: "Постівент-звіт для CardioNova",
        deadline: new Date("2026-07-26"),
        status: "not_started",
        eventId: event1.id,
        assigneeId: manager.id
      },
      {
        title: "Фінальний звіт DermaLife",
        deadline: new Date("2026-06-12"),
        status: "not_started",
        eventId: event2.id,
        assigneeId: admin.id
      }
    ]
  });

  const packageMatrix = [
    {
      name: "Standart",
      price: 35910,
      format: "Виступ у конференції",
      duration: "20 хв + 5 хв Q&A",
      features: {
        "Інтеграція продукту": "1 згадка",
        "Вибір часу виступу": "Ні",
        "Промосторінка продукту": "Ні",
        "Розміщення на платформі": "Ні",
        "Аналітика": "Базова",
        "NPS": "Так"
      }
    },
    {
      name: "Plus",
      price: 53820,
      format: "Виступ + digital-підсилення",
      duration: "20 хв + 5 хв Q&A",
      features: {
        "Інтеграція продукту": "1-2 згадки",
        "Вибір часу виступу": "Так",
        "Промосторінка продукту": "Так",
        "Розсилка": "Так (на сторінку продукту)",
        "DocLink": "Так",
        "Аналітика": "Детальна"
      }
    },
    {
      name: "Mono",
      price: 49500,
      format: "Окремий захід під продукт",
      duration: "до 2 год + 10-15 хв Q&A",
      features: {
        "Інтеграція продукту": "2-3 згадки",
        "Промосторінка продукту": "Так",
        "Опитування лікарів": "Так",
        "DocLink": "Так",
        "Аналітика": "Детальна"
      }
    },
    {
      name: "Combo",
      price: 67500,
      format: "Конференція + Mono",
      duration: "30 хв + 5 хв Q&A + Mono до 2 год",
      features: {
        "Інтеграція продукту": "2-3 згадки",
        "Розсилка": "Так (кілька разів)",
        "Додатковий відеоконтент": "Так (shorts / reels)",
        "DocLink": "Так",
        "Аналітика": "Детальна"
      }
    }
  ];

  for (const item of packageMatrix) {
    await prisma.participationPackage.create({
      data: {
        name: item.name,
        price: item.price,
        format: item.format,
        duration: item.duration,
        features: {
          create: Object.entries(item.features).map(([name, value]) => ({ name, value }))
        }
      }
    });
  }

  const references: Record<string, string[]> = {
    "Статуси продажу": ["Лід", "Перемовини", "50% погоджено", "100% погоджено", "Відмова", "Без фарм", "Скасовано", "Архів"],
    "Тривалість": ["20+5 хв", "30+5 хв", "пів дня", "цілий день", "15+5 хв", "120 хв"],
    "Тип рядка": ["Партнер", "Без фарм", "Службовий"],
    "Пакети": ["Standart", "Plus", "Mono", "Combo", "Індивідуально", "Входить у пакет"],
    "Менеджери": ["Марина", "Олександра", "Діана", "Юлія", "Наталія"],
    "Так/Ні": ["Так", "Ні"],
    "Статус реалізації": ["Підготовка", "В роботі", "Готово", "Проблема", "Архів"],
    "Формат участі": ["Доповідь", "МК", "Модерація", "Стенд", "Стенд + доповідь", "Фахова дискусія"],
    "Студія/запис": ["Онлайн", "Офлайн", "Студія", "Запис", "Зум"],
    "Хто оплачує гонорар": ["Не потрібно", "Фарма через MedEvent", "Фарма напряму", "MedEvent", "Без гонорару", "Уточнити"],
    "Статус оплати гонорару": ["Не потрібно", "Очікує дані", "Очікує оплату", "В роботі", "Оплачено", "Проблема"],
    "Тип події": ["Конгрес онлайн", "Велика конференція", "Мала подія", "Mono", "Практикум 360", "Щоденник", "Індивідуальна подія"]
  };

  for (const [name, values] of Object.entries(references)) {
    await prisma.referenceCategory.create({
      data: {
        name,
        items: { create: values.map((value) => ({ value })) }
      }
    });
  }

  const neuro = await prisma.event.create({
    data: {
      eventCode: "ПН-01",
      title: "NEURO-PSYCHO 5.0 «Стійкість у стресових умовах»",
      pageUrl: "https://medevent.academy/product/neuro-psycho-5-0-stijkist-u-stresovyh-umovah-vyrishennia-nevrologichnyh-ta-psyhologichnyh-problem-sogodennia/",
      programDraftUrl: "https://docs.google.com/document/d/1aWyMuXdqELYLa1qyvFnsqND04EieDQ4p/edit",
      youtubeDay1Url: "https://youtu.be/CZHO1EXLWgc",
      youtubeDay2Url: "https://youtu.be/bRsbJZ5U3cM",
      startDate: new Date("2026-05-14"),
      endDate: new Date("2026-05-15"),
      format: "online",
      formatDetails: "2 дні | 14 год | 10 БПР",
      talkCount: 33,
      nonPharmaCount: 19,
      slotPrice: "35 000-75 000 грн",
      plannedBudget: 1485000,
      actualBudget: 640070,
      averageCheck: 37651,
      totalSpeakerHonorarium: 32000,
      status: "completed"
    }
  });

  await prisma.eventSlot.createMany({
    data: [
      {
        eventId: neuro.id,
        rowNumber: 6,
        rowType: "Партнер",
        clientId: cardio.id,
        productManager: "Юлія Ковтун",
        manager: "Олександра",
        salesStatus: "100% погоджено",
        package: "Standart",
        price: 29750,
        crmSource: "CRM",
        speakerName: "Боженко Наталія Леонідівна",
        participationFormat: "Доповідь",
        honorariumPayer: "Не потрібно",
        honorariumPaymentStatus: "Не потрібно",
        talkTitle: "Раціональна фармакотерапія болю: баланс ефективності та безпеки",
        brandTopic: "Нейродикловіт",
        studioRecord: "ЗАПИС",
        duration: "20+5 хв",
        direction: "Остеоартрит, Неврологія, Сімейна медицина",
        draftSent: true,
        documentsSent: true,
        reportSent: true,
        programComment: "Запис 12.05 на 14:00."
      },
      {
        eventId: neuro.id,
        rowNumber: 11,
        rowType: "Партнер",
        clientId: derma.id,
        productManager: "Гончаренко Іван",
        manager: "Олександра",
        salesStatus: "100% погоджено",
        package: "Plus",
        price: 40000,
        crmSource: "CRM",
        speakerName: "Орос Михайло Михайлович",
        participationFormat: "Доповідь",
        talkTitle: "Епізодичне головокружіння: перше описане Проспером",
        brandTopic: "Авера (Avero)",
        studioRecord: "ЗУМ",
        duration: "20+5 хв",
        direction: "Неврологія, Травматологія, Сімейна медицина",
        draftSent: true,
        documentsSent: true,
        reportSent: true,
        managerComment: "Ставити 15.05 після 14:00."
      },
      {
        eventId: neuro.id,
        rowNumber: 20,
        rowType: "Без фарм",
        productManager: "Програма",
        manager: "Діана",
        salesStatus: "Без фарм",
        package: "Індивідуально",
        speakerName: "Довбонос Тетяна Анатоліївна",
        participationFormat: "Модерація",
        speakerHonorarium: 8000,
        honorariumPayer: "MedEvent",
        honorariumPaymentStatus: "Очікує оплату",
        talkTitle: "Модератор 14.05.26 (цілий день)",
        studioRecord: "СТУДІЯ",
        duration: "цілий день"
      }
    ]
  });

  await prisma.operationTask.createMany({
    data: [
      {
        eventId: neuro.id,
        type: "event_page",
        title: "Сторінка заходу",
        deadline: new Date("2026-03-14"),
        assignee: "Світлана",
        status: "ready",
        link: "https://medevent.academy/product/neuro-psycho-5-0-stijkist-u-stresovyh-umovah-vyrishennia-nevrologichnyh-ta-psyhologichnyh-problem-sogodennia/"
      },
      {
        eventId: neuro.id,
        type: "draft_program",
        title: "Драфт програми",
        deadline: new Date("2026-05-03"),
        assignee: "Діана",
        status: "ready",
        link: "https://docs.google.com/document/d/1aWyMuXdqELYLa1qyvFnsqND04EieDQ4p/edit"
      },
      {
        eventId: neuro.id,
        type: "client_report",
        title: "Стандартний звіт клієнтам",
        deadline: new Date("2026-05-22"),
        assignee: "Світлана",
        status: "ready"
      },
      {
        eventId: neuro.id,
        type: "analytics",
        title: "Аналітика по курсам і сертифікатах",
        deadline: new Date("2026-05-30"),
        assignee: "Діана",
        status: "not_started"
      }
    ]
  });

  await prisma.eventDocument.createMany({
    data: [
      { eventId: neuro.id, title: "Сторінка заходу", type: "Сторінка", url: "https://medevent.academy/product/neuro-psycho-5-0-stijkist-u-stresovyh-umovah-vyrishennia-nevrologichnyh-ta-psyhologichnyh-problem-sogodennia/", owner: "Світлана" },
      { eventId: neuro.id, title: "Драфт програми", type: "Google Doc", url: "https://docs.google.com/document/d/1aWyMuXdqELYLa1qyvFnsqND04EieDQ4p/edit", owner: "Діана" },
      { eventId: neuro.id, title: "Трансляція День 1", type: "YouTube", url: "https://youtu.be/CZHO1EXLWgc" },
      { eventId: neuro.id, title: "Трансляція День 2", type: "YouTube", url: "https://youtu.be/bRsbJZ5U3cM" }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

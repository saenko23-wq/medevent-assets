-- MedEvent CRM schema for Supabase PostgreSQL
-- Paste this file into Supabase SQL Editor and run it once.

create extension if not exists pgcrypto;

create table if not exists "User" (
  id text primary key,
  name text,
  email text not null unique,
  "emailVerified" timestamptz,
  image text,
  "passwordHash" text,
  role text not null default 'viewer',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Account" (
  id text primary key,
  "userId" text not null references "User"(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique(provider, "providerAccountId")
);

create table if not exists "Session" (
  id text primary key,
  "sessionToken" text not null unique,
  "userId" text not null references "User"(id) on delete cascade,
  expires timestamptz not null
);

create table if not exists "VerificationToken" (
  identifier text not null,
  token text not null unique,
  expires timestamptz not null,
  unique(identifier, token)
);

create table if not exists "Client" (
  id text primary key,
  company text not null,
  directions text not null,
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "ProductManager" (
  id text primary key,
  name text not null,
  email text,
  phone text,
  "clientId" text not null references "Client"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);

create table if not exists "Contact" (
  id text primary key,
  name text not null,
  position text,
  email text,
  phone text,
  "clientId" text not null references "Client"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);

create table if not exists "Speaker" (
  id text primary key,
  "fullName" text not null,
  phone text not null,
  specialization text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Event" (
  id text primary key,
  title text not null,
  "eventCode" text,
  "pageUrl" text,
  "programDraftUrl" text,
  "youtubeDay1Url" text,
  "youtubeDay2Url" text,
  "startDate" timestamptz not null,
  "endDate" timestamptz not null,
  format text not null,
  "formatDetails" text,
  "talkCount" integer not null default 0,
  "nonPharmaCount" integer not null default 0,
  "slotPrice" text,
  "plannedBudget" numeric(12,2) not null,
  "actualBudget" numeric(12,2) not null,
  "averageCheck" numeric(12,2) not null default 0,
  "totalSpeakerHonorarium" numeric(12,2) not null default 0,
  status text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "EventSpeaker" (
  "eventId" text not null references "Event"(id) on delete cascade,
  "speakerId" text not null references "Speaker"(id) on delete cascade,
  role text,
  primary key ("eventId", "speakerId")
);

create table if not exists "Deal" (
  id text primary key,
  "clientId" text not null references "Client"(id) on delete cascade,
  "eventId" text not null references "Event"(id) on delete cascade,
  package text not null,
  amount numeric(12,2) not null,
  status text not null,
  "paymentStatus" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "EventSlot" (
  id text primary key,
  "eventId" text not null references "Event"(id) on delete cascade,
  "rowNumber" integer,
  "rowType" text not null,
  "clientId" text references "Client"(id) on delete set null,
  "productManager" text,
  manager text,
  "salesStatus" text not null,
  package text not null,
  price numeric(12,2),
  "crmSource" text,
  "speakerId" text references "Speaker"(id) on delete set null,
  "speakerName" text,
  "participationFormat" text,
  contact text,
  "speakerHonorarium" numeric(12,2),
  "honorariumPayer" text,
  "honorariumPaymentStatus" text,
  "talkTitle" text,
  "brandTopic" text,
  "studioRecord" text,
  duration text,
  direction text,
  "draftSent" boolean not null default false,
  "documentsSent" boolean not null default false,
  "reportSent" boolean not null default false,
  "programComment" text,
  "managerComment" text,
  "technicalKey" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "OperationTask" (
  id text primary key,
  "eventId" text not null references "Event"(id) on delete cascade,
  "slotId" text references "EventSlot"(id) on delete set null,
  type text not null,
  title text not null,
  deadline timestamptz,
  "factDate" timestamptz,
  assignee text,
  status text not null default 'not_started',
  link text,
  blocker text,
  comment text,
  "nextOwner" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "EventDocument" (
  id text primary key,
  "eventId" text not null references "Event"(id) on delete cascade,
  title text not null,
  url text not null,
  type text not null,
  owner text,
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "ReferenceCategory" (
  id text primary key,
  name text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "ReferenceItem" (
  id text primary key,
  "categoryId" text not null references "ReferenceCategory"(id) on delete cascade,
  value text not null,
  notes text,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique("categoryId", value)
);

create table if not exists "ParticipationPackage" (
  id text primary key,
  name text not null unique,
  price numeric(12,2) not null,
  format text not null,
  duration text not null,
  description text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "PackageFeature" (
  id text primary key,
  "packageId" text not null references "ParticipationPackage"(id) on delete cascade,
  name text not null,
  value text not null,
  "createdAt" timestamptz not null default now(),
  unique("packageId", name)
);

create table if not exists "Report" (
  id text primary key,
  title text not null,
  deadline timestamptz not null,
  status text not null default 'not_started',
  "eventId" text not null references "Event"(id) on delete cascade,
  "assigneeId" text not null references "User"(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Payment" (
  id text primary key,
  "dealId" text not null references "Deal"(id) on delete cascade,
  status text not null,
  "dueDate" timestamptz not null,
  "paidAt" timestamptz,
  amount numeric(12,2) not null,
  "actualPaid" numeric(12,2) not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "Client_company_idx" on "Client"(company);
create index if not exists "Event_startDate_idx" on "Event"("startDate");
create index if not exists "Deal_clientId_idx" on "Deal"("clientId");
create index if not exists "Deal_eventId_idx" on "Deal"("eventId");
create index if not exists "EventSlot_eventId_idx" on "EventSlot"("eventId");
create index if not exists "OperationTask_deadline_idx" on "OperationTask"(deadline);
create index if not exists "Payment_dueDate_idx" on "Payment"("dueDate");

insert into "User" (id, name, email, "passwordHash", role)
values
  ('user_admin_demo', 'Адміністратор MedEvent', 'admin@medevent.local', '$2a$10$oMYLvvvE2QEcRELqvjKYN.p4DUeEBHsmz2XUrInJ4gC6zEIXHlwwi', 'admin'),
  ('user_manager_demo', 'Олена Менеджер', 'manager@medevent.local', '$2a$10$oMYLvvvE2QEcRELqvjKYN.p4DUeEBHsmz2XUrInJ4gC6zEIXHlwwi', 'manager')
on conflict (email) do nothing;

insert into "ReferenceCategory" (id, name)
values
  ('ref_sales_status', 'Статуси продажу'),
  ('ref_packages', 'Пакети'),
  ('ref_managers', 'Менеджери'),
  ('ref_row_types', 'Тип рядка'),
  ('ref_participation_formats', 'Формат участі'),
  ('ref_studio_record', 'Студія/запис'),
  ('ref_honorarium_payer', 'Хто оплачує гонорар'),
  ('ref_honorarium_status', 'Статус оплати гонорару'),
  ('ref_event_types', 'Тип події')
on conflict (name) do nothing;

insert into "ReferenceItem" (id, "categoryId", value)
values
  ('ref_sales_1','ref_sales_status','Лід'),
  ('ref_sales_2','ref_sales_status','Перемовини'),
  ('ref_sales_3','ref_sales_status','50% погоджено'),
  ('ref_sales_4','ref_sales_status','100% погоджено'),
  ('ref_sales_5','ref_sales_status','Відмова'),
  ('ref_sales_6','ref_sales_status','Без фарм'),
  ('ref_pkg_1','ref_packages','Standart'),
  ('ref_pkg_2','ref_packages','Plus'),
  ('ref_pkg_3','ref_packages','Mono'),
  ('ref_pkg_4','ref_packages','Combo'),
  ('ref_mgr_1','ref_managers','Марина'),
  ('ref_mgr_2','ref_managers','Олександра'),
  ('ref_mgr_3','ref_managers','Діана'),
  ('ref_row_1','ref_row_types','Партнер'),
  ('ref_row_2','ref_row_types','Без фарм'),
  ('ref_fmt_1','ref_participation_formats','Доповідь'),
  ('ref_fmt_2','ref_participation_formats','МК'),
  ('ref_fmt_3','ref_participation_formats','Модерація'),
  ('ref_studio_1','ref_studio_record','СТУДІЯ'),
  ('ref_studio_2','ref_studio_record','ЗАПИС'),
  ('ref_studio_3','ref_studio_record','ЗУМ')
on conflict ("categoryId", value) do nothing;

insert into "ParticipationPackage" (id, name, price, format, duration)
values
  ('pkg_standart','Standart',35910,'Виступ у конференції','20 хв + 5 хв Q&A'),
  ('pkg_plus','Plus',53820,'Виступ + digital-підсилення','20 хв + 5 хв Q&A'),
  ('pkg_mono','Mono',49500,'Окремий захід під продукт','до 2 год + 10-15 хв Q&A'),
  ('pkg_combo','Combo',67500,'Конференція + Mono','30 хв + 5 хв Q&A + Mono до 2 год')
on conflict (name) do nothing;

insert into "PackageFeature" (id, "packageId", name, value)
values
  ('pf_1','pkg_standart','Аналітика','Базова'),
  ('pf_2','pkg_standart','NPS','Так'),
  ('pf_3','pkg_plus','Промосторінка продукту','Так'),
  ('pf_4','pkg_plus','DocLink','Так'),
  ('pf_5','pkg_mono','Опитування лікарів','Так'),
  ('pf_6','pkg_mono','Аналітика','Детальна'),
  ('pf_7','pkg_combo','Розсилка','Так (кілька разів)'),
  ('pf_8','pkg_combo','Додатковий відеоконтент','Так (shorts / reels)')
on conflict ("packageId", name) do nothing;

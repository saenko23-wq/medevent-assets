# MedEvent CRM

CRM-платформа для управління медичними освітніми заходами.

## Стек

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Supabase
- NextAuth.js

## Модулі

- Авторизація з ролями: `admin`, `manager`, `operations`, `viewer`
- Клієнти, продакт-менеджери, напрямки та контакти
- Спікери та прив'язка до заходів
- Заходи з бюджетами, форматом і статусом
- Угоди з пакетами `Standart`, `Plus`, `Mono`, `Combo`
- Звіти з дедлайнами та відповідальними
- Оплати зі статусами й фактичними надходженнями
- Дашборд: план/факт, pipeline, топ клієнти, дедлайни
- Загальний календар подій
- Окрема сторінка кожного заходу з паспортом, програмою, партнерами, задачами й документами
- Розширювані довідники
- Матриця пакетів участі

## Міграція з Google Sheets

Мапа вкладок і сутностей описана в `docs/google-sheets-migration-map.md`.

## Запуск

1. Встановіть залежності:

```bash
npm install
```

2. Створіть `.env` на основі `.env.example` і вставте Supabase PostgreSQL URL:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

3. Застосуйте міграцію та наповніть демо-даними:

```bash
npm run prisma:migrate
npm run db:seed
```

4. Запустіть dev-сервер:

```bash
npm run dev
```

Демо-вхід після seed:

- Email: `admin@medevent.local`
- Пароль: `medevent2026`

## Production

```bash
npm run build
npm run start
```

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;
const name = process.argv[4] || "Адміністратор MedEvent";
const role = process.argv[5] || "admin";

if (!email || !password) {
  console.error("Використання: node scripts/create-admin.js <email> <пароль> [імʼя] [роль]");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Пароль має містити щонайменше 8 символів.");
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, name },
    create: { email, passwordHash, role, name }
  });
  console.log(`Користувача збережено: ${user.email} (роль: ${user.role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

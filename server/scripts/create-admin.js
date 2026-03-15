import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth.js";

const prisma = new PrismaClient();

async function main() {
  const username = (process.argv[2] || process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const password = (process.argv[3] || process.env.ADMIN_PASSWORD || "").trim();
  const email = (process.argv[4] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (!username || !password) {
    console.error("Usage: node scripts/create-admin.js <username> <password> [email]");
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      username,
      email: email || null,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false
    },
    create: {
      username,
      email: email || null,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  console.log("Admin ready:", user.username, user.role);
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

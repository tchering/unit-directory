import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth.js";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = (process.argv[3] || process.env.ADMIN_PASSWORD || "").trim();

  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.js <email> <password>");
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true
    },
    create: {
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      isActive: true
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  console.log("Admin ready:", user.email, user.role);
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

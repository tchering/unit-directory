import { PrismaClient } from "@prisma/client";
import { unit, soldiers } from "../src/data.js";
import { hashPassword } from "../src/auth.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.soldier.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.section.deleteMany();
  await prisma.company.deleteMany();
  await prisma.regiment.deleteMany();

  const regiment = await prisma.regiment.create({
    data: { name: unit.regiment }
  });

  const company = await prisma.company.create({
    data: {
      name: unit.company,
      regimentId: regiment.id
    }
  });

  await prisma.section.createMany({
    data: unit.sections.map((section) => ({
      id: section.id,
      name: section.name,
      companyId: company.id
    }))
  });

  await prisma.soldier.createMany({
    data: soldiers.map((soldier) => ({
      id: soldier.id,
      name: soldier.name,
      fullName: soldier.fullName,
      rank: soldier.rank,
      role: soldier.role,
      photo: soldier.photo,
      commandCategory: soldier.commandCategory || "MILITAIRE_DU_RANG",
      sectionId: soldier.sectionId
    }))
  });

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();

  if (adminEmail && adminPassword) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        isActive: true
      }
    });
  } else {
    console.warn("[SEED] ADMIN_EMAIL / ADMIN_PASSWORD not set. No admin user created.");
  }
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

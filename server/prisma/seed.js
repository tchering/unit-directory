import { PrismaClient } from "@prisma/client";
import { unit, soldiers } from "../src/data.js";
import { hashPassword } from "../src/auth.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.announcementRead.deleteMany();
  await prisma.announcement.deleteMany();
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
      photo: soldier.photo,
      commandCategory: soldier.commandCategory || "MILITAIRE_DU_RANG",
      sectionId: soldier.sectionId
    }))
  });

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminUsername = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();

  if (adminUsername && adminPassword) {
    const admin = await prisma.user.create({
      data: {
        username: adminUsername,
        email: adminEmail || null,
        passwordHash: await hashPassword(adminPassword),
        role: "ADMIN",
        isActive: true,
        mustChangePassword: false
      }
    });

    await prisma.announcement.create({
      data: {
        title: "Bienvenue sur Unit Directory",
        body: "Les annonces de la compagnie apparaissent ici.",
        scope: "COMPANY",
        isPinned: true,
        createdById: admin.id
      }
    });
  } else {
    console.warn("[SEED] ADMIN_USERNAME / ADMIN_PASSWORD not set. No admin user created.");
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

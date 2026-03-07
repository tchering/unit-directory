import { PrismaClient } from "@prisma/client";
import { unit, soldiers } from "../src/data.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.soldier.deleteMany();
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
      sectionId: soldier.sectionId
    }))
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

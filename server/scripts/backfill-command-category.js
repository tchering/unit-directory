import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function inferCategory(soldier) {
  const rank = (soldier.rank || "").toLowerCase();

  if (rank.includes("adjudant")) {
    return "SOUS_OFFICIER_ADJOINT";
  }
  if (rank.includes("sergent")) {
    return "SERGENT";
  }
  return "MILITAIRE_DU_RANG";
}

async function main() {
  const soldiers = await prisma.soldier.findMany();

  for (const soldier of soldiers) {
    await prisma.soldier.update({
      where: { id: soldier.id },
      data: { commandCategory: inferCategory(soldier) }
    });
  }

  console.log(`Categorie commandement mise a jour: ${soldiers.length}`);
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

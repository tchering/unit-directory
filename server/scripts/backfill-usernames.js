import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeUsernamePart(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

async function uniqueUsername(baseValue) {
  const base = (normalizeUsernamePart(baseValue) || "militaire.unite").slice(0, 26);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true }
    });
    if (!existing) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 30);
  }
}

async function main() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, email: true }
  });

  for (const user of users) {
    const emailLocal = user.email?.split("@")[0] || "";
    const username = await uniqueUsername(emailLocal || "militaire.unite");
    await prisma.user.update({
      where: { id: user.id },
      data: { username }
    });
    console.log(`Username assigned: ${user.id} -> ${username}`);
  }

  console.log(`Done. Updated ${users.length} user(s).`);
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

import { PrismaClient } from "@prisma/client";
import { unit } from "../src/data.js";
import { hashPassword } from "../src/auth.js";

const prisma = new PrismaClient();

const DEFAULT_PHOTO = "https://i.pravatar.cc/480?img=60";

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const NAME_POOLS = {
  chef: ["Omar Sy", "Vincent Cassel", "Jean Dujardin"],
  soa: ["Marion Cotillard", "Lea Seydoux", "Adèle Exarchopoulos"],
  sgt: [
    "Tom Hardy", "Michael B Jordan", "Cillian Murphy",
    "Henry Cavill", "Idris Elba", "Pedro Pascal",
    "Jake Gyllenhaal", "Chris Evans", "Ryan Gosling"
  ],
  cc1: ["Zendaya Coleman", "Anya Taylor Joy", "Florence Pugh", "Ana de Armas", "Emma Stone", "Margot Robbie"],
  bch: [
    "Timothee Chalamet", "Austin Butler", "Paul Mescal", "Barry Keoghan",
    "Saoirse Ronan", "Lupita Nyongo", "Natalie Portman", "Gal Gadot",
    "Robert Pattinson", "Daniel Craig", "Dev Patel", "Rami Malek"
  ],
  cpl: ["Keanu Reeves", "Hugh Jackman", "Matthew McConaughey", "Brad Pitt", "Angelina Jolie", "Jennifer Lawrence"],
  cl1: ["Bella Ramsey", "Millie Bobby Brown", "Noah Schnapp", "Sadie Sink", "Jenna Ortega", "Thomas Brodie Sangster", "Dafne Keen", "Kit Connor", "Joe Keery"],
  sdt: ["Finn Wolfhard", "Iain Armitage", "Asa Butterfield", "Jack Dylan Grazer", "Caleb McLaughlin", "Walker Scobell"]
};

function chunk(pool, sectionIndex, count) {
  const start = sectionIndex * count;
  return pool.slice(start, start + count);
}

function buildSectionSoldiers(section, sectionIndex) {
  const sectionSlug = slugify(section.id);

  const mk = (suffix, name, rank, commandCategory) => ({
    id: `${sectionSlug}-${suffix}`,
    name,
    fullName: name,
    rank,
    photo: DEFAULT_PHOTO,
    commandCategory,
    sectionId: section.id
  });

  return [
    mk("chef-1", chunk(NAME_POOLS.chef, sectionIndex, 1)[0], "Ltn", "CHEF_DE_SECTION"),
    mk("soa-1", chunk(NAME_POOLS.soa, sectionIndex, 1)[0], "Adj", "SOUS_OFFICIER_ADJOINT"),
    ...chunk(NAME_POOLS.sgt, sectionIndex, 3).map((name, idx) => mk(`sgt-${idx + 1}`, name, "MDL", "SERGENT")),
    ...chunk(NAME_POOLS.cc1, sectionIndex, 2).map((name, idx) => mk(`cc1-${idx + 1}`, name, "CC1", "MILITAIRE_DU_RANG")),
    ...chunk(NAME_POOLS.bch, sectionIndex, 4).map((name, idx) => mk(`bch-${idx + 1}`, name, "BCH", "MILITAIRE_DU_RANG")),
    ...chunk(NAME_POOLS.cpl, sectionIndex, 2).map((name, idx) => mk(`cpl-${idx + 1}`, name, "Cpl", "MILITAIRE_DU_RANG")),
    ...chunk(NAME_POOLS.cl1, sectionIndex, 3).map((name, idx) => mk(`cl1-${idx + 1}`, name, "1re Classe", "MILITAIRE_DU_RANG")),
    ...chunk(NAME_POOLS.sdt, sectionIndex, 2).map((name, idx) => mk(`sdt-${idx + 1}`, name, "Soldat", "MILITAIRE_DU_RANG"))
  ];
}

async function main() {
  await prisma.devicePushToken.deleteMany();
  await prisma.announcementRead.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.issuedCredential.deleteMany();
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

  const seededSoldiers = unit.sections.flatMap((section, idx) => buildSectionSoldiers(section, idx));
  await prisma.soldier.createMany({ data: seededSoldiers });

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

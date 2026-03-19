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

  if (section.id === "section-2") {
    return [
      // Chef de section
      mk("chef-1", "Thibault Cancel", "LTN", "CHEF_DE_SECTION"),

      // SOA
      mk("soa-1", "Florian Bernadat", "SCH_B", "SOUS_OFFICIER_ADJOINT"),
      mk("soa-2", "Thomas Lalbat", "SCH", "SOUS_OFFICIER_ADJOINT"),

      // Sergent
      mk("sgt-1", "Remi Bourdeau", "SGT", "SERGENT"),
      mk("sgt-2", "Faissoili Daoud", "SGT", "SERGENT"),
      mk("sgt-3", "Lihadi M'Colo", "SGT", "SERGENT"),
      mk("sgt-4", "Melson Obry", "SGT", "SERGENT"),
      mk("sgt-5", "Mathias Pinot", "SGT", "SERGENT"),
      mk("sgt-6", "Thibault Santos", "SGT", "SERGENT"),
      mk("sgt-7", "Ariihau Taae", "SGT", "SERGENT"),
      mk("sgt-8", "Dany Toueba", "SGT", "SERGENT"),

      // MDR
      mk("cc1-1", "Valentin Gassiat", "CC1", "MILITAIRE_DU_RANG"),
      mk("cc1-2", "Richard Kelenda Poyo", "CC1", "MILITAIRE_DU_RANG"),
      mk("cc1-3", "Mathieu Laplace", "CC1", "MILITAIRE_DU_RANG"),
      mk("cc1-4", "Clement Schwaller-Chatron", "CC1", "MILITAIRE_DU_RANG"),
      mk("cc1-5", "Nelson Teikihokatoua", "CC1", "MILITAIRE_DU_RANG"),

      mk("cch-1", "Emelie Bokoe-Gowe", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-2", "Charles Capron", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-3", "Faherdine Chibaco", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-4", "Raphael Delhomme", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-5", "Marc Glombard", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-6", "Yankoub Hachim", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-7", "Melven Jordan", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-8", "El-habibou Mahamoudou", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-9", "Zakaria Mohamed", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-10", "Ascandari Moussa", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-11", "Quoc Brandon Phan", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-12", "Netra Pun", "CCH", "MILITAIRE_DU_RANG"),
      mk("cch-13", "Valentin Tirlot", "CCH", "MILITAIRE_DU_RANG"),

      mk("cpl-1", "Lucas Millasseau", "CPL", "MILITAIRE_DU_RANG"),
      mk("cpl-2", "Lucas Ravat", "CPL", "MILITAIRE_DU_RANG"),
      mk("cpl-3", "Sonam Sherpa", "CPL", "MILITAIRE_DU_RANG"),

      mk("1cl-1", "Mourchidine Boura", "1CL", "MILITAIRE_DU_RANG"),
      mk("1cl-2", "Adelyn Fulrad Bailly", "1CL", "MILITAIRE_DU_RANG"),
      mk("1cl-3", "Jamelia Gumiel", "1CL", "MILITAIRE_DU_RANG"),
      mk("1cl-4", "Noah Place", "1CL", "MILITAIRE_DU_RANG"),
      mk("1cl-5", "Mouhoussoune Said", "1CL", "MILITAIRE_DU_RANG"),
      mk("1cl-6", "Axel Schneider", "1CL", "MILITAIRE_DU_RANG"),

      mk("sdt-1", "Hemrick", "SDT", "MILITAIRE_DU_RANG"),
      mk("sdt-2", "Latchoumanin Manicon", "SDT", "MILITAIRE_DU_RANG"),
      mk("sdt-3", "Yohan Mercher", "SDT", "MILITAIRE_DU_RANG"),
      mk("sdt-4", "Joffrey Orue Alarcon", "SDT", "MILITAIRE_DU_RANG"),
      mk("sdt-5", "Florian Simans", "SDT", "MILITAIRE_DU_RANG")
    ];
  }

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

import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/unit", async (_req, res) => {
  const company = await prisma.company.findFirst({
    include: {
      regiment: true,
      sections: {
        orderBy: { id: "asc" }
      }
    }
  });

  if (!company) {
    res.status(404).json({ message: "Unit not found" });
    return;
  }

  res.json({
    regiment: company.regiment.name,
    company: company.name,
    sections: company.sections.map((section) => ({
      id: section.id,
      name: section.name
    }))
  });
});

app.get("/api/sections", async (_req, res) => {
  const sections = await prisma.section.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: {
        select: { soldiers: true }
      }
    }
  });

  res.json(
    sections.map((section) => ({
      id: section.id,
      name: section.name,
      soldierCount: section._count.soldiers
    }))
  );
});

app.get("/api/sections/:sectionId/soldiers", async (req, res) => {
  const { sectionId } = req.params;

  const section = await prisma.section.findUnique({
    where: { id: sectionId }
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const result = await prisma.soldier.findMany({
    where: { sectionId },
    orderBy: { name: "asc" }
  });

  res.json({
    section: {
      id: section.id,
      name: section.name
    },
    soldiers: result.map((soldier) => ({
      ...soldier,
      section: section.name
    }))
  });
});

app.get("/api/soldiers", async (req, res) => {
  const query = (req.query.search || "").toString().trim();

  const result = await prisma.soldier.findMany({
    where: query
      ? {
          name: {
            contains: query,
            mode: "insensitive"
          }
        }
      : undefined,
    include: {
      section: true
    },
    orderBy: { name: "asc" }
  });

  res.json(
    result.map((soldier) => ({
      id: soldier.id,
      name: soldier.name,
      fullName: soldier.fullName,
      rank: soldier.rank,
      role: soldier.role,
      photo: soldier.photo,
      sectionId: soldier.sectionId,
      section: soldier.section.name
    }))
  );
});

app.post("/api/soldiers", async (req, res) => {
  const { name, fullName, rank, role, photo, sectionId } = req.body || {};

  if (!name || !fullName || !rank || !role || !photo || !sectionId) {
    res.status(400).json({ message: "name, fullName, rank, role, photo, and sectionId are required" });
    return;
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    res.status(400).json({ message: "Invalid sectionId" });
    return;
  }

  const created = await prisma.soldier.create({
    data: {
      id: `s-${randomUUID().slice(0, 8)}`,
      name: String(name).trim(),
      fullName: String(fullName).trim(),
      rank: String(rank).trim(),
      role: String(role).trim(),
      photo: String(photo).trim(),
      sectionId
    }
  });

  res.status(201).json({
    id: created.id,
    name: created.name,
    fullName: created.fullName,
    rank: created.rank,
    role: created.role,
    photo: created.photo,
    sectionId: created.sectionId,
    section: section.name
  });
});

app.get("/api/soldiers/:id", async (req, res) => {
  const soldier = await prisma.soldier.findUnique({
    where: { id: req.params.id },
    include: { section: true }
  });

  if (!soldier) {
    res.status(404).json({ message: "Soldier not found" });
    return;
  }

  res.json({
    id: soldier.id,
    name: soldier.name,
    fullName: soldier.fullName,
    rank: soldier.rank,
    role: soldier.role,
    photo: soldier.photo,
    sectionId: soldier.sectionId,
    section: soldier.section.name
  });
});

app.listen(PORT, () => {
  console.log(`Unit Directory API running on http://localhost:${PORT}`);
});

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";
import { hashPassword, issueAuthTokens, revokeRefreshToken, rotateRefreshToken, verifyPassword } from "./auth.js";
import { requireAuth, requireRole } from "./authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 4000;

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "200kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.post("/api/auth/register", authLimiter, asyncHandler(async (req, res) => {
  const email = (req.body?.email || "").toString().trim().toLowerCase();
  const password = (req.body?.password || "").toString();
  const passwordConfirm = (req.body?.passwordConfirm || "").toString();

  if (!email || !password || !passwordConfirm) {
    res.status(400).json({ message: "email, password et passwordConfirm sont requis" });
    return;
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.com$/.test(email);
  if (!emailValid) {
    res.status(400).json({ message: "L'email doit se terminer par .com" });
    return;
  }

  if (password.length < 10) {
    res.status(400).json({ message: "Le mot de passe doit contenir au moins 10 caractères" });
    return;
  }

  if (password !== passwordConfirm) {
    res.status(400).json({ message: "Les mots de passe ne correspondent pas" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Cet utilisateur existe déjà" });
    return;
  }

  const createdUser = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "VIEWER",
      isActive: true
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "REGISTER",
      entity: "User",
      entityId: createdUser.id,
      actorId: createdUser.id,
      details: {
        role: createdUser.role
      }
    }
  });

  res.status(201).json({
    message: "Inscription réussie",
    user: createdUser
  });
}));

app.post("/api/auth/login", authLimiter, asyncHandler(async (req, res) => {
  const email = (req.body?.email || "").toString().trim().toLowerCase();
  const password = (req.body?.password || "").toString();

  if (!email || !password) {
    res.status(400).json({ message: "email et mot de passe sont requis" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    res.status(401).json({ message: "Identifiants invalides" });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ message: "Identifiants invalides" });
    return;
  }

  const auth = await issueAuthTokens(user);
  res.json(auth);
}));

app.post("/api/auth/refresh", authLimiter, asyncHandler(async (req, res) => {
  const refreshToken = (req.body?.refreshToken || "").toString();
  if (!refreshToken) {
    res.status(400).json({ message: "refreshToken est requis" });
    return;
  }

  const rotated = await rotateRefreshToken(refreshToken);
  if (!rotated) {
    res.status(401).json({ message: "refresh token invalide" });
    return;
  }

  res.json(rotated);
}));

app.post("/api/auth/logout", authLimiter, asyncHandler(async (req, res) => {
  const refreshToken = (req.body?.refreshToken || "").toString();
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  res.status(204).send();
}));

app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, email: true, role: true, isActive: true }
  });

  if (!user || !user.isActive) {
    res.status(401).json({ message: "Non autorisé" });
    return;
  }

  res.json(user);
}));

app.get("/api/unit", asyncHandler(async (_req, res) => {
  const company = await prisma.company.findFirst({
    include: {
      regiment: true,
      sections: {
        orderBy: { id: "asc" }
      }
    }
  });

  if (!company) {
    res.status(404).json({ message: "Unité introuvable" });
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
}));

app.get("/api/sections", asyncHandler(async (_req, res) => {
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
}));

app.get("/api/sections/:sectionId/soldiers", asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  const section = await prisma.section.findUnique({
    where: { id: sectionId }
  });

  if (!section) {
    res.status(404).json({ message: "Section introuvable" });
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
}));

app.get("/api/soldiers", asyncHandler(async (req, res) => {
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
      commandCategory: soldier.commandCategory,
      sectionId: soldier.sectionId,
      section: soldier.section.name
    }))
  );
}));

app.get("/api/soldiers/:id", asyncHandler(async (req, res) => {
  const soldier = await prisma.soldier.findUnique({
    where: { id: req.params.id },
    include: { section: true }
  });

  if (!soldier) {
    res.status(404).json({ message: "Militaire introuvable" });
    return;
  }

  res.json({
    id: soldier.id,
    name: soldier.name,
    fullName: soldier.fullName,
    rank: soldier.rank,
    role: soldier.role,
    photo: soldier.photo,
    commandCategory: soldier.commandCategory,
    sectionId: soldier.sectionId,
    section: soldier.section.name
  });
}));

app.post("/api/soldiers", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const { name, fullName, rank, role, photo, sectionId, commandCategory } = req.body || {};
  const validCategories = ["CHEF_DE_SECTION", "SOUS_OFFICIER_ADJOINT", "SERGENT", "MILITAIRE_DU_RANG"];

  if (!name || !fullName || !rank || !role || !photo || !sectionId) {
    res.status(400).json({ message: "name, fullName, rank, role, photo et sectionId sont requis" });
    return;
  }

  if (commandCategory && !validCategories.includes(commandCategory)) {
    res.status(400).json({ message: "Catégorie de commandement invalide" });
    return;
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    res.status(400).json({ message: "sectionId invalide" });
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
      commandCategory: commandCategory || "MILITAIRE_DU_RANG",
      sectionId,
      createdById: req.auth.userId
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "Soldier",
      entityId: created.id,
      actorId: req.auth.userId,
      details: {
        sectionId,
        role: created.role
      }
    }
  });

  res.status(201).json({
    id: created.id,
    name: created.name,
    fullName: created.fullName,
    rank: created.rank,
    role: created.role,
    photo: created.photo,
    commandCategory: created.commandCategory,
    sectionId: created.sectionId,
    section: section.name
  });
}));

app.patch("/api/soldiers/:id", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const validCategories = ["CHEF_DE_SECTION", "SOUS_OFFICIER_ADJOINT", "SERGENT", "MILITAIRE_DU_RANG"];
  const sectionId = req.body?.sectionId ? String(req.body.sectionId) : undefined;
  const commandCategory = req.body?.commandCategory ? String(req.body.commandCategory) : undefined;

  if (!sectionId && !commandCategory) {
    res.status(400).json({ message: "Fournir sectionId et/ou commandCategory" });
    return;
  }

  if (commandCategory && !validCategories.includes(commandCategory)) {
    res.status(400).json({ message: "Catégorie de commandement invalide" });
    return;
  }

  const existing = await prisma.soldier.findUnique({
    where: { id: req.params.id },
    include: { section: true }
  });

  if (!existing) {
    res.status(404).json({ message: "Militaire introuvable" });
    return;
  }

  let nextSection = existing.section;
  if (sectionId) {
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      res.status(400).json({ message: "sectionId invalide" });
      return;
    }
    nextSection = section;
  }

  const updated = await prisma.soldier.update({
    where: { id: existing.id },
    data: {
      ...(sectionId ? { sectionId } : {}),
      ...(commandCategory ? { commandCategory } : {})
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entity: "Soldier",
      entityId: updated.id,
      actorId: req.auth.userId,
      details: {
        fromSectionId: existing.sectionId,
        toSectionId: updated.sectionId,
        fromCommandCategory: existing.commandCategory,
        toCommandCategory: updated.commandCategory
      }
    }
  });

  res.json({
    id: updated.id,
    name: updated.name,
    fullName: updated.fullName,
    rank: updated.rank,
    role: updated.role,
    photo: updated.photo,
    commandCategory: updated.commandCategory,
    sectionId: updated.sectionId,
    section: nextSection.name
  });
}));

app.delete("/api/soldiers/:id", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const soldier = await prisma.soldier.findUnique({
    where: { id: req.params.id }
  });

  if (!soldier) {
    res.status(404).json({ message: "Militaire introuvable" });
    return;
  }

  await prisma.soldier.delete({
    where: { id: soldier.id }
  });

  await prisma.auditLog.create({
    data: {
      action: "DELETE",
      entity: "Soldier",
      entityId: soldier.id,
      actorId: req.auth.userId,
      details: {
        sectionId: soldier.sectionId,
        commandCategory: soldier.commandCategory
      }
    }
  });

  res.status(204).send();
}));

app.get("/api/admin/users", requireAuth, requireRole("ADMIN"), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  res.json(users);
}));

app.post("/api/admin/users", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const email = (req.body?.email || "").toString().trim().toLowerCase();
  const password = (req.body?.password || "").toString();
  const role = (req.body?.role || "VIEWER").toString().toUpperCase();

  if (!email || !password || !["ADMIN", "MANAGER", "VIEWER"].includes(role)) {
    res.status(400).json({ message: "email, mot de passe et rôle valide sont requis" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Cet utilisateur existe déjà" });
    return;
  }

  const createdUser = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "User",
      entityId: createdUser.id,
      actorId: req.auth.userId,
      details: { role: createdUser.role, email: createdUser.email }
    }
  });

  res.status(201).json(createdUser);
}));

app.patch("/api/admin/users/:id", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const role = req.body?.role ? req.body.role.toString().toUpperCase() : undefined;
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;

  if (!role && typeof isActive !== "boolean") {
    res.status(400).json({ message: "Fournir role et/ou isActive" });
    return;
  }

  if (role && !["ADMIN", "MANAGER", "VIEWER"].includes(role)) {
    res.status(400).json({ message: "Rôle invalide" });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!targetUser) {
    res.status(404).json({ message: "Utilisateur introuvable" });
    return;
  }

  const changingAwayFromAdmin = targetUser.role === "ADMIN" && role && role !== "ADMIN";
  const deactivatingAdmin = targetUser.role === "ADMIN" && isActive === false;

  if (changingAwayFromAdmin || deactivatingAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: {
        role: "ADMIN",
        isActive: true
      }
    });

    if (activeAdminCount <= 1 && targetUser.isActive) {
      res.status(400).json({ message: "Au moins un administrateur actif est requis" });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(role ? { role } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {})
    },
    select: { id: true, email: true, role: true, isActive: true }
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entity: "User",
      entityId: updated.id,
      actorId: req.auth.userId,
      details: {
        role: updated.role,
        isActive: updated.isActive
      }
    }
  });

  res.json(updated);
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Erreur interne du serveur" });
});

app.listen(PORT, () => {
  console.log(`Unit Directory API running on http://localhost:${PORT}`);
});

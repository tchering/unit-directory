import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";
import { hashPassword, issueAuthTokens, revokeAllUserRefreshTokens, revokeRefreshToken, rotateRefreshToken, verifyPassword } from "./auth.js";
import { requireAuth, requireRole } from "./authMiddleware.js";
import { decryptTemporaryPassword, encryptTemporaryPassword } from "./credentialsCrypto.js";
import { registerPushToken, sendAnnouncementPush, unregisterPushToken } from "./pushNotifications.js";

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "../uploads");
const soldierUploadDir = path.join(uploadsRoot, "soldiers");

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(uploadsRoot));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function normalizeUsernamePart(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

async function generateUniqueUsername(fullName) {
  const raw = normalizeUsernamePart(fullName);
  const tokens = raw.split(".").filter(Boolean);
  const first = tokens[0] || "militaire";
  const last = tokens[tokens.length - 1] || "unite";
  const base = `${first}.${last}`.slice(0, 26) || "militaire.unite";

  let candidate = base;
  let suffix = 1;
  while (true) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true }
    });
    if (!exists) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 30);
  }
}

function generateTemporaryPassword() {
  const raw = randomBytes(12).toString("base64url");
  return `${raw}A1!`;
}

function isStrongPassword(password) {
  return (
    password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}

function buildPublicBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function parseDataUrlImage(dataUrl) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }
  const type = match[1].toLowerCase();
  const ext = type === "jpeg" ? "jpg" : type;
  const buffer = Buffer.from(match[2], "base64");
  return { ext, buffer };
}

async function safelyDeleteLocalSoldierPhoto(photoUrl, req) {
  if (!photoUrl) {
    return;
  }
  const base = buildPublicBaseUrl(req);
  let relativePath = null;
  if (photoUrl.startsWith(`${base}/uploads/soldiers/`)) {
    relativePath = photoUrl.replace(`${base}/uploads/soldiers/`, "");
  } else if (photoUrl.startsWith("/uploads/soldiers/")) {
    relativePath = photoUrl.replace("/uploads/soldiers/", "");
  }

  if (!relativePath) {
    return;
  }

  const filePath = path.join(soldierUploadDir, path.basename(relativePath));
  try {
    await fs.unlink(filePath);
  } catch (_error) {
    // Ignore if old file does not exist.
  }
}

app.post("/api/auth/login", authLimiter, asyncHandler(async (req, res) => {
  const identifier = (req.body?.identifier || "").toString().trim().toLowerCase();
  const password = (req.body?.password || "").toString();

  if (!identifier || !password) {
    res.status(400).json({ message: "Identifiant et mot de passe sont requis" });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier }
      ]
    }
  });
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
  if (user.mustChangePassword) {
    res.json({
      ...auth,
      code: "PASSWORD_CHANGE_REQUIRED",
      passwordChangeRequired: true
    });
    return;
  }
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

app.post("/api/auth/change-password-first-login", requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = (req.body?.currentPassword || "").toString();
  const newPassword = (req.body?.newPassword || "").toString();
  const passwordConfirm = (req.body?.passwordConfirm || "").toString();

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId }
  });

  if (!user || !user.isActive) {
    res.status(401).json({ message: "Non autorisé" });
    return;
  }

  if (!user.mustChangePassword) {
    res.status(400).json({ message: "Le changement initial n'est pas requis" });
    return;
  }

  if (!currentPassword || !newPassword || !passwordConfirm) {
    res.status(400).json({ message: "currentPassword, newPassword et passwordConfirm sont requis" });
    return;
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ message: "Mot de passe actuel invalide" });
    return;
  }

  if (newPassword !== passwordConfirm) {
    res.status(400).json({ message: "Les mots de passe ne correspondent pas" });
    return;
  }

  if (!isStrongPassword(newPassword)) {
    res.status(400).json({
      message: "Le mot de passe doit contenir 12+ caractères avec majuscule, minuscule, chiffre et caractère spécial"
    });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false
    }
  });

  await prisma.issuedCredential.updateMany({
    where: {
      userId: user.id,
      passwordChangedAt: null
    },
    data: {
      passwordChangedAt: new Date()
    }
  });

  await revokeAllUserRefreshTokens(user.id);

  await prisma.auditLog.create({
    data: {
      action: "PASSWORD_CHANGE_FIRST_LOGIN",
      entity: "User",
      entityId: user.id,
      actorId: user.id,
      details: { username: user.username }
    }
  });

  const auth = await issueAuthTokens(updatedUser);
  res.json(auth);
}));

app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const [user, credential] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true
      }
    }),
    prisma.issuedCredential.findFirst({
      where: { userId: req.auth.userId },
      select: { soldierId: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  if (!user || !user.isActive) {
    res.status(401).json({ message: "Non autorisé" });
    return;
  }

  res.json({
    ...user,
    soldierId: credential?.soldierId || null
  });
}));

async function resolveUserSoldierId(userId) {
  const credential = await prisma.issuedCredential.findFirst({
    where: { userId },
    select: { soldierId: true },
    orderBy: { createdAt: "desc" }
  });
  return credential?.soldierId || null;
}

async function resolveUserSectionId(userId) {
  const soldierId = await resolveUserSoldierId(userId);
  if (!soldierId) {
    return null;
  }
  const soldier = await prisma.soldier.findUnique({
    where: { id: soldierId },
    select: { sectionId: true }
  });
  return soldier?.sectionId || null;
}

function buildAnnouncementVisibilityWhere(isAdminLike, userSectionId) {
  if (isAdminLike) {
    return {};
  }
  return {
    OR: [
      { scope: "REGIMENT" },
      { scope: "COMPANY" },
      ...(userSectionId ? [{ scope: "SECTION", sectionId: userSectionId }] : [])
    ]
  };
}

app.patch("/api/soldiers/:id/position", requireAuth, asyncHandler(async (req, res) => {
  const soldierId = String(req.params.id);
  const currentPosition = (req.body?.currentPosition || "").toString().trim();
  const availability = (req.body?.availability || "").toString().trim().toUpperCase();
  const validAvailability = ["PRESENT", "ABSENT", "MISSION", "PERMISSION"];
  const normalizedPosition = currentPosition || null;

  if (currentPosition.length > 120) {
    res.status(400).json({ message: "Position actuelle trop longue (120 caractères max)" });
    return;
  }
  if (!validAvailability.includes(availability)) {
    res.status(400).json({ message: "Statut de présence invalide" });
    return;
  }
  if (availability !== "PRESENT" && !currentPosition) {
    res.status(400).json({ message: "Position actuelle requise sauf si statut Présent" });
    return;
  }

  const existing = await prisma.soldier.findUnique({
    where: { id: soldierId },
    include: { section: true }
  });

  if (!existing) {
    res.status(404).json({ message: "Militaire introuvable" });
    return;
  }

  const isAdminLike = req.auth.role === "ADMIN" || req.auth.role === "MANAGER";
  if (!isAdminLike) {
    const ownSoldierId = await resolveUserSoldierId(req.auth.userId);
    if (!ownSoldierId || ownSoldierId !== soldierId) {
      res.status(403).json({ message: "Accès interdit" });
      return;
    }
  }

  const updated = await prisma.soldier.update({
    where: { id: soldierId },
    data: {
      currentPosition: availability === "PRESENT" ? null : normalizedPosition,
      availability,
      positionUpdatedAt: new Date(),
      positionUpdatedById: req.auth.userId
    },
    include: { section: true }
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_POSITION",
      entity: "Soldier",
      entityId: updated.id,
      actorId: req.auth.userId,
      details: {
        availability: updated.availability,
        currentPosition: updated.currentPosition
      }
    }
  });

  res.json({
    id: updated.id,
    name: updated.name,
    fullName: updated.fullName,
    rank: updated.rank,
    photo: updated.photo,
    commandCategory: updated.commandCategory,
    sectionId: updated.sectionId,
    section: updated.section.name,
    currentPosition: updated.currentPosition,
    availability: updated.availability,
    positionUpdatedAt: updated.positionUpdatedAt
  });
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
      photo: soldier.photo,
      commandCategory: soldier.commandCategory,
      sectionId: soldier.sectionId,
      section: soldier.section.name,
      currentPosition: soldier.currentPosition,
      availability: soldier.availability,
      positionUpdatedAt: soldier.positionUpdatedAt
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
    photo: soldier.photo,
    commandCategory: soldier.commandCategory,
    sectionId: soldier.sectionId,
    section: soldier.section.name,
    currentPosition: soldier.currentPosition,
    availability: soldier.availability,
    positionUpdatedAt: soldier.positionUpdatedAt
  });
}));

app.post("/api/soldiers", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  res.status(410).json({
    message: "Endpoint déprécié. Utiliser /api/users/soldier-account pour créer un militaire avec compte de connexion."
  });
}));

app.post("/api/users/soldier-account", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const { name, fullName, rank, photo, sectionId, commandCategory, email } = req.body || {};
  const validCategories = ["CHEF_DE_SECTION", "SOUS_OFFICIER_ADJOINT", "SERGENT", "MILITAIRE_DU_RANG"];

  if (!name || !fullName || !rank || !photo || !sectionId) {
    res.status(400).json({ message: "name, fullName, rank, photo et sectionId sont requis" });
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

  const username = await generateUniqueUsername(String(fullName));
  const temporaryPassword = generateTemporaryPassword();

  const created = await prisma.$transaction(async (tx) => {
    const soldier = await tx.soldier.create({
      data: {
        id: `s-${randomUUID().slice(0, 8)}`,
        name: String(name).trim(),
        fullName: String(fullName).trim(),
        rank: String(rank).trim(),
        photo: String(photo).trim(),
        commandCategory: commandCategory || "MILITAIRE_DU_RANG",
        sectionId,
        createdById: req.auth.userId
      }
    });

    const user = await tx.user.create({
      data: {
        username,
        email: email ? String(email).trim().toLowerCase() : null,
        passwordHash: await hashPassword(temporaryPassword),
        role: "VIEWER",
        mustChangePassword: true,
        isActive: true
      }
    });

    await tx.issuedCredential.create({
      data: {
        userId: user.id,
        soldierId: soldier.id,
        usernameSnapshot: user.username || username,
        encryptedTempPassword: encryptTemporaryPassword(temporaryPassword),
        createdById: req.auth.userId
      }
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE_SOLDIER_ACCOUNT",
        entity: "User",
        entityId: user.id,
        actorId: req.auth.userId,
        details: {
          username: user.username,
          soldierId: soldier.id,
          sectionId: soldier.sectionId,
          commandCategory: soldier.commandCategory
        }
      }
    });

    return { soldier, user };
  });

  res.status(201).json({
    soldierId: created.soldier.id,
    username: created.user.username,
    temporaryPassword
  });
}));

app.get("/api/users/issued-credentials", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const rows = await prisma.issuedCredential.findMany({
    include: {
      soldier: {
        select: {
          id: true,
          fullName: true,
          name: true,
          rank: true
        }
      },
      createdBy: {
        select: {
          id: true,
          username: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 300
  });

  await prisma.issuedCredential.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { lastViewedAt: new Date() }
  });

  await prisma.auditLog.create({
    data: {
      action: "VIEW_CREDENTIALS",
      entity: "IssuedCredential",
      actorId: req.auth.userId,
      details: { count: rows.length }
    }
  });

  res.json(rows.map((row) => ({
    id: row.id,
    soldierId: row.soldierId,
    soldierName: row.soldier.fullName || row.soldier.name,
    rank: row.soldier.rank,
    username: row.usernameSnapshot,
    createdAt: row.createdAt,
    createdBy: row.createdBy.username || row.createdBy.id,
    passwordChangedAt: row.passwordChangedAt,
    canRevealTemporaryPassword: !row.passwordChangedAt,
    status: row.passwordChangedAt ? "PASSWORD_CHANGED" : "TEMP_PASSWORD_ACTIVE"
  })));
}));

app.get("/api/users/issued-credentials/:id/reveal", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const row = await prisma.issuedCredential.findUnique({
    where: { id: req.params.id },
    include: {
      soldier: {
        select: { fullName: true, name: true }
      }
    }
  });

  if (!row) {
    res.status(404).json({ message: "Identifiant émis introuvable" });
    return;
  }

  if (row.passwordChangedAt) {
    res.status(400).json({ message: "Le mot de passe temporaire n'est plus disponible" });
    return;
  }

  const temporaryPassword = decryptTemporaryPassword(row.encryptedTempPassword);
  if (!temporaryPassword) {
    res.status(500).json({ message: "Impossible de déchiffrer le mot de passe temporaire" });
    return;
  }

  await prisma.issuedCredential.update({
    where: { id: row.id },
    data: { lastViewedAt: new Date() }
  });

  await prisma.auditLog.create({
    data: {
      action: "REVEAL_TEMP_PASSWORD",
      entity: "IssuedCredential",
      entityId: row.id,
      actorId: req.auth.userId,
      details: {
        soldierName: row.soldier.fullName || row.soldier.name,
        username: row.usernameSnapshot
      }
    }
  });

  res.json({
    id: row.id,
    username: row.usernameSnapshot,
    temporaryPassword
  });
}));

app.post("/api/push/register", requireAuth, asyncHandler(async (req, res) => {
  const token = (req.body?.token || "").toString().trim();
  const platform = (req.body?.platform || "").toString().trim();

  if (!token) {
    res.status(400).json({ message: "token requis" });
    return;
  }

  const result = await registerPushToken({
    userId: req.auth.userId,
    token,
    platform
  });

  if (!result.ok) {
    res.status(400).json({ message: "Token push invalide" });
    return;
  }

  res.json({ ok: true });
}));

app.post("/api/push/unregister", requireAuth, asyncHandler(async (req, res) => {
  const token = (req.body?.token || "").toString().trim();
  if (!token) {
    res.status(400).json({ message: "token requis" });
    return;
  }

  await unregisterPushToken({ userId: req.auth.userId, token });
  res.json({ ok: true });
}));

app.get("/api/announcements", requireAuth, asyncHandler(async (req, res) => {
  const isAdminLike = req.auth.role === "ADMIN" || req.auth.role === "MANAGER";
  const includeArchived = isAdminLike && req.query.includeArchived === "1";
  const sectionIdQuery = (req.query.sectionId || "").toString().trim();
  const now = new Date();
  const userSectionId = isAdminLike ? null : await resolveUserSectionId(req.auth.userId);
  const visibilityWhere = buildAnnouncementVisibilityWhere(isAdminLike, userSectionId);

  const where = {
    ...(includeArchived ? {} : { isArchived: false }),
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    ...visibilityWhere,
    ...(sectionIdQuery ? { sectionId: sectionIdQuery } : {})
  };

  const rows = await prisma.announcement.findMany({
    where,
    include: {
      section: { select: { id: true, name: true } },
      createdBy: { select: { id: true, username: true } },
      reads: {
        where: { userId: req.auth.userId },
        select: { id: true }
      }
    },
    orderBy: [
      { isPinned: "desc" },
      { isUrgent: "desc" },
      { createdAt: "desc" }
    ]
  });

  const unreadCount = await prisma.announcement.count({
    where: {
      isArchived: false,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      ...visibilityWhere,
      NOT: { createdById: req.auth.userId },
      reads: {
        none: { userId: req.auth.userId }
      }
    }
  });

  res.json({
    unreadCount,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      scope: row.scope,
      sectionId: row.sectionId,
      sectionName: row.section?.name || null,
      isPinned: row.isPinned,
      isUrgent: row.isUrgent,
      isArchived: row.isArchived,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdById: row.createdById,
      createdBy: row.createdBy.username || row.createdBy.id,
      isRead: row.reads.length > 0
    }))
  });
}));

app.post("/api/announcements", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const title = (req.body?.title || "").toString().trim();
  const body = (req.body?.body || "").toString().trim();
  const scope = (req.body?.scope || "COMPANY").toString().toUpperCase();
  const sectionId = req.body?.sectionId ? String(req.body.sectionId) : null;
  const isPinned = Boolean(req.body?.isPinned);
  const isUrgent = Boolean(req.body?.isUrgent);
  const expiresAtRaw = req.body?.expiresAt;

  if (!title || !body) {
    res.status(400).json({ message: "title et body sont requis" });
    return;
  }
  if (!["REGIMENT", "COMPANY", "SECTION"].includes(scope)) {
    res.status(400).json({ message: "scope invalide" });
    return;
  }

  let section = null;
  if (scope === "SECTION") {
    if (!sectionId) {
      res.status(400).json({ message: "sectionId est requis pour scope SECTION" });
      return;
    }
    section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      res.status(400).json({ message: "sectionId invalide" });
      return;
    }
  }

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAtRaw && Number.isNaN(expiresAt.getTime())) {
    res.status(400).json({ message: "expiresAt invalide" });
    return;
  }

  const created = await prisma.announcement.create({
    data: {
      title,
      body,
      scope,
      sectionId: scope === "SECTION" ? sectionId : null,
      isPinned,
      isUrgent,
      expiresAt,
      createdById: req.auth.userId
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_ANNOUNCEMENT",
      entity: "Announcement",
      entityId: created.id,
      actorId: req.auth.userId,
      details: { scope: created.scope, sectionId: created.sectionId, isUrgent: created.isUrgent, isPinned: created.isPinned }
    }
  });

  const pushResult = await sendAnnouncementPush({ announcement: created });
  await prisma.auditLog.create({
    data: {
      action: "SEND_ANNOUNCEMENT_PUSH",
      entity: "Announcement",
      entityId: created.id,
      actorId: req.auth.userId,
      details: pushResult
    }
  });

  res.status(201).json(created);
}));

app.patch("/api/announcements/:id", requireAuth, requireRole("ADMIN", "MANAGER"), asyncHandler(async (req, res) => {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ message: "Annonce introuvable" });
    return;
  }

  const nextScope = req.body?.scope ? String(req.body.scope).toUpperCase() : existing.scope;
  if (!["REGIMENT", "COMPANY", "SECTION"].includes(nextScope)) {
    res.status(400).json({ message: "scope invalide" });
    return;
  }

  const requestedSectionId = req.body?.sectionId !== undefined ? req.body.sectionId : existing.sectionId;
  let nextSectionId = requestedSectionId ? String(requestedSectionId) : null;
  if (nextScope === "SECTION") {
    if (!nextSectionId) {
      res.status(400).json({ message: "sectionId est requis pour scope SECTION" });
      return;
    }
    const section = await prisma.section.findUnique({ where: { id: nextSectionId } });
    if (!section) {
      res.status(400).json({ message: "sectionId invalide" });
      return;
    }
  } else {
    nextSectionId = null;
  }

  const data = {
    ...(req.body?.title !== undefined ? { title: String(req.body.title).trim() } : {}),
    ...(req.body?.body !== undefined ? { body: String(req.body.body).trim() } : {}),
    ...(req.body?.isPinned !== undefined ? { isPinned: Boolean(req.body.isPinned) } : {}),
    ...(req.body?.isUrgent !== undefined ? { isUrgent: Boolean(req.body.isUrgent) } : {}),
    ...(req.body?.isArchived !== undefined ? { isArchived: Boolean(req.body.isArchived) } : {}),
    scope: nextScope,
    sectionId: nextSectionId
  };

  if (req.body?.expiresAt !== undefined) {
    if (req.body.expiresAt === null || req.body.expiresAt === "") {
      data.expiresAt = null;
    } else {
      const parsed = new Date(req.body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ message: "expiresAt invalide" });
        return;
      }
      data.expiresAt = parsed;
    }
  }

  if (data.title !== undefined && !data.title) {
    res.status(400).json({ message: "title ne peut pas être vide" });
    return;
  }
  if (data.body !== undefined && !data.body) {
    res.status(400).json({ message: "body ne peut pas être vide" });
    return;
  }

  const updated = await prisma.announcement.update({
    where: { id: existing.id },
    data
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_ANNOUNCEMENT",
      entity: "Announcement",
      entityId: updated.id,
      actorId: req.auth.userId,
      details: {
        before: {
          title: existing.title,
          scope: existing.scope,
          sectionId: existing.sectionId,
          isArchived: existing.isArchived
        },
        after: {
          title: updated.title,
          scope: updated.scope,
          sectionId: updated.sectionId,
          isArchived: updated.isArchived
        }
      }
    }
  });

  res.json(updated);
}));

app.patch("/api/soldiers/:id/photo", requireAuth, asyncHandler(async (req, res) => {
  const soldierId = String(req.params.id);
  const isAdminLike = req.auth.role === "ADMIN" || req.auth.role === "MANAGER";
  const photoDataUrl = (req.body?.photoDataUrl || "").toString().trim();
  const photoUrl = (req.body?.photoUrl || "").toString().trim();

  if (!photoDataUrl && !photoUrl) {
    res.status(400).json({ message: "photoDataUrl ou photoUrl est requis" });
    return;
  }

  const soldier = await prisma.soldier.findUnique({
    where: { id: soldierId },
    include: { section: true }
  });
  if (!soldier) {
    res.status(404).json({ message: "Militaire introuvable" });
    return;
  }

  if (!isAdminLike) {
    const ownSoldierId = await resolveUserSoldierId(req.auth.userId);
    if (!ownSoldierId || ownSoldierId !== soldierId) {
      res.status(403).json({ message: "Accès interdit" });
      return;
    }
  }

  let nextPhoto = photoUrl;
  if (photoDataUrl) {
    const parsed = parseDataUrlImage(photoDataUrl);
    if (!parsed) {
      res.status(400).json({ message: "Format image invalide (jpeg/png/webp base64 attendu)" });
      return;
    }
    if (parsed.buffer.length > 3 * 1024 * 1024) {
      res.status(400).json({ message: "Image trop volumineuse (max 3MB)" });
      return;
    }

    await fs.mkdir(soldierUploadDir, { recursive: true });
    const filename = `${soldier.id}-${Date.now()}-${randomBytes(4).toString("hex")}.${parsed.ext}`;
    const absolutePath = path.join(soldierUploadDir, filename);
    await fs.writeFile(absolutePath, parsed.buffer);
    nextPhoto = `${buildPublicBaseUrl(req)}/uploads/soldiers/${filename}`;
  } else if (!/^https?:\/\//i.test(photoUrl) && !photoUrl.startsWith("/uploads/soldiers/")) {
    res.status(400).json({ message: "photoUrl invalide" });
    return;
  }

  const updated = await prisma.soldier.update({
    where: { id: soldier.id },
    data: { photo: nextPhoto }
  });

  if (photoDataUrl) {
    await safelyDeleteLocalSoldierPhoto(soldier.photo, req);
  }

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_SOLDIER_PHOTO",
      entity: "Soldier",
      entityId: updated.id,
      actorId: req.auth.userId,
      details: { byRole: req.auth.role }
    }
  });

  res.json({
    id: updated.id,
    name: updated.name,
    fullName: updated.fullName,
    rank: updated.rank,
    photo: updated.photo,
    commandCategory: updated.commandCategory,
    sectionId: updated.sectionId,
    section: soldier.section.name,
    currentPosition: updated.currentPosition,
    availability: updated.availability,
    positionUpdatedAt: updated.positionUpdatedAt
  });
}));

app.post("/api/announcements/:id/read", requireAuth, asyncHandler(async (req, res) => {
  const announcement = await prisma.announcement.findUnique({
    where: { id: req.params.id },
    select: { id: true, isArchived: true, expiresAt: true, scope: true, sectionId: true }
  });

  if (!announcement || announcement.isArchived || (announcement.expiresAt && announcement.expiresAt < new Date())) {
    res.status(404).json({ message: "Annonce introuvable" });
    return;
  }

  const isAdminLike = req.auth.role === "ADMIN" || req.auth.role === "MANAGER";
  if (!isAdminLike && announcement.scope === "SECTION") {
    const userSectionId = await resolveUserSectionId(req.auth.userId);
    if (!userSectionId || announcement.sectionId !== userSectionId) {
      res.status(404).json({ message: "Annonce introuvable" });
      return;
    }
  }

  const read = await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId: announcement.id,
        userId: req.auth.userId
      }
    },
    update: { readAt: new Date() },
    create: {
      announcementId: announcement.id,
      userId: req.auth.userId
    }
  });

  res.json({ ok: true, readAt: read.readAt });
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
    photo: updated.photo,
    commandCategory: updated.commandCategory,
    sectionId: updated.sectionId,
    section: nextSection.name,
    currentPosition: updated.currentPosition,
    availability: updated.availability,
    positionUpdatedAt: updated.positionUpdatedAt
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
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  res.json(users);
}));

app.post("/api/admin/users", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const username = (req.body?.username || "").toString().trim().toLowerCase();
  const email = (req.body?.email || "").toString().trim().toLowerCase();
  const password = (req.body?.password || "").toString();
  const role = (req.body?.role || "VIEWER").toString().toUpperCase();
  const mustChangePassword = req.body?.mustChangePassword !== false;

  if (!username || !password || !["ADMIN", "MANAGER", "VIEWER"].includes(role)) {
    res.status(400).json({ message: "username, mot de passe et rôle valide sont requis" });
    return;
  }

  const [existingUsername, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    email ? prisma.user.findUnique({ where: { email } }) : Promise.resolve(null)
  ]);
  if (existingUsername || existingEmail) {
    res.status(409).json({ message: "Cet utilisateur existe déjà" });
    return;
  }

  const createdUser = await prisma.user.create({
    data: {
      username,
      email: email || null,
      passwordHash: await hashPassword(password),
      role,
      mustChangePassword
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "User",
      entityId: createdUser.id,
      actorId: req.auth.userId,
      details: { role: createdUser.role, username: createdUser.username, email: createdUser.email }
    }
  });

  res.status(201).json(createdUser);
}));

app.patch("/api/admin/users/:id", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const role = req.body?.role ? req.body.role.toString().toUpperCase() : undefined;
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  const mustChangePassword = typeof req.body?.mustChangePassword === "boolean" ? req.body.mustChangePassword : undefined;

  if (!role && typeof isActive !== "boolean" && typeof mustChangePassword !== "boolean") {
    res.status(400).json({ message: "Fournir role et/ou isActive et/ou mustChangePassword" });
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
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof mustChangePassword === "boolean" ? { mustChangePassword } : {})
    },
    select: { id: true, username: true, email: true, role: true, isActive: true, mustChangePassword: true }
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entity: "User",
      entityId: updated.id,
      actorId: req.auth.userId,
      details: {
        role: updated.role,
        isActive: updated.isActive,
        mustChangePassword: updated.mustChangePassword
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

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "dev-access-secret-change-me";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "dev-refresh-secret-change-me";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.warn("[SECURITY] ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET missing. Set strong secrets in server/.env for production.");
}

export function hashPassword(rawPassword) {
  return bcrypt.hash(rawPassword, 12);
}

export function verifyPassword(rawPassword, passwordHash) {
  return bcrypt.compare(rawPassword, passwordHash);
}

function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function buildAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

async function storeRefreshToken(userId) {
  const rawToken = randomBytes(48).toString("hex");
  const tokenHash = hashRefreshToken(rawToken);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    }
  });

  return rawToken;
}

export async function issueAuthTokens(user) {
  return {
    accessToken: buildAccessToken(user),
    refreshToken: await storeRefreshToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };
}

export async function rotateRefreshToken(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() }
  });

  return issueAuthTokens(session.user);
}

export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashRefreshToken(rawToken);
  const session = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!session || session.revokedAt) {
    return;
  }

  await prisma.refreshToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() }
  });
}

export function verifyAccessToken(rawToken) {
  return jwt.verify(rawToken, ACCESS_TOKEN_SECRET);
}

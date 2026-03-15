import { prisma } from "./prisma.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(value) {
  if (!value || typeof value !== "string") return false;
  return /^ExponentPushToken\[[^\]]+\]$/.test(value) || /^ExpoPushToken\[[^\]]+\]$/.test(value);
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function findRecipientUserIds(announcement) {
  if (announcement.scope !== "SECTION" || !announcement.sectionId) {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: announcement.createdById }
      },
      select: { id: true }
    });
    return users.map((user) => user.id);
  }

  const [sectionUsers, adminsAndManagers] = await Promise.all([
    prisma.issuedCredential.findMany({
      where: {
        soldier: { sectionId: announcement.sectionId },
        user: { isActive: true }
      },
      select: { userId: true },
      distinct: ["userId"]
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["ADMIN", "MANAGER"] }
      },
      select: { id: true }
    })
  ]);

  const set = new Set();
  for (const item of sectionUsers) set.add(item.userId);
  for (const user of adminsAndManagers) set.add(user.id);
  set.delete(announcement.createdById);
  return Array.from(set);
}

async function sendExpoPushMessages(messages) {
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(messages)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Push HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Réponse push invalide");
  }
}

export async function registerPushToken({ userId, token, platform }) {
  if (!isExpoPushToken(token)) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  await prisma.devicePushToken.upsert({
    where: { token },
    update: {
      userId,
      platform: platform || null,
      isActive: true,
      lastSeenAt: new Date()
    },
    create: {
      userId,
      token,
      platform: platform || null,
      isActive: true
    }
  });

  return { ok: true };
}

export async function unregisterPushToken({ userId, token }) {
  if (!token) return;

  await prisma.devicePushToken.updateMany({
    where: {
      token,
      userId
    },
    data: {
      isActive: false,
      lastSeenAt: new Date()
    }
  });
}

export async function sendAnnouncementPush({ announcement }) {
  try {
    const recipientUserIds = await findRecipientUserIds(announcement);
    if (!recipientUserIds.length) {
      return { attempted: 0, sent: 0 };
    }

    const deviceTokens = await prisma.devicePushToken.findMany({
      where: {
        isActive: true,
        userId: { in: recipientUserIds }
      },
      select: { id: true, token: true }
    });

    if (!deviceTokens.length) {
      return { attempted: 0, sent: 0 };
    }

    const messages = deviceTokens.map((item) => ({
      to: item.token,
      sound: announcement.isUrgent ? "default" : undefined,
      priority: announcement.isUrgent ? "high" : "default",
      title: announcement.isUrgent ? "Annonce urgente" : "Nouvelle annonce",
      body: announcement.title,
      data: {
        type: "announcement",
        announcementId: announcement.id,
        scope: announcement.scope,
        sectionId: announcement.sectionId || null
      }
    }));

    let sent = 0;
    const invalidTokenIds = [];
    for (const part of chunk(messages, 100)) {
      const payload = await sendExpoPushMessages(part);
      const tickets = Array.isArray(payload?.data) ? payload.data : [];
      sent += tickets.filter((ticket) => ticket?.status === "ok").length;

      tickets.forEach((ticket, index) => {
        const isInvalid = ticket?.details?.error === "DeviceNotRegistered";
        if (isInvalid) {
          const token = part[index]?.to;
          const tokenRecord = deviceTokens.find((row) => row.token === token);
          if (tokenRecord?.id) invalidTokenIds.push(tokenRecord.id);
        }
      });
    }

    if (invalidTokenIds.length) {
      await prisma.devicePushToken.updateMany({
        where: { id: { in: invalidTokenIds } },
        data: { isActive: false }
      });
    }

    return { attempted: messages.length, sent };
  } catch (error) {
    return {
      attempted: 0,
      sent: 0,
      error: error.message || "PUSH_SEND_FAILED"
    };
  }
}

export function isValidExpoPushToken(token) {
  return isExpoPushToken(token);
}

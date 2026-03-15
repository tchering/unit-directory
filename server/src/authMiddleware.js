import { verifyAccessToken } from "./auth.js";
import { prisma } from "./prisma.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Non autorisé" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        mustChangePassword: true
      }
    });
    if (!user || !user.isActive) {
      res.status(401).json({ message: "Non autorisé" });
      return;
    }

    req.auth = {
      userId: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    };

    const canBypassPasswordChange =
      req.path === "/api/auth/change-password-first-login"
      || req.path === "/api/auth/me"
      || req.path === "/api/auth/logout";

    if (user.mustChangePassword && !canBypassPasswordChange) {
      res.status(403).json({
        message: "Changement de mot de passe requis",
        code: "PASSWORD_CHANGE_REQUIRED"
      });
      return;
    }

    next();
  } catch (_error) {
    res.status(401).json({ message: "Jeton invalide ou expiré" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ message: "Accès interdit" });
      return;
    }
    next();
  };
}

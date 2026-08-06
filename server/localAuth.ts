import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { credenciaisLocais, users } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";

const BCRYPT_ROUNDS = 12;

function getJwtSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || "fallback-secret-change-me");
}

async function signLocalJwt(userId: number, username: string): Promise<string> {
  return new SignJWT({ sub: String(userId), username, authMethod: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export function registerLocalAuthRoutes(app: ReturnType<typeof Router>["stack"] extends any[] ? any : any) {
  const router = Router();

  // POST /api/auth/local/login
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ error: "Username e senha são obrigatórios." });
      }

      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Base de dados não disponível." });

      // Find credential
      const [cred] = await db.select()
        .from(credenciaisLocais)
        .where(eq(credenciaisLocais.username, username.trim().toLowerCase()))
        .limit(1);

      if (!cred || !cred.ativo) {
        return res.status(401).json({ error: "Credenciais inválidas." });
      }

      // Verify password
      const valid = await bcrypt.compare(password, cred.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Credenciais inválidas." });
      }

      // Get user
      const [user] = await db.select().from(users).where(eq(users.id, cred.userId)).limit(1);
      if (!user || (user as any).ativo === false) {
        return res.status(403).json({ error: "Conta desactivada. Contacta o administrador." });
      }

      // Sign JWT
      const token = await signLocalJwt(user.id, cred.username);

      // Set session cookie (same cookie name as OAuth so the context picks it up)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 12 * 60 * 60 * 1000, // 12h
      });

      return res.json({
        success: true,
        deveAlterarSenha: cred.deveAlterarSenha,
        user: { id: user.id, name: user.name, role: user.role },
      });
    } catch (err: any) {
      console.error("[LocalAuth] Login error:", err);
      return res.status(500).json({ error: "Erro interno. Tenta novamente." });
    }
  });

  // POST /api/auth/local/change-password  (requires valid session)
  router.post("/change-password", async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Senha actual e nova senha são obrigatórias." });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres." });
      }

      // Verify session cookie
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) return res.status(401).json({ error: "Não autenticado." });

      let payload: any;
      try {
        const { payload: p } = await jwtVerify(token, getJwtSecret());
        payload = p;
      } catch {
        return res.status(401).json({ error: "Sessão inválida." });
      }

      if (payload.authMethod !== "local") {
        return res.status(400).json({ error: "Esta operação só é válida para contas locais." });
      }

      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Base de dados não disponível." });

      const [cred] = await db.select()
        .from(credenciaisLocais)
        .where(eq(credenciaisLocais.username, payload.username))
        .limit(1);

      if (!cred) return res.status(404).json({ error: "Credencial não encontrada." });

      const valid = await bcrypt.compare(currentPassword, cred.passwordHash);
      if (!valid) return res.status(401).json({ error: "Senha actual incorrecta." });

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await db.update(credenciaisLocais)
        .set({ passwordHash: newHash, deveAlterarSenha: false })
        .where(eq(credenciaisLocais.id, cred.id));

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[LocalAuth] Change password error:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  });

  app.use("/api/auth/local", router);
}

// Helper: resolve a local JWT token to a user (used by context.ts)
export async function resolveLocalToken(token: string): Promise<{ id: number; openId: string; name: string | null; email: string | null; role: string; loginMethod: string; ativo: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if ((payload as any).authMethod !== "local") return null;
    const userId = parseInt(String(payload.sub));
    if (!userId) return null;
    const db = await getDb();
    if (!db) return null;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || (user as any).ativo === false) return null;
    return {
      id: user.id,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role,
      loginMethod: "local",
      ativo: (user as any).ativo ?? true,
    };
  } catch {
    return null;
  }
}

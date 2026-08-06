import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { resolveLocalToken } from "../localAuth";
import { COOKIE_NAME } from "../../shared/const";
import { parse as parseCookies } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Extract session token from cookie or Authorization header
    const cookieHeader = opts.req.headers.cookie;
    const cookies = cookieHeader ? parseCookies(cookieHeader) : {};
    const sessionToken = cookies[COOKIE_NAME]
      ?? (opts.req.headers.authorization?.startsWith("Bearer ")
        ? opts.req.headers.authorization.slice(7)
        : undefined);

    // Try local JWT first (authMethod: "local")
    if (sessionToken) {
      const localUser = await resolveLocalToken(sessionToken);
      if (localUser) {
        user = localUser as unknown as User;
      }
    }

    // Fall back to Manus OAuth if no local session resolved
    if (!user) {
      user = await sdk.authenticateRequest(opts.req);
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

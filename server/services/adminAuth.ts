import express from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PublicApiRule {
  methods?: string[];
  path?: string;
  prefix?: string;
}

const PUBLIC_API_RULES: PublicApiRule[] = [
  { path: "/api/health" },
  { path: "/api/webhook/lava" },
  { prefix: "/api/webhook/telegram/" },
  { prefix: "/api/webapp/" },
  { prefix: "/api/images/" },
  { methods: ["GET"], prefix: "/api/media/" },
  { methods: ["POST"], path: "/api/track" },
  { methods: ["POST"], path: "/api/payments/create" },
  { methods: ["POST"], path: "/api/payments/mock-success" },
  { methods: ["POST"], path: "/api/platform/access" },
  // Прогресс по платному курсу: свой контроль — Telegram WebApp + оплата.
  { methods: ["POST"], path: "/api/platform/lesson" },
  { methods: ["POST"], path: "/api/platform/reward" },
];

export function isApiPath(pathName: string) {
  return /^\/api(?:\/|$)/i.test(pathName);
}

export function isPublicApiPath(method: string, pathName: string) {
  // Express matches routes without regard to case or a trailing slash.
  // Apply exactly the same normalization to the allowlist and its exceptions.
  pathName = pathName.toLowerCase().replace(/\/+$/, "");
  // This legacy diagnostics path used to expose the private Telegram file-id map.
  if (pathName === "/api/media/cache") return false;

  return PUBLIC_API_RULES.some((rule) => {
    if (rule.methods && !rule.methods.includes(method.toUpperCase())) return false;
    if (rule.path && rule.path === pathName) return true;
    if (rule.prefix && pathName.startsWith(rule.prefix)) return true;
    return false;
  });
}

interface AdminAuthOptions {
  adminEmail?: string;
  allowDevBypass?: boolean;
  getSupabase: () => SupabaseClient | null;
  isProduction: boolean;
  requireMfa?: boolean;
}

export function createRequireAdminAuth({
  adminEmail = "",
  allowDevBypass = false,
  getSupabase,
  isProduction,
  requireMfa = false,
}: AdminAuthOptions) {
  const allowedAdminEmail = adminEmail.trim().toLowerCase();
  return async function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!isApiPath(req.path) || isPublicApiPath(req.method, req.path)) {
      return next();
    }

    if (!isProduction && allowDevBypass) {
      res.locals.adminUser = { id: "explicit-dev-bypass", email: "development@localhost" };
      return next();
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: "Supabase auth is not configured" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    const email = data.user.email?.toLowerCase();
    if (allowedAdminEmail && email !== allowedAdminEmail) {
      return res.status(403).json({ error: "Admin access is restricted" });
    }

    if (requireMfa) {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa
        .getAuthenticatorAssuranceLevel(token);
      if (assuranceError || assurance?.currentLevel !== "aal2") {
        return res.status(403).json({
          code: "mfa_required",
          error: "Two-factor authentication is required",
        });
      }
    }

    res.locals.adminUser = {
      id: data.user.id,
      email: data.user.email || "",
    };
    return next();
  };
}

import * as jose from "jose";
import {
  JWT_ACCESS_EXPIRES_IN,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_EXPIRES_IN,
  JWT_REFRESH_SECRET,
} from "@/server/env";
import type { JwtPayload } from "@/server/auth/jwt-payload";
import { UserRole } from "@/server/users/user-role";

const encAccess = new TextEncoder().encode(JWT_ACCESS_SECRET);
const encRefresh = new TextEncoder().encode(JWT_REFRESH_SECRET);

function normalizeRole(r: unknown): UserRole {
  if (r === UserRole.Admin || r === "admin") return UserRole.Admin;
  return UserRole.User;
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRES_IN)
    .sign(encAccess);
}

export async function signRefreshToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
    .sign(encRefresh);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, encAccess);
  const sub = Number(payload.sub);
  if (!Number.isFinite(sub) || sub < 1) {
    throw new Error("Invalid sub");
  }
  const email = typeof payload.email === "string" ? payload.email : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  return {
    sub,
    email,
    name,
    role: normalizeRole(payload.role),
  };
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, encRefresh);
  const sub = Number(payload.sub);
  if (!Number.isFinite(sub) || sub < 1) {
    throw new Error("Invalid sub");
  }
  const email = typeof payload.email === "string" ? payload.email : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  return {
    sub,
    email,
    name,
    role: normalizeRole(payload.role),
  };
}

export function decodeRefreshExp(refreshToken: string): Date {
  const parts = refreshToken.split(".");
  if (parts.length < 2) {
    throw new Error("refresh token missing exp");
  }
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const body = JSON.parse(
    Buffer.from(b64 + pad, "base64").toString("utf8"),
  ) as { exp?: unknown };
  if (typeof body.exp !== "number") {
    throw new Error("refresh token missing exp");
  }
  return new Date(body.exp * 1000);
}

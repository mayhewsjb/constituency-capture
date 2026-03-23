import bcrypt from "bcryptjs";
import { getSession } from "./session";

export const ADMIN_EMAIL = "admin@constituency-capture.gov.uk";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return null;
  }
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return null;
  }
  return session;
}

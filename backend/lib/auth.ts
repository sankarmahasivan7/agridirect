import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const SECRET_KEY = process.env.SECRET_KEY || 'agridirect-super-secret-jwt-key-2026';
const EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createAccessToken(
  userIdOrPayload: number | { id: number; email?: string; role: string },
  role?: string
): string {
  if (typeof userIdOrPayload === 'number') {
    return jwt.sign(
      { id: userIdOrPayload, sub: String(userIdOrPayload), role: role || 'buyer' },
      SECRET_KEY,
      { expiresIn: EXPIRES_IN }
    );
  }
  return jwt.sign(
    { ...userIdOrPayload, sub: String(userIdOrPayload.id) },
    SECRET_KEY,
    { expiresIn: EXPIRES_IN }
  );
}

export const createToken = createAccessToken;

export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    const id = Number(decoded.id || decoded.sub);
    if (!id || isNaN(id)) return null;
    return { id, email: decoded.email || '', role: decoded.role || '' };
  } catch {
    return null;
  }
}

export async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transporterProfile: {
          include: {
            vehicle: true,
          },
        },
        fpoProfile: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      ...user,
      userId: user.id,
    };
  } catch (error) {
    console.error('Error fetching auth user:', error);
    return null;
  }
}

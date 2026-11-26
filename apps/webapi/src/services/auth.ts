import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { authLoginInputSchema, authUserSchema, usernameSchema, type AuthUser } from '@cdp/contracts';
import { env } from '../config/env.js';
import { database } from '../config/database.js';
import { AppError } from '../errors/AppError.js';
import { AuthSessionModel, UserModel } from '../models/index.js';
import { hashPassword, verifyPassword } from '../auth/password.js';

export const SESSION_COOKIE_NAME = 'cdp_session';

export type LoginResult = { user: AuthUser; token: string; expiresAt: Date };
export interface AuthenticationService {
  login(input: unknown, actorKey: string): Promise<LoginResult>;
  authenticate(token: string): Promise<AuthUser | null>;
  logout(token: string): Promise<void>;
}

class LoginRateLimiter {
  private attempts = new Map<string, number[]>();

  constructor(private limit: number) {}

  consume(key: string) {
    const now = Date.now();
    const recent = (this.attempts.get(key) || []).filter(timestamp => timestamp > now - 60000);
    if (recent.length >= this.limit) throw new AppError(429, 'AUTH_RATE_LIMITED', '登录尝试过于频繁，请稍后再试');
    recent.push(now);
    this.attempts.set(key, recent);
  }

  clear(key: string) { this.attempts.delete(key); }
}

function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function toAuthUser(record: InstanceType<typeof UserModel>): AuthUser {
  return authUserSchema.parse({
    id: record.get('id'), username: record.get('username'), displayName: record.get('displayName'), role: record.get('role'),
  });
}

const dummyHash = hashPassword('invalid-password-used-only-for-timing');

export class AuthService implements AuthenticationService {
  private limiter: LoginRateLimiter;

  constructor(private options: { sessionTtlHours?: number; loginRateLimit?: number } = {}) {
    this.limiter = new LoginRateLimiter(options.loginRateLimit ?? env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE);
  }

  async login(rawInput: unknown, actorKey: string): Promise<LoginResult> {
    const parsed = authLoginInputSchema.safeParse(rawInput);
    if (!parsed.success)
      throw new AppError(400, 'AUTH_INPUT_INVALID', '用户名或密码格式不正确', parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })));
    const input = parsed.data;
    const rateKey = actorKey;
    this.limiter.consume(rateKey);
    const user = await UserModel.findOne({ where: { username: input.username } });
    const valid = await verifyPassword(input.password, user ? String(user.get('passwordHash')) : await dummyHash);
    if (!user || !valid || user.get('status') !== 'ENABLED')
      throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', '用户名或密码错误');

    this.limiter.clear(rateKey);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + (this.options.sessionTtlHours ?? env.AUTH_SESSION_TTL_HOURS) * 60 * 60 * 1000);
    await AuthSessionModel.destroy({ where: { expiresAt: { [Op.lte]: new Date() } } });
    await AuthSessionModel.create({ id: randomUUID(), userId: user.get('id'), tokenHash: tokenDigest(token), expiresAt });
    return { user: toAuthUser(user), token, expiresAt };
  }

  async authenticate(token: string): Promise<AuthUser | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const session = await AuthSessionModel.findOne({ where: { tokenHash: tokenDigest(token), expiresAt: { [Op.gt]: new Date() } } });
    if (!session) return null;
    const user = await UserModel.findByPk(String(session.get('userId')));
    if (!user || user.get('status') !== 'ENABLED') {
      await session.destroy();
      return null;
    }
    return toAuthUser(user);
  }

  async logout(token: string): Promise<void> {
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) await AuthSessionModel.destroy({ where: { tokenHash: tokenDigest(token) } });
  }
}

export async function setAdminUser(input: { username: string; password: string; displayName: string }): Promise<AuthUser> {
  const username = usernameSchema.parse(input.username);
  if (input.password.length < 12 || input.password.length > 256)
    throw new Error('管理员密码长度必须为 12 到 256 个字符');
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 100) throw new Error('管理员显示名称长度必须为 1 到 100 个字符');
  const passwordHash = await hashPassword(input.password);
  return database.transaction(async transaction => {
    const [user] = await UserModel.findOrCreate({
      where: { username },
      defaults: { id: randomUUID(), username, passwordHash, displayName, role: 'ADMIN', status: 'ENABLED' },
      transaction,
    });
    await user.update({ passwordHash, displayName, role: 'ADMIN', status: 'ENABLED' }, { transaction });
    await AuthSessionModel.destroy({ where: { userId: user.get('id') }, transaction });
    return toAuthUser(user);
  });
}

export function createAuthService() { return new AuthService(); }

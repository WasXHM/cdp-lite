import { randomUUID } from 'node:crypto';
import { Op, Transaction } from 'sequelize';
import {
  createUserInputSchema, managedUserSchema, updateUserInputSchema,
  type ManagedUser, type UserListQuery,
} from '@cdp/contracts';
import { database } from '../config/database.js';
import { AppError } from '../errors/AppError.js';
import { AuthSessionModel, UserModel } from '../models/index.js';
import { hashPassword } from '../auth/password.js';

type UserRecord = InstanceType<typeof UserModel>;

function toManagedUser(record: UserRecord): ManagedUser {
  return managedUserSchema.parse({
    id: record.get('id'),
    username: record.get('username'),
    displayName: record.get('displayName'),
    role: record.get('role'),
    status: record.get('status'),
    createdAt: new Date(String(record.get('createdAt'))).toISOString(),
    updatedAt: new Date(String(record.get('updatedAt'))).toISOString(),
  });
}

async function required(id: string, transaction: Transaction): Promise<UserRecord> {
  const user = await UserModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
  return user;
}

async function assertUsernameAvailable(username: string, currentId: string | undefined, transaction: Transaction) {
  const existing = await UserModel.findOne({ where: { username }, transaction, lock: transaction.LOCK.UPDATE });
  if (existing && existing.get('id') !== currentId) throw new AppError(409, 'USERNAME_CONFLICT', '用户名已存在');
}

async function assertNotLastEnabledAdmin(user: UserRecord, transaction: Transaction) {
  if (user.get('role') !== 'ADMIN' || user.get('status') !== 'ENABLED') return;
  const administrators = await UserModel.findAll({
    where: { role: 'ADMIN', status: 'ENABLED' },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (administrators.length <= 1) throw new AppError(409, 'LAST_ADMIN_REQUIRED', '系统必须保留至少一个已启用的系统管理员');
}

export const userService = {
  async list(query: UserListQuery) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.keyword ? { [Op.or]: [
        { username: { [Op.like]: `%${query.keyword}%` } },
        { displayName: { [Op.like]: `%${query.keyword}%` } },
      ] } : {}),
    };
    const { rows, count } = await UserModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    return { data: rows.map(toManagedUser), pagination: { page: query.page, pageSize: query.pageSize, total: count } };
  },

  async create(input: unknown): Promise<ManagedUser> {
    const values = createUserInputSchema.parse(input);
    const passwordHash = await hashPassword(values.password);
    return database.transaction(async transaction => {
      await assertUsernameAvailable(values.username, undefined, transaction);
      const user = await UserModel.create({
        id: randomUUID(), username: values.username, passwordHash, displayName: values.displayName,
        role: values.role, status: values.status,
      }, { transaction });
      return toManagedUser(user);
    });
  },

  async update(id: string, input: unknown, actorId: string): Promise<ManagedUser> {
    const patch = updateUserInputSchema.parse(input);
    const passwordHash = patch.password ? await hashPassword(patch.password) : undefined;
    return database.transaction(async transaction => {
      const user = await required(id, transaction);
      if (id === actorId && ((patch.role && patch.role !== user.get('role')) || (patch.status && patch.status !== user.get('status'))))
        throw new AppError(409, 'SELF_MANAGEMENT_FORBIDDEN', '不能修改自己的角色或状态');
      if (patch.username) await assertUsernameAvailable(patch.username, id, transaction);
      const removesEnabledAdmin = user.get('role') === 'ADMIN' && user.get('status') === 'ENABLED'
        && (patch.role === 'USER' || patch.status === 'DISABLED');
      if (removesEnabledAdmin) await assertNotLastEnabledAdmin(user, transaction);
      const fields = { ...patch };
      delete fields.password;
      await user.update({ ...fields, ...(passwordHash ? { passwordHash } : {}) }, { transaction });
      if (passwordHash || patch.status === 'DISABLED') await AuthSessionModel.destroy({ where: { userId: id }, transaction });
      return toManagedUser(user);
    });
  },

  async remove(id: string, actorId: string): Promise<void> {
    await database.transaction(async transaction => {
      const user = await required(id, transaction);
      if (id === actorId) throw new AppError(409, 'SELF_MANAGEMENT_FORBIDDEN', '不能删除当前登录用户');
      await assertNotLastEnabledAdmin(user, transaction);
      await user.destroy({ transaction });
    });
  },
};

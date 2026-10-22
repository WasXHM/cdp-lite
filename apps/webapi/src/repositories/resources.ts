import { randomUUID } from 'node:crypto';
import { Op, type Transaction, type WhereOptions } from 'sequelize';
import type { ListQuery } from '@cdp/contracts';
import { database } from '../config/database.js';
import { models, type Resource } from '../models/index.js';
import type { Row } from '../models/common.js';

export const repository = {
  async lock(transaction: Transaction) {
    await database.query('SELECT id FROM system_locks WHERE id = 1 FOR UPDATE', { transaction });
  },
  async find(resource: Resource, id: string, transaction?: Transaction): Promise<Row | null> {
    const record = await models[resource].findByPk(id, { transaction });
    return record ? JSON.parse(JSON.stringify(record.toJSON())) as Row : null;
  },
  async all(resource: Resource, where: WhereOptions = {}, transaction?: Transaction): Promise<Row[]> {
    const rows = await models[resource].findAll({ where, transaction, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    return JSON.parse(JSON.stringify(rows)) as Row[];
  },
  async list(resource: Resource, query: ListQuery, scope: Record<string, unknown> = {}) {
    const where: WhereOptions = { ...scope };
    if (query.status) Object.assign(where, { status: query.status });
    if (query.keyword) {
      const field = resource === 'audiences' ? 'audienceCode' : resource === 'events' ? 'eventCode' : 'fieldName';
      Object.assign(where, { [Op.or]: [{ name: { [Op.like]: `%${query.keyword}%` } }, { [field]: { [Op.like]: `%${query.keyword}%` } }] });
    }
    const result = await models[resource].findAndCountAll({
      where, order: [[query.sortBy, query.sortOrder], ['id', 'ASC']], limit: query.pageSize, offset: (query.page - 1) * query.pageSize,
    });
    return { data: JSON.parse(JSON.stringify(result.rows)) as Row[], pagination: { page: query.page, pageSize: query.pageSize, total: result.count } };
  },
  async create(resource: Resource, values: Record<string, unknown>, transaction: Transaction): Promise<Row> {
    const record = await models[resource].create({ ...values, id: randomUUID() }, { transaction });
    return JSON.parse(JSON.stringify(record.toJSON())) as Row;
  },
  async update(resource: Resource, id: string, values: Record<string, unknown>, transaction: Transaction) {
    await models[resource].update(values, { where: { id }, transaction });
    return (await repository.find(resource, id, transaction))!;
  },
  async remove(resource: Resource, id: string, transaction: Transaction) {
    await models[resource].destroy({ where: { id }, transaction });
  },
};

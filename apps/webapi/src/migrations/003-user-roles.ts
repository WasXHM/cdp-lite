import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(query: QueryInterface) {
  await query.changeColumn('users', 'role', { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'USER' });
}

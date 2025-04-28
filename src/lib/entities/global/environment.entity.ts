import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
} from '@sequelize/core';
import { Attribute, PrimaryKey, NotNull, Table } from '@sequelize/core/decorators-legacy';

@Table({
  tableName: 'environments'
})
export class Environment extends Model<InferAttributes<Environment>, InferCreationAttributes<Environment>> {
  @PrimaryKey
  @NotNull
  @Attribute(DataTypes.STRING(255))
  declare name: string;

  @NotNull
  @Attribute(DataTypes.STRING)
  declare distributionArn: string;
}
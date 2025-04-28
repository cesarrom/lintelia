import * as core from '@sequelize/core';
import { Attribute, PrimaryKey, AutoIncrement, NotNull, Table } from '@sequelize/core/decorators-legacy';

@Table({ tableName: 'tenants' })
export class Tenant extends core.Model<core.InferAttributes<Tenant>, core.InferCreationAttributes<Tenant>> {
  @Attribute(core.DataTypes.INTEGER)
  @PrimaryKey
  @AutoIncrement
  declare id: number;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  name!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  domain!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  logoUrl!: string;

  @Attribute(core.DataTypes.JSON)
  @NotNull
  pallette!: {
    primary: string;
    secondary: string;
    accent: string;
  };

  @Attribute(core.DataTypes.ARRAY(core.DataTypes.TEXT))
  allowedDomains: string[] = [];

  @Attribute(core.DataTypes.STRING)
  @NotNull
  databaseId!: string;

  @Attribute(core.DataTypes.STRING)
  @NotNull
  databaseUrl!: string;

  @Attribute(core.DataTypes.STRING)
  @NotNull
  databasePassword!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  addressLine1!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  addressLine2!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  city!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  country!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  state!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  zipCode!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  startWorkingHour!: string;

  @Attribute(core.DataTypes.STRING(255))
  @NotNull
  endWorkingHour!: string;

  @Attribute(core.DataTypes.DATE)
  createdAt!: core.CreationOptional<Date>;

  @Attribute(core.DataTypes.DATE)
  updatedAt!: core.CreationOptional<Date>;
}
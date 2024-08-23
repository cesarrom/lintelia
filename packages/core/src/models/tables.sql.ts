import { numeric, bigint, pgTable, serial, varchar, pgEnum, text } from 'drizzle-orm/pg-core';

export const applicationStatusEnum = pgEnum('application_status', ['pending', 'approved', 'rejected']);
export const documentTypesEnum = pgEnum('document_types', ['id', 'passport', 'drivers_license', 'social_security_card']);
export const revisionStatusEnum = pgEnum('revision_status', ['sent', 'pending', 'approved', 'rejected']);
export const accountTypeEnum = pgEnum('account_type', ['checking', 'savings']);
export const attachmentStageEnum = pgEnum('attachment_stage', ['identity_proof', 'address_proof', 'income_proof', 'transaction_support', 'other']);
export const incomeSourceTypeEnum = pgEnum('income_source_type', ['salary', 'investment', 'business', 'other']);
export const addressTypeEnum = pgEnum('address_type', ['physical', 'mailing']);

export const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 256 }).notNull(),
  status: applicationStatusEnum('status').default('pending'),
});

export const currencies = pgTable('currencies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 256 }).notNull(),
  symbol: varchar('symbol', { length: 256 }).notNull(),
});

export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 256 }).notNull(),
  phoneCode: varchar('phone_code', { length: 256 }).notNull(),
});

export const persons = pgTable('persons', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 256 }).notNull(),
  lastName: varchar('last_name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).notNull(),
  phoneCountryId: bigint('phone_country_id', { mode: 'number' }).references(() => countries.id).notNull(),
  phone: varchar('phone', { length: 256 }).notNull(),
  documentCountryId: bigint('document_country_id', { mode: 'number' }).references(() => countries.id).notNull(),
  documentType: documentTypesEnum('document_type').notNull(),
  documentNumber: varchar('document_number', { length: 256 }).notNull(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id),
});

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  type: addressTypeEnum('address_type').notNull(),
  addressLine1: varchar('address_line_1', { length: 256 }).notNull(),
  addressLine2: varchar('address_line_2', { length: 256 }),
  city: varchar('city', { length: 256 }).notNull(),
  state: varchar('state', { length: 256 }).notNull(),
  zipCode: varchar('zip_code', { length: 256 }).notNull(),
  countryId: bigint('country_id', { mode: 'number' }).references(() => countries.id).notNull(),
  personId: bigint('person_id', { mode: 'number' }).references(() => persons.id).notNull(),
});

export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  attachmentStage:  attachmentStageEnum('attachment_stage').notNull(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  attachmentId: bigint('attachment_id', { mode: 'number' }).notNull(),
});

export const applicationReviewer = pgTable('application_reviewer', {
  id: serial('id').primaryKey(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  reviewerId: varchar('user_id', { length: 256 }).notNull(),
});

export const revisions = pgTable('revisions', {
  id: serial('id').primaryKey(),
  applicationReviewId: bigint('application_review_id', { mode: 'number' }).references(() => applicationReviewer.id).notNull(),
  title: varchar('title', { length: 256 }).notNull(),
  explanation: text('explanation').notNull(),
  status: revisionStatusEnum('status').default('sent'),
});

export const revisionResponse = pgTable('revision_response', {
  id: serial('id').primaryKey(),
  revisionId: bigint('revision_id', { mode: 'number' }).references(() => revisions.id).notNull(),
  text: text('text'),
  attachmentId: bigint('attachment_id', { mode: 'number' }).references(() => attachments.id),
});

export const accountDetails = pgTable('account_details', {
  id: serial('id').primaryKey(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  accountId: bigint('account_id', { mode: 'number' }).references(() => accounts.id).notNull(),
  expectedIncome: numeric('expected_income').notNull(),
  expectedOutcome: numeric('expected_outcome').notNull(),
  balance: numeric('balance').notNull(),
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  currencyId: bigint('currency_id', { mode: 'number' }).references(() => currencies.id).notNull(),
  countryId: bigint('country_id', { mode: 'number' }).references(() => countries.id).notNull(),
  accountNumber: varchar('account_number', { length: 256 }),
  iban: varchar('iban', { length: 256 }),
  swift: varchar('swift', { length: 256 }),
  ownerId: bigint('owner_id', { mode: 'number' }).references(() => persons.id).notNull(),
  applicationId: bigint('listed_for_application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  alias: varchar('alias', { length: 256 }),
  type: accountTypeEnum('type').notNull(),
});

export const incomeSources = pgTable('income_sources', {
  id: serial('id').primaryKey(),
  type: incomeSourceTypeEnum('type').notNull(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  transferringEntityName:  varchar('transferring_entity_name', { length: 256 }).notNull(),
  explanation: text('explanation').notNull(),
  amount: numeric('amount').notNull(),
  currencyId: bigint('currency_id', { mode: 'number' }).references(() => currencies.id).notNull(),
  attachmentId: bigint('attachment_id', { mode: 'number' }).references(() => attachments.id),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  fromAccountId: bigint('from_account_id', { mode: 'number' }).references(() => accounts.id).notNull(),
  toAccountId: bigint('to_account_id', { mode: 'number' }).references(() => accounts.id).notNull(),
  amount: numeric('amount').notNull(),
  currencyId: bigint('currency_id', { mode: 'number' }).references(() => currencies.id).notNull(),
  attachmentId: bigint('attachment_id', { mode: 'number' }).references(() => attachments.id),
});

export const tenant = pgTable('tenant', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => applications.id).notNull(),
  countryId: bigint('country_id', { mode: 'number' }).references(() => countries.id).notNull(),
  addressId: bigint('address_id', { mode: 'number' }).references(() => addresses.id).notNull(),
  email: varchar('email', { length: 256 }).notNull(),
  phone: varchar('phone', { length: 256 }).notNull(),
  website: varchar('website', { length: 256 }).notNull(),
  logoId: bigint('logo_id', { mode: 'number' }).references(() => attachments.id),
});

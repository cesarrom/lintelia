export const WORKFLOW_EVENTS = {
  start: {
    started: 'started'
  },
  api: {
    success: 'success',
    failed: 'failed'
  },
  conditional: {
    true: 'true',
    false: 'false',
  },
  database: {
    onInsert: 'on_insert',
    onDelete: 'on_delete',
    onRead: 'on_read',
    onUpdate: 'on_update',
    onCreateTable: 'on_create_table'
  },
  decisionTable: {
    success: 'success',
  },
  documentExtractor: {
    success: 'success',
    failure: 'failure',
  },
  email: {
    success: 'success',
    failed: 'failed',
  },
  fetchUser: {
    found: 'found',
    notFound: 'notFound',
  },
  form: {
    publicUrl: 'public_url',
    success: 'form_submitted'
  },
  identityValidation: {
    validationStarted: 'validation_started',
    informationError: 'information_error',
    validationCompleted: 'validation_completed'
  },
  iterator: {
    item: 'item',
    done: 'done'
  },
  mapper: {
    mapped: 'mapped'
  },
  proofOfLife: {
    publicUrl: 'public_url',
    success: 'verified',
    failure: 'failure',
    reAttemptUrl: 're_attempt_url'
  },
  reviews: {
    assigned: 'review_assigned',
    approved: 'review_approved',
    rejected: 'review_rejected',
    additionalDataRequested: 'additional_data_requested',
    timeout: 'review_timeout'
  },
  scheduler: {
    timerStarted: 'started',
    done: 'done'
  },
  wizard: {
    publicUrl: 'publicUrl',
    stepStarted: 'stepStarted',
    stepFinished: 'stepFinished',
    end: 'end',
  },
  workflow: {
    started: 'started',
    done: 'finished'
  }
} as const;
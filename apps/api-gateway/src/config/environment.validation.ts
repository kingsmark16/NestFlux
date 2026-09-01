import Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  API_PREFIX: Joi.string()
    .pattern(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/)
    .default('api/v1'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  RABBITMQ_ASSET_QUEUE: Joi.string()
    .pattern(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)
    .default('asset-processing'),
  OUTBOX_DISPATCH_ENABLED: Joi.boolean().default(true),
  OUTBOX_POLL_INTERVAL_MS: Joi.number()
    .integer()
    .min(100)
    .max(60_000)
    .default(1000),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(100).default(10),
  OUTBOX_CLAIM_TTL_MS: Joi.number()
    .integer()
    .min(1000)
    .max(3_600_000)
    .default(60_000),
});

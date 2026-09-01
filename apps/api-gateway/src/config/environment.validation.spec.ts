import { environmentValidationSchema } from './environment.validation.js';

describe('environmentValidationSchema', () => {
  const databaseUrl =
    'postgresql://user:password@localhost:5432/nestflux?schema=public';
  const rabbitmqUrl = 'amqp://user:password@localhost:5672/nestflux';

  it('applies development defaults', () => {
    const { error, value } = environmentValidationSchema.validate({
      DATABASE_URL: databaseUrl,
      RABBITMQ_URL: rabbitmqUrl,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      API_PREFIX: 'api/v1',
      DATABASE_URL: databaseUrl,
      RABBITMQ_URL: rabbitmqUrl,
      RABBITMQ_ASSET_QUEUE: 'asset-processing',
    });
  });

  it.each([
    [
      'NODE_ENV',
      {
        NODE_ENV: 'staging',
        DATABASE_URL: databaseUrl,
        RABBITMQ_URL: rabbitmqUrl,
      },
    ],
    [
      'PORT',
      {
        PORT: 70000,
        DATABASE_URL: databaseUrl,
        RABBITMQ_URL: rabbitmqUrl,
      },
    ],
    [
      'API_PREFIX',
      {
        API_PREFIX: '/api/v1',
        DATABASE_URL: databaseUrl,
        RABBITMQ_URL: rabbitmqUrl,
      },
    ],
    [
      'DATABASE_URL',
      {
        DATABASE_URL: 'not-a-postgres-url',
        RABBITMQ_URL: rabbitmqUrl,
      },
    ],
    [
      'RABBITMQ_URL',
      {
        DATABASE_URL: databaseUrl,
        RABBITMQ_URL: 'http://localhost:15672',
      },
    ],
    [
      'RABBITMQ_ASSET_QUEUE',
      {
        DATABASE_URL: databaseUrl,
        RABBITMQ_URL: rabbitmqUrl,
        RABBITMQ_ASSET_QUEUE: 'Asset Processing',
      },
    ],
  ])('rejects an invalid %s value', (field, environment) => {
    const { error } = environmentValidationSchema.validate(environment);

    expect(error).toBeDefined();
    expect(error?.details[0]?.path[0]).toBe(field);
  });
});

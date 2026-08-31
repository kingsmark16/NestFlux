import { environmentValidationSchema } from './environment.validation.js';

describe('environmentValidationSchema', () => {
  const databaseUrl =
    'postgresql://user:password@localhost:5432/nestflux?schema=public';

  it('applies development defaults', () => {
    const { error, value } = environmentValidationSchema.validate({
      DATABASE_URL: databaseUrl,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      API_PREFIX: 'api/v1',
      DATABASE_URL: databaseUrl,
    });
  });

  it.each([
    ['NODE_ENV', { NODE_ENV: 'staging', DATABASE_URL: databaseUrl }],
    ['PORT', { PORT: 70000, DATABASE_URL: databaseUrl }],
    ['API_PREFIX', { API_PREFIX: '/api/v1', DATABASE_URL: databaseUrl }],
    ['DATABASE_URL', { DATABASE_URL: 'not-a-postgres-url' }],
  ])('rejects an invalid %s value', (field, environment) => {
    const { error } = environmentValidationSchema.validate(environment);

    expect(error).toBeDefined();
    expect(error?.details[0]?.path[0]).toBe(field);
  });
});

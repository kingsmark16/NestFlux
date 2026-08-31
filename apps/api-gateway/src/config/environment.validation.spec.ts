import { environmentValidationSchema } from './environment.validation.js';

describe('environmentValidationSchema', () => {
  const validationOptions = {
    abortEarly: false,
    allowUnknown: true,
  };

  it('applies development defaults', () => {
    const { error, value } = environmentValidationSchema.validate(
      {},
      validationOptions,
    );

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      API_PREFIX: 'api/v1',
    });
  });

  it('rejects invalid environment values', () => {
    const { error } = environmentValidationSchema.validate(
      {
        NODE_ENV: 'staging',
        PORT: 70000,
        API_PREFIX: '/api/v1',
      },
      validationOptions,
    );

    expect(error).toBeDefined();
    expect(error?.details).toHaveLength(3);
  });
});

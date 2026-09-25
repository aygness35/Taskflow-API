import Joi from 'joi';
export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .pattern(/^file:.+/)
    .required(),
  JWT_SECRET: Joi.string()
    .min(32)
    .invalid('replace-with-a-random-secret-at-least-32-characters')
    .required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid(
      Joi.ref('JWT_SECRET'),
      'replace-with-a-different-random-secret-at-least-32-characters',
    )
    .required(),
  CORS_ORIGINS: Joi.string()
    .custom((value: string, helpers) => {
      try {
        for (const origin of value.split(',')) {
          const url = new URL(origin.trim());
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.origin !== origin.trim()
          )
            return helpers.error('any.invalid');
        }
        return value;
      } catch {
        return helpers.error('any.invalid');
      }
    })
    .required(),
});

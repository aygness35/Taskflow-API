import { isISO8601, registerDecorator } from 'class-validator';

// Accept only calendar timestamps with an explicit offset, as advertised by OpenAPI.
// ISO week/ordinal dates are valid ISO 8601 but are not supported by JS Date.
export function IsDateTime() {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDateTime',
      target: object.constructor,
      propertyName,
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
              value,
            ) &&
            isISO8601(value, { strict: true }) &&
            Number.isFinite(Date.parse(value))
          );
        },
        defaultMessage: () =>
          `${propertyName} must be a calendar date-time with Z or an explicit offset (millisecond precision maximum)`,
      },
    });
  };
}

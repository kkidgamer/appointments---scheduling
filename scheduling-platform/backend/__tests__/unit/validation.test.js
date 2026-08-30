const {
  isRequired,
  isEmail,
  isPhone,
  isPositiveInt,
  isEnum,
  isValidDate,
  validate,
} = require('../../src/utils/validation');

describe('Validation Utilities', () => {
  describe('isRequired', () => {
    test('returns null for valid string', () => {
      expect(isRequired('hello', 'Name')).toBeNull();
    });

    test('returns error for undefined', () => {
      expect(isRequired(undefined, 'Name')).toBe('Name is required');
    });

    test('returns error for null', () => {
      expect(isRequired(null, 'Name')).toBe('Name is required');
    });

    test('returns error for empty string', () => {
      expect(isRequired('', 'Name')).toBe('Name is required');
    });

    test('returns error for whitespace-only string', () => {
      expect(isRequired('   ', 'Name')).toBe('Name is required');
    });
  });

  describe('isEmail', () => {
    test('returns null for valid email', () => {
      expect(isEmail('test@example.com')).toBeNull();
    });

    test('returns null for email with subdomain', () => {
      expect(isEmail('user@mail.example.co.uk')).toBeNull();
    });

    test('returns error for invalid email', () => {
      expect(isEmail('notanemail')).toBe('Invalid email address');
    });

    test('returns null for empty value (optional field)', () => {
      expect(isEmail(null)).toBeNull();
      expect(isEmail(undefined)).toBeNull();
    });
  });

  describe('isPhone', () => {
    test('returns null for valid phone numbers', () => {
      expect(isPhone('+1234567890')).toBeNull();
      expect(isPhone('123-456-7890')).toBeNull();
      expect(isPhone('(123) 456-7890')).toBeNull();
    });

    test('returns error for invalid phone', () => {
      expect(isPhone('abc')).toBe('Invalid phone number');
    });

    test('returns null for empty value (optional field)', () => {
      expect(isPhone(null)).toBeNull();
    });
  });

  describe('isPositiveInt', () => {
    test('returns null for positive integer', () => {
      expect(isPositiveInt(5, 'Count')).toBeNull();
    });

    test('returns error for zero', () => {
      expect(isPositiveInt(0, 'Count')).toBe('Count must be a positive integer');
    });

    test('returns error for negative', () => {
      expect(isPositiveInt(-1, 'Count')).toBe('Count must be a positive integer');
    });

    test('returns null for undefined (optional)', () => {
      expect(isPositiveInt(undefined, 'Count')).toBeNull();
    });
  });

  describe('isEnum', () => {
    test('returns null for valid enum value', () => {
      expect(isEnum('walk_in', ['walk_in', 'phone'], 'Source')).toBeNull();
    });

    test('returns error for invalid enum value', () => {
      expect(isEnum('invalid', ['walk_in', 'phone'], 'Source')).toBe(
        'Source must be one of: walk_in, phone'
      );
    });

    test('returns null for empty value (optional)', () => {
      expect(isEnum(null, ['walk_in'], 'Source')).toBeNull();
    });
  });

  describe('isValidDate', () => {
    test('returns null for valid date string', () => {
      expect(isValidDate('2024-01-15T10:00:00Z')).toBeNull();
    });

    test('returns error for invalid date', () => {
      expect(isValidDate('not-a-date')).toBe('Invalid date');
    });

    test('returns error for empty value', () => {
      expect(isValidDate(null)).toBe('Date is required');
      expect(isValidDate(undefined)).toBe('Date is required');
    });
  });

  describe('validate', () => {
    test('returns empty array for valid body', () => {
      const body = { name: 'John', email: 'john@example.com' };
      const schema = {
        name: [(v) => isRequired(v, 'Name')],
        email: [(v) => isRequired(v, 'Email'), isEmail],
      };
      expect(validate(body, schema)).toEqual([]);
    });

    test('returns errors for invalid body', () => {
      const body = { name: '', email: 'invalid' };
      const schema = {
        name: [(v) => isRequired(v, 'Name')],
        email: [(v) => isRequired(v, 'Email'), isEmail],
      };
      const errors = validate(body, schema);
      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('name');
      expect(errors[1].field).toBe('email');
    });

    test('stops at first error per field', () => {
      const body = { name: '' };
      const schema = {
        name: [(v) => isRequired(v, 'Name'), () => 'Second error'],
      };
      const errors = validate(body, schema);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Name is required');
    });
  });
});

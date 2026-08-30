/**
 * Common validation helpers for route handlers.
 */

function isRequired(value, fieldName) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
}

function isEmail(value) {
  if (!value) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(value) ? null : 'Invalid email address';
}

function isPhone(value) {
  if (!value) return null;
  // Basic phone validation: allows +, digits, spaces, dashes, parens
  const re = /^\+?[\d\s\-()]{7,20}$/;
  return re.test(value) ? null : 'Invalid phone number';
}

function isPositiveInt(value, fieldName) {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return `${fieldName} must be a positive integer`;
  return null;
}

function isEnum(value, allowedValues, fieldName) {
  if (!value) return null;
  return allowedValues.includes(value) ? null : `${fieldName} must be one of: ${allowedValues.join(', ')}`;
}

function isValidDate(value) {
  if (!value) return 'Date is required';
  const d = new Date(value);
  return !isNaN(d.getTime()) ? null : 'Invalid date';
}

/**
 * Validate a request body and return errors array (empty = valid).
 * schema: { field: [validatorFn, ...], ... }
 * All validator functions return null on success, error string on failure.
 */
function validate(body, schema) {
  const errors = [];
  for (const [field, validators] of Object.entries(schema)) {
    for (const validateFn of validators) {
      const err = validateFn(body[field]);
      if (err) {
        errors.push({ field, message: err });
        break; // one error per field is enough
      }
    }
  }
  return errors;
}

module.exports = { isRequired, isEmail, isPhone, isPositiveInt, isEnum, isValidDate, validate };

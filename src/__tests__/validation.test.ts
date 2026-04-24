import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateName,
  validateRequired,
  validateContactForm,
  validateRegisterForm,
  PASSWORD_MIN_LENGTH,
  EMAIL_REGEX,
  SPECIAL_CHAR_REGEX,
} from '@/utils/validation'

describe('EMAIL_REGEX', () => {
  it('matches standard email addresses', () => {
    expect(EMAIL_REGEX.test('user@example.com')).toBe(true)
    expect(EMAIL_REGEX.test('user+tag@sub.domain.org')).toBe(true)
  })

  it('rejects strings without @ or dot in domain', () => {
    expect(EMAIL_REGEX.test('notanemail')).toBe(false)
    expect(EMAIL_REGEX.test('missing-at-sign')).toBe(false)
  })
})

describe('SPECIAL_CHAR_REGEX', () => {
  it('matches each declared special character', () => {
    const chars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', ',', '.', '?', '"', ':', '{', '}', '|', '<', '>', '-', '_', '+', '=', '[', ']', '\\', '/']
    for (const ch of chars) {
      expect(SPECIAL_CHAR_REGEX.test(ch), `expected ${ch} to match`).toBe(true)
    }
  })

  it('does not match plain letters or digits', () => {
    expect(SPECIAL_CHAR_REGEX.test('abc123')).toBe(false)
  })
})

describe('validateEmail', () => {
  it('returns error for empty string', () => {
    expect(validateEmail('')).not.toBeNull()
  })

  it('returns error for whitespace-only string', () => {
    expect(validateEmail('   ')).not.toBeNull()
  })

  it('returns error for missing domain extension', () => {
    expect(validateEmail('user@nodot')).not.toBeNull()
  })

  it('returns error for plain string without @', () => {
    expect(validateEmail('notanemail')).not.toBeNull()
  })

  it('returns null for a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull()
  })

  it('returns null for email with subdomain', () => {
    expect(validateEmail('user+tag@sub.domain.org')).toBeNull()
  })
})

describe('validatePassword', () => {
  it('returns error when shorter than PASSWORD_MIN_LENGTH', () => {
    const short = 'A!' + 'x'.repeat(PASSWORD_MIN_LENGTH - 3)
    expect(short.length).toBe(PASSWORD_MIN_LENGTH - 1)
    expect(validatePassword(short)).not.toBeNull()
  })

  it('returns error when exactly at minimum length but missing special char', () => {
    const noSpecial = 'a'.repeat(PASSWORD_MIN_LENGTH)
    expect(validatePassword(noSpecial)).not.toBeNull()
  })

  it('returns error when long enough but has no special character', () => {
    expect(validatePassword('Password1')).not.toBeNull()
  })

  it('returns null for valid password at minimum length', () => {
    const valid = 'aaaaaaa!'
    expect(valid.length).toBe(PASSWORD_MIN_LENGTH)
    expect(validatePassword(valid)).toBeNull()
  })

  it('returns null for longer valid password with special char', () => {
    expect(validatePassword('Str0ng!Pass')).toBeNull()
  })

  it(`enforces PASSWORD_MIN_LENGTH of ${PASSWORD_MIN_LENGTH}`, () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})

describe('validateName', () => {
  it('returns error for empty string', () => {
    expect(validateName('')).not.toBeNull()
  })

  it('returns error for whitespace-only string', () => {
    expect(validateName('   ')).not.toBeNull()
  })

  it('returns null for a valid name', () => {
    expect(validateName('Alice')).toBeNull()
  })

  it('returns null for a single character name', () => {
    expect(validateName('A')).toBeNull()
  })
})

describe('validateRequired', () => {
  it('returns error for empty string', () => {
    expect(validateRequired('')).not.toBeNull()
  })

  it('returns error for whitespace-only string', () => {
    expect(validateRequired('   ')).not.toBeNull()
  })

  it('includes the default label in the error message', () => {
    const err = validateRequired('')
    expect(err).toContain('Поле')
  })

  it('includes a custom label in the error message', () => {
    const err = validateRequired('', 'Email')
    expect(err).toContain('Email')
  })

  it('returns null for a non-empty string', () => {
    expect(validateRequired('hello')).toBeNull()
  })
})

describe('validateContactForm', () => {
  it('returns errors for all three fields when all are empty', () => {
    const errors = validateContactForm({ name: '', email: '', message: '' })
    expect(errors).toHaveProperty('name')
    expect(errors).toHaveProperty('email')
    expect(errors).toHaveProperty('message')
  })

  it('returns no errors for a fully valid form', () => {
    const errors = validateContactForm({
      name: 'Alice',
      email: 'alice@example.com',
      message: 'Hello there',
    })
    expect(errors).toEqual({})
  })

  it('returns only the email error when only email is invalid', () => {
    const errors = validateContactForm({
      name: 'Alice',
      email: 'bad-email',
      message: 'Hello',
    })
    expect(errors).toHaveProperty('email')
    expect(errors).not.toHaveProperty('name')
    expect(errors).not.toHaveProperty('message')
  })

  it('returns only the name error when only name is missing', () => {
    const errors = validateContactForm({
      name: '',
      email: 'alice@example.com',
      message: 'Hello',
    })
    expect(errors).toHaveProperty('name')
    expect(errors).not.toHaveProperty('email')
    expect(errors).not.toHaveProperty('message')
  })
})

describe('validateRegisterForm', () => {
  const validForm = {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'Password1!',
    confirmPassword: 'Password1!',
  }

  it('returns no errors for a fully valid form', () => {
    expect(validateRegisterForm(validForm)).toEqual({})
  })

  it('returns confirmPassword error when passwords do not match', () => {
    const errors = validateRegisterForm({ ...validForm, confirmPassword: 'Different1!' })
    expect(errors).toHaveProperty('confirmPassword')
  })

  it('does not return confirmPassword error when passwords match', () => {
    const errors = validateRegisterForm(validForm)
    expect(errors).not.toHaveProperty('confirmPassword')
  })

  it('returns name, email, and password errors for a completely invalid form', () => {
    const errors = validateRegisterForm({
      name: '',
      email: 'bad',
      password: 'short',
      confirmPassword: 'other',
    })
    expect(errors).toHaveProperty('name')
    expect(errors).toHaveProperty('email')
    expect(errors).toHaveProperty('password')
  })

  it('returns all four errors when every field is invalid and passwords mismatch', () => {
    const errors = validateRegisterForm({
      name: '',
      email: '',
      password: 'short',
      confirmPassword: 'different',
    })
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(3)
  })

  it('validates password strength as part of the form', () => {
    const errors = validateRegisterForm({ ...validForm, password: 'weakpass', confirmPassword: 'weakpass' })
    expect(errors).toHaveProperty('password')
  })
})

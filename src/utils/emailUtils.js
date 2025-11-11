// src/utils/emailUtils.js

/**
 * Normalizes email address by trimming whitespace and converting to lowercase
 * @param {string} email - Raw email input
 * @returns {string} - Normalized email
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
};

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates and normalizes email
 * @param {string} email - Raw email input
 * @returns {{ isValid: boolean, email: string, error: string|null }}
 */
const validateAndNormalizeEmail = (email) => {
  if (!email) {
    return {
      isValid: false,
      email: '',
      error: 'Email is required'
    };
  }

  const normalized = normalizeEmail(email);

  if (!isValidEmail(normalized)) {
    return {
      isValid: false,
      email: normalized,
      error: 'Invalid email format'
    };
  }

  return {
    isValid: true,
    email: normalized,
    error: null
  };
};

/**
 * Extracts username from email (part before @)
 * @param {string} email - Email address
 * @returns {string} - Username portion
 */
const getUsernameFromEmail = (email) => {
  const normalized = normalizeEmail(email);
  return normalized.split('@')[0] || '';
};

/**
 * Masks email for privacy (e.g., j***@example.com)
 * @param {string} email - Email to mask
 * @returns {string} - Masked email
 */
const maskEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return email;
  }

  const [username, domain] = normalized.split('@');
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  
  const maskedUsername = username[0] + '*'.repeat(username.length - 2) + username[username.length - 1];
  return `${maskedUsername}@${domain}`;
};

module.exports = {
  normalizeEmail,
  isValidEmail,
  validateAndNormalizeEmail,
  getUsernameFromEmail,
  maskEmail
};
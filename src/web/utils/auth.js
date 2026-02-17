// Authentication utility functions

export function validateCredentials(email, password) {
  if (!email || !password) {
    return { valid: false, error: 'Email and password are required' }
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' }
  }
  return { valid: true }
}

export function validateRegistration(email, password, confirmPassword) {
  const credCheck = validateCredentials(email, password)
  if (!credCheck.valid) return credCheck

  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' }
  }
  return { valid: true }
}

/**
 * Validates that the selected login role matches the role the user registered with.
 * Prevents a user from logging in as both passenger and airline with the same email.
 *
 * @param {string} selectedRole - The role selected on the login form ('passenger' or 'airline')
 * @param {string|undefined} registeredRole - The role stored in user_metadata from sign-up
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLoginRole(selectedRole, registeredRole) {
  if (!selectedRole) {
    return { valid: false, error: 'Please select a user type' }
  }
  if (!registeredRole) {
    // No registered role found in metadata — allow login (backwards compatibility)
    return { valid: true }
  }
  if (selectedRole !== registeredRole) {
    return {
      valid: false,
      error: `This account is registered as a ${registeredRole}. Please select "${registeredRole}" to log in.`,
    }
  }
  return { valid: true }
}

// Authentication utility functions

export function validateCredentials(username, password) {
  // TODO: Replace with actual validation logic
  if (!username || !password) {
    return { valid: false, error: 'Username and password are required' }
  }
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' }
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' }
  }
  return { valid: true }
}

export function validateRegistration(username, password, confirmPassword) {
  const credCheck = validateCredentials(username, password)
  if (!credCheck.valid) return credCheck

  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' }
  }
  return { valid: true }
}

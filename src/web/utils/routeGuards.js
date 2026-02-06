// Route guard utilities

export function requireAuth(user) {
  if (!user) {
    return { authorized: false, redirectTo: '/login' }
  }
  return { authorized: true }
}

export function requirePassenger(user) {
  if (!user) {
    return { authorized: false, redirectTo: '/login' }
  }
  if (user.role !== 'passenger') {
    return { authorized: false, redirectTo: '/airline/dashboard' }
  }
  return { authorized: true }
}

export function requireAirline(user) {
  if (!user) {
    return { authorized: false, redirectTo: '/login' }
  }
  if (user.role !== 'airline') {
    return { authorized: false, redirectTo: '/passenger/dashboard' }
  }
  return { authorized: true }
}

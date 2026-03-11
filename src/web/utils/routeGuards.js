// Route guard utilities

const AIRLINE_HOME_ROUTE = '/airline/claims'
const PASSENGER_HOME_ROUTE = '/passenger/register-flight'

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
    return { authorized: false, redirectTo: AIRLINE_HOME_ROUTE }
  }
  return { authorized: true }
}

export function requireAirline(user) {
  if (!user) {
    return { authorized: false, redirectTo: '/login' }
  }
  if (user.role !== 'airline') {
    return { authorized: false, redirectTo: PASSENGER_HOME_ROUTE }
  }
  return { authorized: true }
}

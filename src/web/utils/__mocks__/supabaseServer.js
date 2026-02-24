/**
 * Jest manual mock for utils/supabaseServer.
 *
 * When a test does `jest.mock('../../utils/supabaseServer')` Jest will resolve
 * to this file automatically (because it sits in __mocks__ next to the real
 * module).  We re-export `getActiveMock` from the test helpers so every
 * handler call uses the mock that was configured via `mockSupabase()`.
 */
import { getActiveMock } from '../../__tests__/helpers/setup'

export function getSupabaseAdmin() {
  return getActiveMock()
}

/**
 * PostgREST types every payload as nullable, but an RPC declared to return a row never sends
 * null on success. Use after the `error` check to hand callers the row itself.
 */
export const requireRow = <T>(data: T | null): T => {
  if (data === null) {
    throw new Error('The database returned no row.')
  }
  return data
}

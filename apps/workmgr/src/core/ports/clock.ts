/**
 * Minimal clock port for injecting time in domain logic and services.
 *
 * Keeping time behind an interface lets tests pass a fixed or stepped clock
 * instead of relying on `new Date()`, making time-sensitive assertions
 * deterministic.
 */
export interface Clock {
  /**
   * Return the current instant as an ISO-8601 string
   * (e.g. `"2026-06-30T08:00:00.000Z"`).
   *
   * @returns ISO-8601 UTC datetime string.
   */
  now(): string
}

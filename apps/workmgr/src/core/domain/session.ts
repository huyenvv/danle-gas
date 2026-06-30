/**
 * Represents the authenticated caller for the current request.
 *
 * A `Session` is created after the SSO access token has been validated and
 * the user's profile resolved. It is passed into service methods that need to
 * know *who* is acting (for authorisation checks and audit logging).
 */
export interface Session {
  /** Unique user identifier (numeric row id or SSO-issued string id). */
  userId: string | number

  /** Human-readable display name (e.g. "Nguyễn Văn A"). */
  name: string

  /** Login handle / email used to authenticate. */
  username: string

  /** Role assigned to this user in the current app (e.g. `"admin"`, `"Nhân viên"`). */
  role: string
}

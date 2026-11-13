/**
 * Platform authentication type definitions and RFC 7807 problem details model.
 */

export type PlatformUserRole = 'SUPER_ADMIN' | 'PLATFORM_STAFF';

/**
 * PlatformUser represents an authenticated platform administrative user.
 */
export interface PlatformUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: PlatformUserRole;
}

/**
 * AuthTokens encapsulates the JWT access and refresh token pair with expiration timestamp.
 */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * LoginResponse encapsulates the response structure returned by POST /api/v1/platform/auth/login.
 */
export interface LoginResponse {
  tokens: AuthTokens;
  user: PlatformUser;
}

/**
 * ProblemDetails adheres to the RFC 7807 specification for API error responses.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  invalid_params?: Array<{
    field: string;
    message: string;
    rule?: string;
  }>;
}

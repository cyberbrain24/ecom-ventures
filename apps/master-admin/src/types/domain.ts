/**
 * Domain item and registration payload type definitions.
 */

export type SSLStatus = 'PENDING' | 'ACTIVE' | 'FAILED' | 'REVOKED';

export interface DomainItem {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  domain: string;
  is_primary: boolean;
  is_custom: boolean;
  ssl_status: SSLStatus;
  verification_token: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AddDomainPayload {
  store_id: string;
  domain: string;
  is_custom: boolean;
  is_primary: boolean;
}

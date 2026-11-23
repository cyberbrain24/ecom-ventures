export interface StorageSettings {
  id: string;
  provider: 'local' | 'cloudflare_r2';
  is_active: boolean;
  account_id: string;
  bucket_name: string;
  access_key_id: string;
  has_secret_access_key: boolean;
  public_url: string;
  region: string;
  local_base_path: string;
  local_base_url: string;
  last_tested_at?: string;
  last_test_status?: 'CONNECTED' | 'FAILED';
  last_test_error?: string;
  updated_at: string;
}

export interface UpdateStorageSettingsRequest {
  provider: 'local' | 'cloudflare_r2';
  account_id: string;
  bucket_name: string;
  access_key_id: string;
  secret_access_key?: string;
  public_url: string;
  region: string;
}

export interface TestConnectionRequest {
  account_id: string;
  bucket_name: string;
  access_key_id: string;
  secret_access_key?: string;
  region?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  latency_ms: number;
  bucket_name: string;
  tested_at: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  content_type: string;
}

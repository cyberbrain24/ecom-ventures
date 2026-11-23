import { api } from './api';
import {
  StorageSettings,
  UpdateStorageSettingsRequest,
  TestConnectionRequest,
  TestConnectionResponse,
  UploadResult,
} from '../types/storage';

export async function fetchStorageSettings(): Promise<StorageSettings> {
  const response = await api.get<{ data: StorageSettings }>('/platform/storage/settings');
  return response.data.data;
}

export async function updateStorageSettings(req: UpdateStorageSettingsRequest): Promise<StorageSettings> {
  const response = await api.put<{ data: StorageSettings }>('/platform/storage/settings', req);
  return response.data.data;
}

export async function testStorageConnection(req: TestConnectionRequest): Promise<TestConnectionResponse> {
  const response = await api.post<{ data: TestConnectionResponse }>('/platform/storage/test', req);
  return response.data.data;
}

export async function resetStorageToLocal(): Promise<StorageSettings> {
  const response = await api.post<{ data: StorageSettings }>('/platform/storage/reset');
  return response.data.data;
}

export async function uploadTestAsset(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<{ data: UploadResult }>('/platform/storage/upload-test', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

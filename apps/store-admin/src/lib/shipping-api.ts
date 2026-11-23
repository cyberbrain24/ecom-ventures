/**
 * Delivery zone and hierarchical locations (Districts & Thanas) API calls for store admin.
 */
import { ApiError, authorizedRequest } from './api';

/** A delivery zone as the shipping screen needs it. */
export interface ShippingZone {
  id: string;
  district: string;
  zone: string;
  shippingFee: number;
  thanas: string[];
}

export interface ShippingZoneInput {
  district: string;
  zone: string;
  shippingFee: number;
  thanas: string[];
}

export interface DistrictEntity {
  id: number;
  name: string;
  division: string;
  total_thanas: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DistrictInput {
  name: string;
  division?: string;
  is_active: boolean;
}

export interface ThanaEntity {
  id: number;
  district_id: number;
  district_name: string;
  name: string;
  shipping_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThanaInput {
  district_id: number;
  name: string;
  shipping_cost: number;
  is_active: boolean;
}

type Json = Record<string, unknown>;

function invalid(what: string): ApiError {
  return new ApiError(200, 'INVALID_RESPONSE', `The server sent ${what} in an unexpected format.`, false);
}

function parseZone(raw: unknown): ShippingZone {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw invalid('a delivery zone');
  const r = raw as Json;
  const id = r.id;
  const district = r.district;
  const zone = r.zone;
  const fee = r.shipping_fee;
  const thanas = r.thanas;
  if (typeof id !== 'string' || typeof district !== 'string' || typeof zone !== 'string') throw invalid('a delivery zone');
  if (typeof fee !== 'number' || !Number.isFinite(fee)) throw invalid('a delivery zone fee');
  if (!Array.isArray(thanas) || thanas.some((t) => typeof t !== 'string')) throw invalid('the areas of a delivery zone');
  return { id, district, zone, shippingFee: fee, thanas: thanas as string[] };
}

function zoneBody(input: ShippingZoneInput): Record<string, unknown> {
  return {
    district: input.district,
    zone: input.zone,
    shipping_fee: input.shippingFee,
    thanas: input.thanas,
  };
}

export async function fetchShippingZones(): Promise<ShippingZone[]> {
  const data = await authorizedRequest<unknown>('/shipping/zones', { method: 'GET' });
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) throw invalid('the delivery zone list');
  return data.map(parseZone);
}

export async function createShippingZone(input: ShippingZoneInput): Promise<ShippingZone> {
  const data = await authorizedRequest<unknown>('/shipping/zones', { method: 'POST', body: JSON.stringify(zoneBody(input)) });
  return parseZone(data);
}

export async function updateShippingZone(id: string, input: ShippingZoneInput): Promise<ShippingZone> {
  const data = await authorizedRequest<unknown>(`/shipping/zones/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(zoneBody(input)),
  });
  return parseZone(data);
}

export async function deleteShippingZone(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/shipping/zones/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// -------------------------------------------------------------
// Locations Hierarchical APIs (Districts & Thanas)
// -------------------------------------------------------------

export async function fetchDistricts(search: string = ''): Promise<DistrictEntity[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await authorizedRequest<DistrictEntity[]>(`/shipping/locations/districts${params}`, { method: 'GET' });
  return data || [];
}

export async function createDistrict(input: DistrictInput): Promise<DistrictEntity> {
  return authorizedRequest<DistrictEntity>('/shipping/locations/districts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateDistrict(id: number, input: DistrictInput): Promise<DistrictEntity> {
  return authorizedRequest<DistrictEntity>(`/shipping/locations/districts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteDistrict(id: number): Promise<void> {
  await authorizedRequest<unknown>(`/shipping/locations/districts/${id}`, { method: 'DELETE' });
}

export async function fetchThanas(districtId?: number, search: string = ''): Promise<ThanaEntity[]> {
  const q: string[] = [];
  if (districtId) q.push(`district_id=${districtId}`);
  if (search) q.push(`search=${encodeURIComponent(search)}`);
  const queryStr = q.length > 0 ? `?${q.join('&')}` : '';
  const data = await authorizedRequest<ThanaEntity[]>(`/shipping/locations/thanas${queryStr}`, { method: 'GET' });
  return data || [];
}

export async function createThana(input: ThanaInput): Promise<ThanaEntity> {
  return authorizedRequest<ThanaEntity>('/shipping/locations/thanas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateThana(id: number, input: ThanaInput): Promise<ThanaEntity> {
  return authorizedRequest<ThanaEntity>(`/shipping/locations/thanas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteThana(id: number): Promise<void> {
  await authorizedRequest<unknown>(`/shipping/locations/thanas/${id}`, { method: 'DELETE' });
}

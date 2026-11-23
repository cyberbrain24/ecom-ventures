/**
 * Catalogue calls for the store admin: products, featured products, categories and attributes,
 * including the display order of each. Every call goes through authorizedRequest, so it carries the
 * signed-in staff member's token and the store slug from the session.
 */
import { ApiError, authorizedRequest } from './api';

/** Largest page the products endpoint accepts. */
const PRODUCT_PAGE_SIZE = 100;

/** A product as the catalogue screens need it. */
export interface CatalogProduct {
  id: string;
  title: string;
  slug: string;
  sku: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  basePrice: number;
  compareAtPrice?: number;
  costPrice?: number;
  categoryId: string | null;
  categoryIds?: string[];
  imageUrl: string;
  isFeatured: boolean;
  sortOrder: number;
  featuredOrder: number;
  brandId: string | null;
  careInstructionId: string | null;
  videoUrl?: string;
  videoAutoplay?: boolean;
  videoMuted?: boolean;
  optionLayout?: 'simple' | 'variants';
  sizeGuideTemplate?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  ogImageUrl?: string;
}

export interface ProductInput {
  title: string;
  slug?: string;
  sku?: string;
  basePrice: number;
  compareAtPrice?: number;
  costPrice?: number;
  categoryId?: string | null;
  categoryIds?: string[];
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  summary?: string;
  description?: string;
  featuredImageUrl?: string;
  galleryFilenames?: string;
  isFeatured?: boolean;
  brandId?: string | null;
  careInstructionId?: string | null;
  videoUrl?: string;
  videoAutoplay?: boolean;
  videoMuted?: boolean;
  optionLayout?: 'simple' | 'variants';
  sizeGuideTemplate?: string;
  sortOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  ogImageUrl?: string;
}

/** A category node with its children, in the server's display order. */
export interface CatalogCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  ogImageUrl?: string;
  children: CatalogCategory[];
}

export interface CategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  ogImageUrl?: string;
}

export interface CatalogAttributeValue {
  id: string;
  value: string;
  displayValue: string;
  colorHex?: string;
  imageUrl?: string;
}

/** An attribute (for example Size, Color, GSM) with its values and display styles. */
export interface CatalogAttribute {
  id: string;
  name: string;
  code: string;
  dataType: string; // text, number, boolean, select
  displayType: string; // text, color, image, button, select
  sortOrder: number;
  values: CatalogAttributeValue[];
}

export interface AttributeInput {
  name: string;
  code?: string;
  dataType?: string;
  displayType?: string;
  sortOrder?: number;
  values?: { value: string; displayValue?: string; colorHex?: string; imageUrl?: string }[];
}

type Json = Record<string, unknown>;

function invalid(what: string): ApiError {
  return new ApiError(200, 'INVALID_RESPONSE', `The server sent ${what} in an unexpected format.`, false);
}

function asRecord(value: unknown, what: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid(what);
  return value as Json;
}

function asList(value: unknown, what: string): unknown[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.attributes)) return obj.attributes;
    if (Array.isArray(obj.products)) return obj.products;
    if (Array.isArray(obj.categories)) return obj.categories;
    if (Array.isArray(obj.brands)) return obj.brands;
  }
  if (!Array.isArray(value)) throw invalid(what);
  return value;
}

function str(record: Json, key: string, what: string): string {
  const v = record[key];
  if (typeof v !== 'string') throw invalid(what);
  return v;
}

function optStr(record: Json, key: string): string {
  const v = record[key];
  return typeof v === 'string' ? v : '';
}

function num(record: Json, key: string, what: string): number {
  const v = record[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  throw invalid(what);
}

function bool(record: Json, key: string, what: string): boolean {
  const v = record[key];
  if (typeof v !== 'boolean') throw invalid(what);
  return v;
}

function parseProduct(raw: unknown): CatalogProduct {
  const r = asRecord(raw, 'a product');
  const status = str(r, 'status', 'a product');
  if (status !== 'ACTIVE' && status !== 'DRAFT' && status !== 'ARCHIVED') {
    throw invalid('a product with an unknown status');
  }
  return {
    id: str(r, 'id', 'a product'),
    title: str(r, 'title', 'a product'),
    slug: str(r, 'slug', 'a product'),
    sku: optStr(r, 'sku'),
    status,
    basePrice: num(r, 'base_price', 'a product'),
    categoryId: typeof r.category_id === 'string' ? r.category_id : null,
    imageUrl: optStr(r, 'featured_image_url'),
    isFeatured: bool(r, 'is_featured', 'a product'),
    sortOrder: num(r, 'sort_order', 'a product'),
    featuredOrder: num(r, 'featured_order', 'a product'),
    brandId: typeof r.brand_id === 'string' ? r.brand_id : null,
    careInstructionId: typeof r.care_instruction_id === 'string' ? r.care_instruction_id : null,
    costPrice: typeof r.cost_price === 'number' ? r.cost_price : undefined,
    videoUrl: typeof r.video_url === 'string' ? r.video_url : '',
    videoAutoplay: Boolean(r.video_autoplay),
    videoMuted: Boolean(r.video_muted),
    optionLayout: (r.product_option_layout as any) || 'simple',
    sizeGuideTemplate: typeof r.size_guide_template === 'string' ? r.size_guide_template : '',
    metaTitle: optStr(r, 'meta_title'),
    metaDescription: optStr(r, 'meta_description'),
    focusKeyword: optStr(r, 'focus_keyword'),
    canonicalUrl: optStr(r, 'canonical_url'),
    metaRobots: optStr(r, 'meta_robots'),
    ogImageUrl: optStr(r, 'og_image_url'),
  };
}

function parseCategory(raw: unknown): CatalogCategory {
  const r = asRecord(raw, 'a category');
  return {
    id: str(r, 'id', 'a category'),
    parentId: typeof r.parent_id === 'string' ? r.parent_id : null,
    name: str(r, 'name', 'a category'),
    slug: str(r, 'slug', 'a category'),
    description: optStr(r, 'description'),
    imageUrl: optStr(r, 'image_url'),
    isActive: bool(r, 'is_active', 'a category'),
    displayOrder: num(r, 'display_order', 'a category'),
    metaTitle: optStr(r, 'meta_title'),
    metaDescription: optStr(r, 'meta_description'),
    focusKeyword: optStr(r, 'focus_keyword'),
    canonicalUrl: optStr(r, 'canonical_url'),
    metaRobots: optStr(r, 'meta_robots'),
    ogImageUrl: optStr(r, 'og_image_url'),
    children: Array.isArray(r.children) ? (r.children as unknown[]).map(parseCategory) : [],
  };
}

function parseAttribute(raw: unknown): CatalogAttribute {
  const r = asRecord(raw, 'an attribute');
  return {
    id: str(r, 'id', 'an attribute'),
    name: str(r, 'name', 'an attribute'),
    code: str(r, 'code', 'an attribute'),
    dataType: optStr(r, 'data_type') || 'select',
    displayType: optStr(r, 'display_type') || 'text',
    sortOrder: num(r, 'sort_order', 'an attribute'),
    values: asList(r.values, 'attribute values').map((v) => {
      const value = asRecord(v, 'an attribute value');
      return {
        id: str(value, 'id', 'an attribute value'),
        value: str(value, 'value', 'an attribute value'),
        displayValue: optStr(value, 'display_value'),
        colorHex: typeof value.color_hex === 'string' ? value.color_hex : undefined,
        imageUrl: optStr(value, 'image_url'),
      };
    }),
  };
}

/**
 * Loads every product in the merchant's display order, page by page. With `featuredOnly` it loads only the
 * featured products, in featured order.
 */
export async function fetchProducts(featuredOnly: boolean): Promise<CatalogProduct[]> {
  const all: CatalogProduct[] = [];
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ page: String(page), limit: String(PRODUCT_PAGE_SIZE) });
    if (featuredOnly) query.set('is_featured', 'true');
    const data = await authorizedRequest<unknown>(`/catalog/products?${query.toString()}`, { method: 'GET' });
    const items = asList(data, 'the product list').map(parseProduct);
    all.push(...items);
    if (items.length < PRODUCT_PAGE_SIZE) return all;
  }
}

/** Creates a product. */
export async function createProduct(input: ProductInput): Promise<CatalogProduct> {
  const data = await authorizedRequest<unknown>('/catalog/products', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      slug: input.slug,
      sku: input.sku,
      base_price: input.basePrice,
      compare_at_price: input.compareAtPrice,
      cost_price: input.costPrice,
      category_id: input.categoryId || undefined,
      status: input.status,
      summary: input.summary,
      description: input.description,
      featured_image_url: input.featuredImageUrl,
      gallery_filenames: input.galleryFilenames,
      is_featured: input.isFeatured || false,
      brand_id: input.brandId || undefined,
      care_instruction_id: input.careInstructionId || undefined,
      video_url: input.videoUrl,
      video_autoplay: input.videoAutoplay || false,
      video_muted: input.videoMuted !== undefined ? input.videoMuted : true,
      product_option_layout: input.optionLayout || 'simple',
      size_guide_template: input.sizeGuideTemplate,
      meta_title: input.metaTitle,
      meta_description: input.metaDescription,
      focus_keyword: input.focusKeyword,
      canonical_url: input.canonicalUrl,
      meta_robots: input.metaRobots,
      og_image_url: input.ogImageUrl,
    }),
  });
  return parseProduct(data);
}

/** Updates a product. */
export async function updateProduct(id: string, input: ProductInput): Promise<CatalogProduct> {
  const data = await authorizedRequest<unknown>(`/catalog/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: input.title,
      slug: input.slug,
      sku: input.sku,
      base_price: input.basePrice,
      compare_at_price: input.compareAtPrice,
      cost_price: input.costPrice,
      category_id: input.categoryId || undefined,
      status: input.status,
      summary: input.summary,
      description: input.description,
      featured_image_url: input.featuredImageUrl,
      gallery_filenames: input.galleryFilenames,
      is_featured: input.isFeatured || false,
      brand_id: input.brandId || undefined,
      care_instruction_id: input.careInstructionId || undefined,
      video_url: input.videoUrl,
      video_autoplay: input.videoAutoplay || false,
      video_muted: input.videoMuted !== undefined ? input.videoMuted : true,
      product_option_layout: input.optionLayout || 'simple',
      size_guide_template: input.sizeGuideTemplate,
      meta_title: input.metaTitle,
      meta_description: input.metaDescription,
      focus_keyword: input.focusKeyword,
      canonical_url: input.canonicalUrl,
      meta_robots: input.metaRobots,
      og_image_url: input.ogImageUrl,
    }),
  });
  return parseProduct(data);
}

/** Deletes a product. */
export async function deleteProduct(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Loads the category tree in display order. */
export async function fetchCategories(): Promise<CatalogCategory[]> {
  const data = await authorizedRequest<unknown>('/catalog/categories', { method: 'GET' });
  return asList(data, 'the category list').map(parseCategory);
}

/** Creates a category. */
export async function createCategory(input: CategoryInput): Promise<CatalogCategory> {
  const data = await authorizedRequest<unknown>('/catalog/categories', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      slug: input.slug,
      parent_id: input.parentId || undefined,
      description: input.description,
      image_url: input.imageUrl,
      is_active: input.isActive ?? true,
      meta_title: input.metaTitle,
      meta_description: input.metaDescription,
      focus_keyword: input.focusKeyword,
      canonical_url: input.canonicalUrl,
      meta_robots: input.metaRobots,
      og_image_url: input.ogImageUrl,
    }),
  });
  return parseCategory(data);
}

/** Updates a category. */
export async function updateCategory(id: string, input: CategoryInput): Promise<CatalogCategory> {
  const data = await authorizedRequest<unknown>(`/catalog/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name,
      slug: input.slug,
      parent_id: input.parentId || undefined,
      description: input.description,
      image_url: input.imageUrl,
      is_active: input.isActive ?? true,
      meta_title: input.metaTitle,
      meta_description: input.metaDescription,
      focus_keyword: input.focusKeyword,
      canonical_url: input.canonicalUrl,
      meta_robots: input.metaRobots,
      og_image_url: input.ogImageUrl,
    }),
  });
  return parseCategory(data);
}

/** Deletes a category. */
export async function deleteCategory(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Loads the attributes in display order. */
export async function fetchAttributes(): Promise<CatalogAttribute[]> {
  const data = await authorizedRequest<unknown>('/catalog/attributes', { method: 'GET' });
  return asList(data, 'the attribute list').map(parseAttribute);
}

/** Creates an attribute. */
export async function createAttribute(input: AttributeInput): Promise<CatalogAttribute> {
  const data = await authorizedRequest<unknown>('/catalog/attributes', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      code: input.code,
      data_type: input.dataType || 'select',
      display_type: input.displayType || 'text',
      sort_order: input.sortOrder || 0,
      values: input.values || [],
    }),
  });
  return parseAttribute(data);
}

/** Updates an attribute. */
export async function updateAttribute(
  id: string,
  input: { name: string; dataType?: string; displayType: string; sortOrder?: number; values?: AttributeInput['values'] }
): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/attributes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name,
      data_type: input.dataType || 'select',
      display_type: input.displayType,
      sort_order: input.sortOrder || 0,
      values: input.values || [],
    }),
  });
}

/** Deletes an attribute. */
export async function deleteAttribute(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/attributes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Adds a value to an existing attribute. */
export async function addAttributeValue(attributeId: string, value: string, displayValue?: string, colorHex?: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/attributes/${encodeURIComponent(attributeId)}/values`, {
    method: 'POST',
    body: JSON.stringify({
      value,
      display_value: displayValue || value,
      color_hex: colorHex,
    }),
  });
}

/** Deletes an attribute value. */
export async function deleteAttributeValue(valueId: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/attributes/values/${encodeURIComponent(valueId)}`, { method: 'DELETE' });
}

/** Marks a product as featured, or removes it from the featured list. A newly featured product goes last. */
export async function setProductFeatured(id: string, featured: boolean): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/products/${encodeURIComponent(id)}/featured`, {
    method: 'PATCH',
    body: JSON.stringify({ is_featured: featured }),
  });
}

async function putOrder(path: string, ids: string[]): Promise<void> {
  await authorizedRequest<unknown>(path, { method: 'PUT', body: JSON.stringify({ ids }) });
}

/**
 * Sets a product's brand and care instruction. Pass null to clear one. Both values are sent on every call,
 * so pass the product's current value for the one that is not changing.
 */
export async function setProductLinks(id: string, brandId: string | null, careInstructionId: string | null): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/products/${encodeURIComponent(id)}/links`, {
    method: 'PATCH',
    body: JSON.stringify({ brand_id: brandId, care_instruction_id: careInstructionId }),
  });
}

/** Saves the order of the main product list. `ids` is every product, first position first. */
export function saveProductOrder(ids: string[]): Promise<void> {
  return putOrder('/catalog/products/reorder', ids);
}

/** Saves the order of the featured list. `ids` is every featured product, first position first. */
export function saveFeaturedOrder(ids: string[]): Promise<void> {
  return putOrder('/catalog/products/featured/reorder', ids);
}

/** Saves the order of one group of sibling categories (all root categories, or all children of one parent). */
export function saveCategoryOrder(ids: string[]): Promise<void> {
  return putOrder('/catalog/categories/reorder', ids);
}

/** Saves the order of the attribute list. */
export function saveAttributeOrder(ids: string[]): Promise<void> {
  return putOrder('/catalog/attributes/reorder', ids);
}

/** A product brand, in the server's display order. */
export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  origin: string;
  description: string;
  websiteUrl: string;
  isActive: boolean;
  sortOrder: number;
}

/** The fields a merchant edits on a brand. An empty slug lets the server build one from the name. */
export interface BrandInput {
  name: string;
  slug: string;
  logoUrl: string;
  origin: string;
  description: string;
  websiteUrl: string;
  isActive: boolean;
}

/** A reusable set of care steps for a material, in the server's display order. */
export interface CatalogCareInstruction {
  id: string;
  title: string;
  materialCategory: string;
  instructions: string[];
  careSymbols: string[];
  description: string;
  isActive: boolean;
  sortOrder: number;
}

/** The fields a merchant edits on a care instruction. */
export interface CareInstructionInput {
  title: string;
  materialCategory: string;
  instructions: string[];
  careSymbols: string[];
  description: string;
  isActive: boolean;
}

function strList(record: Json, key: string, what: string): string[] {
  return asList(record[key], what).map((item) => {
    if (typeof item !== 'string') throw invalid(what);
    return item;
  });
}

function parseBrand(raw: unknown): CatalogBrand {
  const r = asRecord(raw, 'a brand');
  return {
    id: str(r, 'id', 'a brand'),
    name: str(r, 'name', 'a brand'),
    slug: str(r, 'slug', 'a brand'),
    logoUrl: optStr(r, 'logo_url'),
    origin: optStr(r, 'origin'),
    description: optStr(r, 'description'),
    websiteUrl: optStr(r, 'website_url'),
    isActive: bool(r, 'is_active', 'a brand'),
    sortOrder: num(r, 'sort_order', 'a brand'),
  };
}

function parseCareInstruction(raw: unknown): CatalogCareInstruction {
  const r = asRecord(raw, 'a care instruction');
  return {
    id: str(r, 'id', 'a care instruction'),
    title: str(r, 'title', 'a care instruction'),
    materialCategory: optStr(r, 'material_category'),
    instructions: strList(r, 'instructions', 'care instruction steps'),
    careSymbols: strList(r, 'care_symbols', 'care symbols'),
    description: optStr(r, 'description'),
    isActive: bool(r, 'is_active', 'a care instruction'),
    sortOrder: num(r, 'sort_order', 'a care instruction'),
  };
}

/** Loads the brands in display order. */
export async function fetchBrands(): Promise<CatalogBrand[]> {
  const data = await authorizedRequest<unknown>('/catalog/brands', { method: 'GET' });
  return asList(data, 'the brand list').map(parseBrand);
}

/** Creates a brand. The server puts it at the end of the list and returns it. */
export async function createBrand(input: BrandInput): Promise<CatalogBrand> {
  const data = await authorizedRequest<unknown>('/catalog/brands', { method: 'POST', body: JSON.stringify(brandBody(input)) });
  return parseBrand(data);
}

/** Updates a brand and returns the saved record. Its position in the list does not change. */
export async function updateBrand(id: string, input: BrandInput): Promise<CatalogBrand> {
  const data = await authorizedRequest<unknown>(`/catalog/brands/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(brandBody(input)),
  });
  return parseBrand(data);
}

/** Deletes a brand. */
export async function deleteBrand(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Saves the order of the brand list. `ids` is every brand, first position first. */
export function saveBrandOrder(ids: string[]): Promise<void> {
  return putOrder('/catalog/brands/reorder', ids);
}

function brandBody(input: BrandInput): Record<string, unknown> {
  return {
    name: input.name,
    slug: input.slug,
    logo_url: input.logoUrl,
    origin: input.origin,
    description: input.description,
    website_url: input.websiteUrl,
    is_active: input.isActive,
  };
}

/** Loads the care instructions in display order. */
export async function fetchCareInstructions(): Promise<CatalogCareInstruction[]> {
  const data = await authorizedRequest<unknown>('/catalog/care-instructions', { method: 'GET' });
  return asList(data, 'the care instruction list').map(parseCareInstruction);
}

/** Creates a care instruction at the end of the list and returns it. */
export async function createCareInstruction(input: CareInstructionInput): Promise<CatalogCareInstruction> {
  const data = await authorizedRequest<unknown>('/catalog/care-instructions', {
    method: 'POST',
    body: JSON.stringify(careBody(input)),
  });
  return parseCareInstruction(data);
}

/** Updates a care instruction and returns the saved record. Its position in the list does not change. */
export async function updateCareInstruction(id: string, input: CareInstructionInput): Promise<CatalogCareInstruction> {
  const data = await authorizedRequest<unknown>(`/catalog/care-instructions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(careBody(input)),
  });
  return parseCareInstruction(data);
}

/** Deletes a care instruction. */
export async function deleteCareInstruction(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/care-instructions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Saves the order of the care instruction list. `ids` is every care instruction, first position first. */
export function saveCareInstructionOrder(ids: string[]): Promise<void> {
  return putOrder('/catalog/care-instructions/reorder', ids);
}

function careBody(input: CareInstructionInput): Record<string, unknown> {
  return {
    title: input.title,
    material_category: input.materialCategory,
    instructions: input.instructions,
    care_symbols: input.careSymbols,
    description: input.description,
    is_active: input.isActive,
  };
}

/** Size Guide Table measurement matrix */
export interface SizeGuideTable {
  name: string;
  headers: string[];
  rows: string[][];
}

/** Global Size Guide Template */
export interface CatalogSizeGuideTemplate {
  id: string;
  name: string;
  description: string;
  tables: SizeGuideTable[];
  sortOrder: number;
  linkedItems?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SizeGuideTemplateInput {
  name: string;
  description?: string;
  tables: SizeGuideTable[];
}

function parseSizeGuide(raw: unknown): CatalogSizeGuideTemplate {
  const r = asRecord(raw, 'a size guide template');
  const rawTables = Array.isArray(r.tables) ? (r.tables as unknown[]) : [];
  return {
    id: str(r, 'id', 'a size guide template'),
    name: str(r, 'name', 'a size guide template'),
    description: optStr(r, 'description'),
    tables: rawTables.map((t) => {
      const tb = asRecord(t, 'a measurement table');
      const headers = Array.isArray(tb.headers) ? (tb.headers as string[]) : [];
      const rows = Array.isArray(tb.rows) ? (tb.rows as string[][]) : [];
      return {
        name: typeof tb.name === 'string' ? tb.name : '',
        headers,
        rows,
      };
    }),
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    linkedItems: typeof r.linked_items === 'number' ? r.linked_items : 0,
    createdAt: optStr(r, 'created_at'),
    updatedAt: optStr(r, 'updated_at'),
  };
}

/** Loads size guide templates with linked drop counts */
export async function fetchSizeGuideTemplates(): Promise<CatalogSizeGuideTemplate[]> {
  const data = await authorizedRequest<unknown>('/catalog/size-guides', { method: 'GET' });
  return asList(data, 'the size guide list').map(parseSizeGuide);
}

/** Creates a size guide template */
export async function createSizeGuideTemplate(input: SizeGuideTemplateInput): Promise<CatalogSizeGuideTemplate> {
  const data = await authorizedRequest<unknown>('/catalog/size-guides', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return parseSizeGuide(data);
}

/** Updates an existing size guide template */
export async function updateSizeGuideTemplate(id: string, input: SizeGuideTemplateInput): Promise<CatalogSizeGuideTemplate> {
  const data = await authorizedRequest<unknown>(`/catalog/size-guides/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return parseSizeGuide(data);
}

/** Deletes a size guide template */
export async function deleteSizeGuideTemplate(id: string): Promise<void> {
  await authorizedRequest<unknown>(`/catalog/size-guides/${encodeURIComponent(id)}`, { method: 'DELETE' });
}


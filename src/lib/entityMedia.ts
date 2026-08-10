import { supabase } from "./supabaseClient";
import type { PilotRole } from "./auth";

export const VORTA_MEDIA_BUCKET = "vorta-media";
export const VORTA_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const VORTA_MEDIA_ACCEPT = "image/jpeg,image/png,image/webp";

export type VortaMediaEntityType = "equipment" | "spare";

export interface VortaManagedImage {
  id: string;
  entityType: VortaMediaEntityType;
  entityId: string;
  storagePath: string;
  signedUrl: string;
  sourceType: string;
  altText: string | null;
  originalFilename: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface EntityImageRow {
  id: string;
  entity_type: VortaMediaEntityType;
  equipment_id: string | null;
  component_id: string | null;
  storage_path: string;
  source_type: string;
  alt_text: string | null;
  original_filename: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mediaEntityColumn(entityType: VortaMediaEntityType): "equipment_id" | "component_id" {
  return entityType === "equipment" ? "equipment_id" : "component_id";
}

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function createObjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isVortaMediaEntityId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function canManageVortaMedia(role: PilotRole | null | undefined): boolean {
  return role === "maintenance_manager" || role === "site_admin" || role === "vorta_admin";
}

export function validateVortaImageFile(file: File): void {
  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    throw new Error("Use a JPG, PNG or WebP image.");
  }
  if (file.size <= 0) {
    throw new Error("The selected image is empty.");
  }
  if (file.size > VORTA_MEDIA_MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }
}

async function signedManagedImage(row: EntityImageRow): Promise<VortaManagedImage> {
  const { data, error } = await supabase.storage
    .from(VORTA_MEDIA_BUCKET)
    .createSignedUrl(row.storage_path, 24 * 60 * 60);

  if (error || !data?.signedUrl) {
    throw new Error(`Vorta image could not be opened: ${error?.message ?? "signed URL unavailable"}`);
  }

  const entityId = row.entity_type === "equipment" ? row.equipment_id : row.component_id;
  if (!entityId) throw new Error("Vorta image is not linked to a valid record.");

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId,
    storagePath: row.storage_path,
    signedUrl: data.signedUrl,
    sourceType: row.source_type,
    altText: row.alt_text,
    originalFilename: row.original_filename,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export async function loadPreferredManagedImage(
  siteId: string,
  entityType: VortaMediaEntityType,
  entityId: string,
): Promise<VortaManagedImage | null> {
  if (!siteId || !isVortaMediaEntityId(entityId)) return null;

  const column = mediaEntityColumn(entityType);
  const { data, error } = await supabase
    .from("vorta_entity_images")
    .select(
      "id, entity_type, equipment_id, component_id, storage_path, source_type, alt_text, original_filename, uploaded_by, created_at",
    )
    .eq("site_id", siteId)
    .eq("entity_type", entityType)
    .eq(column, entityId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Vorta image metadata could not be loaded: ${error.message}`);
  if (!data) return null;

  return signedManagedImage(data as EntityImageRow);
}

export async function uploadManagedImage({
  siteId,
  entityType,
  entityId,
  file,
  altText,
}: {
  siteId: string;
  entityType: VortaMediaEntityType;
  entityId: string;
  file: File;
  altText: string;
}): Promise<VortaManagedImage> {
  validateVortaImageFile(file);
  if (!isVortaMediaEntityId(entityId)) {
    throw new Error("This record is not eligible for managed image upload.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("You must be signed in to upload a Vorta image.");
  }

  const storagePath = `${siteId}/${entityType}/${entityId}/${createObjectId()}.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(VORTA_MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const target =
    entityType === "equipment"
      ? { equipment_id: entityId, component_id: null }
      : { equipment_id: null, component_id: entityId };

  const { data: metadata, error: metadataError } = await supabase
    .from("vorta_entity_images")
    .insert({
      site_id: siteId,
      entity_type: entityType,
      ...target,
      storage_bucket: VORTA_MEDIA_BUCKET,
      storage_path: storagePath,
      source_type: "site_photo",
      alt_text: altText,
      is_primary: true,
      uploaded_by: userData.user.id,
      original_filename: file.name,
      content_type: file.type,
      file_size_bytes: file.size,
    })
    .select(
      "id, entity_type, equipment_id, component_id, storage_path, source_type, alt_text, original_filename, uploaded_by, created_at",
    )
    .single();

  if (metadataError || !metadata) {
    await supabase.storage.from(VORTA_MEDIA_BUCKET).remove([storagePath]);
    throw new Error(`Image metadata could not be saved: ${metadataError?.message ?? "unknown error"}`);
  }

  return signedManagedImage(metadata as EntityImageRow);
}

/**
 * Face Matcher — wrapper Supabase untuk menyimpan & memuat face descriptor.
 *
 * Flow:
 *   enrollment → saveFaceDescriptor(userId, descriptor)
 *   absen      → loadFaceDescriptor(userId) → matchDescriptor(live, stored)
 *   profil     → getFaceEnrollmentInfo(userId) → canReEnroll(updatedAt)
 */

import { supabase } from './supabase';

/**
 * Simpan (upsert) face descriptor ke tabel face_embeddings.
 * Karena ada UNIQUE constraint on user_id, panggil ulang akan update.
 */
export async function saveFaceDescriptor(
  userId: string,
  descriptor: number[]
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('face_embeddings').upsert(
    {
      user_id: userId,
      descriptor,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;

  // Descriptor berubah → buang cache lama biar sesi berikutnya ambil data baru
  descriptorCache.delete(userId);
}

/**
 * Cache in-memory per sesi untuk descriptor wajah (key: userId).
 * Descriptor hanya berubah saat re-enrollment (cooldown 30 hari), jadi aman
 * di-cache selama sesi berjalan — menghindari query Supabase berulang yang
 * memperlambat cek skor wajah di halaman kamera.
 * Nilai null (belum enrollment) juga di-cache agar tidak query ulang.
 */
const descriptorCache = new Map<string, number[] | null>();

/**
 * Muat face descriptor milik user dari database.
 * Returns null jika belum enrollment.
 * Hasil di-cache per sesi (lihat descriptorCache) — di-reset saat logout.
 */
export async function loadFaceDescriptor(
  userId: string
): Promise<number[] | null> {
  if (descriptorCache.has(userId)) return descriptorCache.get(userId) ?? null;

  const { data, error } = await supabase
    .from('face_embeddings')
    .select('descriptor')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  const descriptor = data?.descriptor ?? null;
  descriptorCache.set(userId, descriptor);
  return descriptor;
}

/**
 * Hapus cache descriptor (dipanggil saat logout / setelah re-enrollment
 * supaya data terbaru diambil pada sesi berikutnya).
 */
export function clearFaceDescriptorCache(): void {
  descriptorCache.clear();
}

export interface FaceEnrollmentInfo {
  enrolled: boolean;
  updatedAt: string | null; // ISO string
}

/**
 * Cek status enrollment + timestamp untuk cooldown 30 hari.
 */
export async function getFaceEnrollmentInfo(
  userId: string
): Promise<FaceEnrollmentInfo> {
  const { data, error } = await supabase
    .from('face_embeddings')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    enrolled: !!data,
    updatedAt: data?.updated_at ?? null,
  };
}

export interface ReEnrollStatus {
  allowed: boolean;
  daysLeft: number; // 0 jika sudah boleh
}

/**
 * Cek cooldown 30 hari sejak updated_at terakhir.
 */
export function canReEnroll(updatedAt: string): ReEnrollStatus {
  const last = new Date(updatedAt).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

  return {
    allowed: diffDays >= 30,
    daysLeft: Math.max(0, 30 - diffDays),
  };
}

/**
 * Hapus face descriptor (misal admin reset).
 */
export async function deleteFaceDescriptor(userId: string): Promise<void> {
  const { error } = await supabase
    .from('face_embeddings')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

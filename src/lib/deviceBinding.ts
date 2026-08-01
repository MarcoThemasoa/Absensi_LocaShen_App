/**
 * Device Binding — soft binding 1 akun ↔ perangkat (deteksi, bukan hard-block).
 *
 * Flow:
 *   absen → registerDevice(userId) → bandingkan device saat ini dengan
 *   device terakhir yang terdaftar untuk user ini.
 *
 *   - Device sama  → normal.
 *   - Device beda  → `changedFromLast = true` → absen ditandai is_suspicious
 *     dan admin bisa lihat riwayat di tabel `user_devices`.
 *
 * Kenapa soft (bukan block):
 *   Karyawan sah bisa berganti HP. Kalau di-hard-block, absen gagal padahal
 *   orangnya beneran. Soft flag memindahkan keputusan ke admin (human review),
 *   dan menaikkan biaya penipuan (teman yang pegang kredensial kena flag).
 */

import { supabase } from './supabase';
import { getDeviceId, getDeviceLabel } from './deviceIdentity';

export interface DeviceRegistration {
  deviceId: string;
  isNewDevice: boolean; // belum pernah terdaftar sama sekali
  changedFromLast: boolean; // beda dari device absen terakhir → mencurigakan
}

/** Label perangkat untuk pesan notifikasi (jangan sampai null/undefined). */
function labelOrDevice(deviceId: string): string {
  return getDeviceLabel() || deviceId || 'perangkat tidak dikenal';
}

/**
 * Kirim notifikasi 'device_change' ke admin via RPC security definer.
 * Gagal kirim TIDAK memblokir alur utama (absen/login tetap jalan).
 */
export async function notifyDeviceChange(userId: string, deviceId: string): Promise<void> {
  try {
    await supabase.rpc('notify_admin', {
      p_type: 'device_change',
      p_user_id: userId,
      p_message: `Karyawan login/absen dari perangkat berbeda: ${labelOrDevice(deviceId)}`,
      p_device_label: getDeviceLabel(),
    });
  } catch (err) {
    console.error('[DeviceBinding] Gagal kirim notifikasi device change:', err);
  }
}

/**
 * Cek perubahan device SAAT LOGIN (read-only, tanpa upsert).
 * Tidak menyentuh user_devices supaya deteksi is_suspicious saat absen
 * (registerDevice) tetap melihat perubahan — notif login adalah lapisan
 * tambahan "waspada dini", bukan pengganti flag absen.
 */
export async function checkDeviceChangeOnLogin(userId: string): Promise<boolean> {
  try {
    const deviceId = getDeviceId();

    const { data: existing } = await supabase
      .from('user_devices')
      .select('device_id')
      .eq('user_id', userId)
      .maybeSingle();

    // Belum pernah ada device → bukan "perubahan", hanya registrasi pertama
    if (!existing?.device_id) return false;

    const changed = existing.device_id !== deviceId;
    if (changed) {
      await notifyDeviceChange(userId, deviceId);
    }
    return changed;
  } catch (err) {
    console.error('[DeviceBinding] Gagal cek device saat login:', err);
    return false;
  }
}

/**
 * Catat device saat ini untuk user (upsert) dan deteksi perubahan.
 * Idempotent — device yang sama tidak membuat baris duplikat.
 * Kalau device berubah dari yang terakhir → kirim notifikasi ke admin.
 */
export async function registerDevice(userId: string): Promise<DeviceRegistration> {
  const deviceId = getDeviceId();

  const { data: existing } = await supabase
    .from('user_devices')
    .select('device_id')
    .eq('user_id', userId)
    .maybeSingle();

  const isNewDevice = !existing?.device_id || existing.device_id !== deviceId;
  const changedFromLast = !!existing?.device_id && existing.device_id !== deviceId;

  if (isNewDevice) {
    await supabase.from('user_devices').upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_label: getDeviceLabel(),
      },
      { onConflict: 'user_id' } // satu baris per user — overwrite device terakhir
    );
  }

  // Perubahan device = notifikasi langsung ke admin (selain flag is_suspicious)
  if (changedFromLast) {
    await notifyDeviceChange(userId, deviceId);
  }

  return { deviceId, isNewDevice, changedFromLast };
}

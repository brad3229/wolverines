import { supabase } from './supabaseClient'

export const AVATAR_MAX_BYTES = 8 * 1024 * 1024 // 8MB, before client-side resizing
const AVATAR_MAX_DIMENSION = 512

// Downscales to a max 512px square (matching the biggest size it's ever
// displayed at, the profile page's own preview) so a full-resolution phone
// photo doesn't turn into a multi-MB avatar loaded on every roster page.
async function resizeToSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const size = Math.min(AVATAR_MAX_DIMENSION, Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to prepare image')

  // Crop to a centered square before scaling, so the stored image always
  // matches the circular avatar's aspect ratio instead of getting squashed.
  const cropSize = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - cropSize) / 2
  const sy = (bitmap.height - cropSize) / 2
  ctx.drawImage(bitmap, sx, sy, cropSize, cropSize, 0, 0, size, size)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))), 'image/jpeg', 0.85)
  })
}

export async function uploadOwnAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('Image is too large (max 8MB)')

  const blob = await resizeToSquareJpeg(file)
  const path = `${userId}/avatar.jpg`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // The storage path (and so the public URL) is the same on every re-upload,
  // so browsers/CDNs would keep serving a stale cached image without this --
  // stamping the URL with a version makes each upload's URL unique.
  const versionedUrl = `${data.publicUrl}?v=${Date.now()}`

  const { error: rpcError } = await supabase.rpc('set_own_avatar_url', { new_url: versionedUrl })
  if (rpcError) throw rpcError

  return versionedUrl
}

export async function removeOwnAvatar(userId: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`])
  if (removeError) throw removeError

  const { error: rpcError } = await supabase.rpc('set_own_avatar_url', { new_url: null })
  if (rpcError) throw rpcError
}

import * as FileSystem from 'expo-file-system/legacy';

/**
 * Upload a local receipt photo to the user's Drive (drive.file scope).
 * Returns a Drive file id, or null if offline / no token / upload fails.
 */
export async function uploadReceiptPhotoToDrive(
  accessToken: string,
  localUri: string,
  fileName: string
): Promise<string | null> {
  if (!accessToken || !localUri || localUri.startsWith('http')) return null;
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) return null;

    const meta = {
      name: fileName,
      mimeType: 'image/jpeg',
      parents: [] as string[],
    };
    const boundary = `appcash_${Date.now()}`;
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Multipart upload via resumable is heavier; use media upload with metadata for small files.
    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify({ name: meta.name, mimeType: meta.mimeType }),
          `--${boundary}`,
          'Content-Type: image/jpeg',
          'Content-Transfer-Encoding: base64',
          '',
          base64,
          `--${boundary}--`,
          '',
        ].join('\r\n'),
      }
    );

    if (!createRes.ok) return null;
    const data = (await createRes.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

/** Soft helper: upload if Google session has a token; never throws. */
export async function tryUploadReceiptPhoto(
  accessToken: string | undefined | null,
  localUri: string,
  receiptId: string
): Promise<string> {
  if (!accessToken || !localUri) return localUri;
  const driveId = await uploadReceiptPhotoToDrive(
    accessToken,
    localUri,
    `appcash-receipt-${receiptId}.jpg`
  );
  return driveId || localUri;
}

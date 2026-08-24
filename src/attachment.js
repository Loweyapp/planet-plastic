// Shared pending-attachment state for the chat input bar.
// Files are uploaded to Anthropic's Files API on selection; the
// pending attachment holds the resulting fileId (not raw base64).

var _pending = null;  // { name, mediaType, fileId } | { name, mediaType, data } | null

export function setPendingAttachment(file) {
  _pending = file;
}

export function getPendingAttachment() {
  return _pending;
}

export function clearPendingAttachment() {
  _pending = null;
}

// Upload a File object to Anthropic via our serverless proxy.
// Returns { name, mediaType, fileId } on success.
export async function uploadAttachment(file) {
  var resp = await fetch('/api/upload-file', {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'x-filename': file.name,
      'x-mime-type': file.type,
    },
    body: file,  // Raw bytes — no base64, no JSON wrapping
  });
  var data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Upload failed (${resp.status})`);
  return { name: file.name, mediaType: file.type, fileId: data.fileId };
}

// Build a Claude content block from a pending attachment
export function attachmentContentBlock(att) {
  // Prefer fileId (Files API) over raw base64 data
  if (att.fileId) {
    if (att.mediaType === 'application/pdf') {
      return { type: 'document', source: { type: 'file', file_id: att.fileId } };
    }
    return { type: 'image', source: { type: 'file', file_id: att.fileId } };
  }
  // Fallback: inline base64 (images only, small files)
  if (att.mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.data } };
  }
  return { type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } };
}

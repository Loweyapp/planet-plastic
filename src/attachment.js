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

// Upload a File object directly to Anthropic's Files API (browser → Anthropic).
// No Vercel proxy involved — avoids serverless body size limits entirely.
export async function uploadAttachment(file) {
  var { uploadFileToAnthropic } = await import('./api.js');
  return uploadFileToAnthropic(file);
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

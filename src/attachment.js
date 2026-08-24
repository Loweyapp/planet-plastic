// Shared pending-attachment state for the chat input bar.
// Both adviser.js and matt.js read from here before sending.

var _pending = null;  // { name, mediaType, data } | null

export function setPendingAttachment(file) {
  _pending = file;
}

export function getPendingAttachment() {
  return _pending;
}

export function clearPendingAttachment() {
  _pending = null;
}

// Read a File object → base64 data string
export function readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function (e) { resolve(e.target.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Build a Claude content block for the attachment
export function attachmentContentBlock(att) {
  if (att.mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.data } };
  }
  return { type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } };
}

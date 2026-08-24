// Shared pending-attachment state for the chat input bar.
// Images are resized client-side and sent as inline base64.
// PDFs are not supported — users should screenshot the relevant page.

var _pending = null;  // { name, mediaType, data } | null

export function setPendingAttachment(file) { _pending = file; }
export function getPendingAttachment()      { return _pending; }
export function clearPendingAttachment()    { _pending = null; }

// Resize an image to max 1200px and encode as JPEG base64.
// Keeps payloads under ~400KB regardless of source resolution.
export function resizeAndEncode(file) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var maxW = 1200;
      var scale = img.width > maxW ? maxW / img.width : 1;
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]); // base64 only, no data URI prefix
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// Build a Claude content block from a pending attachment (image only)
export function attachmentContentBlock(att) {
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: att.data } };
}

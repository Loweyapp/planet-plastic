// Shared pending-attachment state for the chat input bar.
// Images: resized inline base64.
// PDFs: user picks pages via pdfpicker, stored as array of JPEG base64.

var _pending = null;
// Single image:  { type: 'image',     name, mediaType, data }
// PDF pages:     { type: 'pdf-pages', name, images: [base64,...] }

export function setPendingAttachment(att) { _pending = att; }
export function getPendingAttachment()     { return _pending; }
export function clearPendingAttachment()   { _pending = null; }

// Resize a single image file to max 1200px → JPEG base64
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
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// Build an array of Claude content blocks from a pending attachment
export function attachmentContentBlocks(att) {
  if (!att) return [];
  if (att.type === 'pdf-pages') {
    return att.images.map(function (data) {
      return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
    });
  }
  // Single image
  return [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: att.data } }];
}

// PDF page picker — loads PDF.js from CDN, renders thumbnails,
// lets user select pages, returns them as JPEG base64 images.

var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensurePdfJs() {
  if (window.pdfjsLib) return;
  await loadScript(PDFJS + 'pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
}

async function renderPageToCanvas(page, width, quality) {
  var vp0      = page.getViewport({ scale: 1 });
  var scale    = width / vp0.width;
  var viewport = page.getViewport({ scale });
  var canvas   = document.createElement('canvas');
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/jpeg', quality || 0.85).split(',')[1];
}

// Open the picker modal. Calls onConfirm({ images: [base64,...], name: string }).
export async function openPdfPicker(file, onConfirm) {
  var overlay = document.createElement('div');
  overlay.className = 'pdf-picker-overlay';
  overlay.innerHTML = `
    <div class="pdf-picker-sheet">
      <div class="pdf-picker-header">
        <span class="pdf-picker-title">Loading PDF…</span>
        <button class="pdf-picker-cancel">✕</button>
      </div>
      <div class="pdf-picker-grid"></div>
      <div class="pdf-picker-footer">
        <button class="pdf-picker-confirm" disabled>Tap pages to select</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  var cancelBtn  = overlay.querySelector('.pdf-picker-cancel');
  var confirmBtn = overlay.querySelector('.pdf-picker-confirm');
  var grid       = overlay.querySelector('.pdf-picker-grid');
  var titleEl    = overlay.querySelector('.pdf-picker-title');
  var selected   = new Set();

  cancelBtn.addEventListener('click', function () { overlay.remove(); });

  try {
    await ensurePdfJs();
    var buf = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    var n   = pdf.numPages;
    titleEl.textContent = n + ' pages — tap to select';

    // Build thumbnail placeholders
    for (var i = 1; i <= n; i++) {
      (function (pageNum) {
        var cell = document.createElement('div');
        cell.className = 'pdf-thumb';
        cell.innerHTML = '<canvas></canvas><span>' + pageNum + '</span>';
        grid.appendChild(cell);

        // Lazy-render thumbnail when scrolled into view
        var canvas = cell.querySelector('canvas');
        var observer = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          observer.disconnect();
          pdf.getPage(pageNum).then(function (page) {
            renderPageToCanvas(page, 90, 0.7).then(function (data) {
              canvas.width  = 90;
              var img = new Image();
              img.onload = function () {
                var ctx = canvas.getContext('2d');
                canvas.width  = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
              };
              img.src = 'data:image/jpeg;base64,' + data;
            });
          });
        }, { root: grid });
        observer.observe(cell);

        cell.addEventListener('click', function () {
          if (selected.has(pageNum)) {
            selected.delete(pageNum);
            cell.classList.remove('selected');
          } else {
            selected.add(pageNum);
            cell.classList.add('selected');
          }
          var count = selected.size;
          confirmBtn.disabled   = count === 0;
          confirmBtn.textContent = count
            ? 'Send ' + count + ' page' + (count > 1 ? 's' : '')
            : 'Tap pages to select';
        });
      })(i);
    }

    // Confirm → render selected pages at full resolution
    confirmBtn.addEventListener('click', async function () {
      confirmBtn.disabled   = true;
      confirmBtn.textContent = 'Preparing…';
      var pages  = Array.from(selected).sort(function (a, b) { return a - b; });
      var images = [];
      for (var p = 0; p < pages.length; p++) {
        var page = await pdf.getPage(pages[p]);
        images.push(await renderPageToCanvas(page, 1200, 0.85));
      }
      overlay.remove();
      onConfirm({ images, name: file.name });
    });

  } catch (err) {
    titleEl.textContent = 'Could not load PDF: ' + err.message;
    confirmBtn.textContent = 'Close';
    confirmBtn.disabled = false;
    confirmBtn.addEventListener('click', function () { overlay.remove(); });
  }
}

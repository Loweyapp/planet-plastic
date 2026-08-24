import { INVENTORY }   from '../data/inventory.js';
import { swatchColor } from '../data/colors.js';
import { esc }         from '../utils.js';

var activeFilter = 'All';

export function initPaints() {
  document.getElementById('paints-search-input').addEventListener('input', renderPaints);
  document.getElementById('paints-export-btn').addEventListener('click', exportPaintsCSV);
  document.getElementById('paints-filter-row').addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderPaints();
  });
  renderPaints();
}

export function renderPaints() {
  var q = (document.getElementById('paints-search-input')?.value || '').toLowerCase();
  var items = INVENTORY.filter(item => {
    if (activeFilter === 'Paint')      return item.Category === 'Paint';
    if (activeFilter === 'Weathering') return item.Category === 'Weathering';
    if (activeFilter === 'Primer')     return item.Category === 'Primer';
    if (activeFilter === 'Varnish')    return item.Category === 'Varnish';
    if (activeFilter === 'Thinner')    return item.Category === 'Thinner';
    return true;
  }).filter(item =>
    !q ||
    (item['Product Name'] || '').toLowerCase().includes(q) ||
    (item['Code'] || '').toLowerCase().includes(q) ||
    (item['Brand'] || '').toLowerCase().includes(q)
  ).sort((a, b) => {
    var ba = (a['Brand'] || '').localeCompare(b['Brand'] || '');
    if (ba !== 0) return ba;
    var na = (a['Code'] || a['Product Name'] || '').replace(/(\d+)/g, n => n.padStart(6, '0'));
    var nb = (b['Code'] || b['Product Name'] || '').replace(/(\d+)/g, n => n.padStart(6, '0'));
    return na.localeCompare(nb);
  });

  var list = document.getElementById('paint-list');
  if (!list) return;

  var html = '';
  var lastBrand = null;
  items.forEach(function (item) {
    if (item['Brand'] !== lastBrand) {
      lastBrand = item['Brand'];
      html += `<div class="paint-brand-header">${esc(lastBrand)}</div>`;
    }
    var color   = swatchColor(item);
    var primary = [item['Code'], item['Finish']].filter(Boolean).join(' · ') || esc(item['Product Name']);
    var qty   = item['Quantity'] > 1 ? `<div class="paint-qty">×${item['Quantity']}</div>` : '';
    html += `<div class="paint-row">
      <div class="paint-swatch" style="background:${color}"></div>
      <div class="paint-info">
        <div class="paint-name">${esc(primary)}</div>
        <div class="paint-meta">${esc(item['Product Name'])}</div>
      </div>
      ${qty}
    </div>`;
  });
  html += `<div class="paints-count">${items.length} item${items.length !== 1 ? 's' : ''}</div>`;
  list.innerHTML = html;
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportPaintsCSV() {
  var headers = ['Brand', 'Code', 'Product Name', 'Category', 'Finish', 'Quantity'];
  var rows = INVENTORY.map(item => [
    item['Brand'] || '', item['Code'] || '', item['Product Name'] || '',
    item['Category'] || '', item['Finish'] || '', item['Quantity'] || 1,
  ]);
  var csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'planet-plastic-paints.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

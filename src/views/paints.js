import { INVENTORY }   from '../data/inventory.js';
import { swatchColor } from '../data/colors.js';
import { esc }         from '../utils.js';

var activeFilter = 'All';

export function initPaints() {
  document.getElementById('paints-search-input').addEventListener('input', renderPaints);
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
    if (activeFilter === 'Tamiya')     return item.Brand === 'Tamiya';
    if (activeFilter === 'Vallejo')    return item.Brand === 'Vallejo';
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
    var na = (a['Code'] || a['Product Name'] || '').replace(/(\d+)/g, n => n.padStart(6, '0'));
    var nb = (b['Code'] || b['Product Name'] || '').replace(/(\d+)/g, n => n.padStart(6, '0'));
    return na.localeCompare(nb);
  });

  var list = document.getElementById('paint-list');
  if (!list) return;

  list.innerHTML = items.map(item => {
    var color = swatchColor(item);
    var meta  = [item['Brand'] + (item['Code'] ? ' ' + item['Code'] : ''), item['Finish']].filter(Boolean).join(' · ');
    var qty   = item['Quantity'] > 1 ? `<div class="paint-qty">×${item['Quantity']}</div>` : '';
    return `<div class="paint-row">
      <div class="paint-swatch" style="background:${color}"></div>
      <div class="paint-info">
        <div class="paint-name">${esc(item['Product Name'])}</div>
        <div class="paint-meta">${esc(meta)}</div>
      </div>
      ${qty}
    </div>`;
  }).join('') + `<div class="paints-count">${items.length} item${items.length !== 1 ? 's' : ''}</div>`;
}

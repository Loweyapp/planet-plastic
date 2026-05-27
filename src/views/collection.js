import { esc } from '../utils.js';

var _db  = null;
var _uid = null;
var _unsubscribe = null;
var activeTab = 'stash';

// In-memory cache keyed by Firestore doc id
var kitsById = {};

export function initCollection(db, uid) {
  _db  = db;
  _uid = uid;

  document.getElementById('coll-sub-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.sub-tab');
    if (!tab) return;
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    renderCollection();
  });

  document.getElementById('coll-search-input').addEventListener('input', renderCollection);
  document.getElementById('csv-file-input').addEventListener('change', handleCSVImport);
  document.getElementById('url-import-btn').addEventListener('click', handleUrlImport);
  document.getElementById('url-import-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleUrlImport();
  });

  document.getElementById('kit-list').addEventListener('click', function (e) {
    if (e.target.closest('[data-move]') || e.target.closest('[data-delete]')) return;
    var item = e.target.closest('.kit-item');
    if (item) openKitSheet(item.dataset.id);
  });

  document.getElementById('kit-overlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('kit-overlay')) closeKitSheet();
  });

  document.getElementById('kit-sheet-actions').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-move]');
    if (!btn) return;
    moveKit(btn.dataset.id, btn.dataset.move);
    closeKitSheet();
  });

  document.getElementById('kit-sheet-delete-btn').addEventListener('click', function () {
    var id = document.getElementById('kit-sheet-delete-btn').dataset.id;
    if (id) { deleteKit(id); closeKitSheet(); }
  });

  subscribeToKits();
}

// ── Firestore real-time listener ──────────────────────────────────────────────
function subscribeToKits() {
  if (_unsubscribe) _unsubscribe();
  _unsubscribe = _db
    .collection('users').doc(_uid).collection('kits')
    .onSnapshot(function (snap) {
      kitsById = {};
      snap.forEach(function (doc) { kitsById[doc.id] = { id: doc.id, ...doc.data() }; });
      // Persist to localStorage as offline cache
      localStorage.setItem('pp_kits', JSON.stringify(kitsById));
      renderCollection();
    }, function (err) {
      console.warn('Firestore snapshot error:', err);
      // Fall back to cache
      var cached = localStorage.getItem('pp_kits');
      if (cached) kitsById = JSON.parse(cached);
      renderCollection();
    });
}

// ── Public helpers (used by picker.js) ────────────────────────────────────────
export function getStashKits() {
  return Object.values(kitsById).filter(k => k.status === 'stash');
}

// ── Mutations ─────────────────────────────────────────────────────────────────
function moveKit(id, newStatus) {
  _db.collection('users').doc(_uid).collection('kits').doc(id).update({ status: newStatus });
}

function deleteKit(id) {
  _db.collection('users').doc(_uid).collection('kits').doc(id).delete();
}

async function importKits(kits) {
  var batch   = _db.batch();
  var ref     = _db.collection('users').doc(_uid).collection('kits');
  var byKey   = {};
  Object.values(kitsById).forEach(k => { byKey[`${k.name}||${k.brand}`] = k; });
  var added = 0;
  kits.forEach(function (kit) {
    var key      = `${kit.name}||${kit.brand}`;
    var existing = byKey[key];
    if (!existing) {
      batch.set(ref.doc(), { ...kit, createdAt: new Date() });
      byKey[key] = kit;
      added++;
    } else if (kit.sourceUrl && !existing.sourceUrl) {
      // Patch sourceUrl onto existing record
      batch.update(ref.doc(existing.id), { sourceUrl: kit.sourceUrl });
    }
  });
  await batch.commit();
  return added;
}

// ── Kit detail sheet ──────────────────────────────────────────────────────────
function openKitSheet(id) {
  var kit = kitsById[id];
  if (!kit) return;

  document.getElementById('kit-sheet-emoji').textContent  = genreEmoji(kit.type);
  document.getElementById('kit-sheet-name').textContent   = kit.name;
  document.getElementById('kit-sheet-brand').textContent  = [kit.brand, kit.scale].filter(Boolean).join(' · ');

  var fields = [
    ['Kit number', kit.kitNo],
    ['Type',       kit.type],
    ['Scale',      kit.scale],
    ['Brand',      kit.brand],
    ['Status',     { stash: 'In stash', wip: 'Building', done: 'Completed', wish: 'Wishlist' }[kit.status] || kit.status],
    ['Added',      kit.createdAt ? new Date(kit.createdAt.seconds ? kit.createdAt.seconds * 1000 : kit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
  ].filter(([, v]) => v);

  document.getElementById('kit-sheet-fields').innerHTML = fields.map(([label, value]) =>
    `<div class="kit-sheet-field"><span class="kit-sheet-label">${esc(label)}</span><span class="kit-sheet-value">${esc(String(value))}</span></div>`
  ).join('');

  var moves = MOVE_OPTIONS[kit.status] || [];
  document.getElementById('kit-sheet-actions').innerHTML = moves.map(([target, label]) =>
    `<button class="kit-sheet-move-btn" data-move="${target}" data-id="${kit.id}">${label}</button>`
  ).join('');

  var sourceLink = document.getElementById('kit-sheet-source-link');
  if (kit.sourceUrl) {
    sourceLink.href = kit.sourceUrl;
    sourceLink.textContent = 'View on Scalemates ↗';
  } else {
    var q = encodeURIComponent([kit.name, kit.brand].filter(Boolean).join(' '));
    sourceLink.href = 'https://www.scalemates.com/kits/?q=' + q;
    sourceLink.textContent = 'Search on Scalemates ↗';
  }
  sourceLink.style.display = 'block';

  document.getElementById('kit-sheet-delete-btn').dataset.id = id;
  document.getElementById('kit-overlay').classList.add('open');
}

function closeKitSheet() {
  document.getElementById('kit-overlay').classList.remove('open');
}

// ── URL import ────────────────────────────────────────────────────────────────
async function handleUrlImport() {
  var input = document.getElementById('url-import-input');
  var btn   = document.getElementById('url-import-btn');
  var url   = (input.value || '').trim();
  if (!url) return;
  if (!url.includes('scalemates.com/kits/')) {
    alert('Paste a Scalemates kit page URL (scalemates.com/kits/…)');
    return;
  }
  btn.disabled = true;
  btn.textContent = '…';
  try {
    var res  = await fetch('/api/scrape-kit?url=' + encodeURIComponent(url));
    var kit  = await res.json();
    if (kit.error) throw new Error(kit.error);
    if (!kit.name) throw new Error('Could not read kit details from that page.');
    var added = await importKits([{ ...kit, status: 'stash', sourceUrl: url }]);
    input.value = '';
    alert(added ? `Added "${kit.name}" to your stash.` : `"${kit.name}" is already in your collection.`);
  } catch (e) {
    alert('Could not add kit: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add';
  }
}

// ── CSV import ────────────────────────────────────────────────────────────────
function handleCSVImport(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = async function (ev) {
    var result = parseScalematetsCSV(ev.target.result);
    if (!result.length) {
      alert("No kits found. Make sure this is a Scalemates stash export (Profile → Export stash).");
      return;
    }
    var added = await importKits(result);
    alert(`Imported ${added} new kit${added !== 1 ? 's' : ''}. Scalemates links updated on existing kits where available.`);
  };
  reader.readAsText(file);
  e.target.value = '';
}

function parseScalematetsCSV(text) {
  var lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  var delim = lines[0].includes('\t') ? '\t' : ',';

  function parseLine(line) {
    var result = [], inQ = false, cur = '';
    for (var ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === delim && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }

  var headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  function col(...names) {
    for (var n of names) { var i = headers.indexOf(n); if (i !== -1) return i; }
    return -1;
  }

  var iName   = col('name', 'kit name', 'model name', 'title');
  var iScale  = col('scale', 'scale (mm)');
  var iBrand  = col('brand', 'manufacturer', 'maker');
  var iStatus = col('status', 'shelf', 'collection status');
  var iType   = col('type', 'category', 'genre', 'subject');
  var iKitNo  = col('kit number', 'number', 'kit no', 'product number', 'sku');
  var iUrl    = col('url', 'link', 'page', 'scalemates url', 'scalemates link');

  if (iName === -1) return [];

  return lines.slice(1).flatMap(function (line) {
    var cols   = parseLine(line);
    var name   = (cols[iName] || '').replace(/^"|"$/g, '').trim();
    if (!name) return [];

    var clean  = i => i !== -1 ? (cols[i] || '').replace(/^"|"$/g, '').trim() : '';
    var status = clean(iStatus).toLowerCase();
    var tab    = 'stash';
    if (status.includes('build') || status.includes('progress') || status.includes('wip')) tab = 'wip';
    else if (status.includes('complet') || status.includes('built') || status.includes('done')) tab = 'done';
    else if (status.includes('wish') || status.includes('want')) tab = 'wish';

    var sourceUrl = clean(iUrl);
    var kit = { name, scale: clean(iScale), brand: clean(iBrand), type: clean(iType), kitNo: clean(iKitNo), status: tab };
    if (sourceUrl) kit.sourceUrl = sourceUrl;
    return [kit];
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
var MOVE_OPTIONS = {
  stash: [['wip', '→ Building'], ['done', '→ Done'], ['wish', '→ Wishlist']],
  wip:   [['stash', '→ Stash'],  ['done', '→ Done']],
  done:  [['stash', '→ Stash'],  ['wip', '→ Building']],
  wish:  [['stash', '→ Stash']],
};

var EMPTY_MSG = {
  stash: { title: 'Stash is empty', body: 'Import your Scalemates CSV using the button above.' },
  wip:   { title: 'Nothing in progress', body: 'Move a kit here when you start building.' },
  done:  { title: 'No completed builds', body: 'Completed builds will appear here.' },
  wish:  { title: 'Wishlist is empty', body: 'Wishlist kits appear here after import.' },
};

function genreEmoji(type) {
  var t = (type || '').toLowerCase();
  if (t.includes('aircraft') || t.includes('plane'))  return '✈️';
  if (t.includes('tank') || t.includes('armor') || t.includes('armour') || t.includes('vehicle')) return '🪖';
  if (t.includes('ship') || t.includes('boat') || t.includes('naval')) return '⚓';
  if (t.includes('car') || t.includes('auto'))        return '🏎️';
  if (t.includes('figure') || t.includes('human'))    return '👤';
  if (t.includes('sci') || t.includes('space') || t.includes('gundam') || t.includes('mech')) return '🚀';
  if (t.includes('helicopter'))                        return '🚁';
  return '📦';
}

export function renderCollection() {
  var q     = (document.getElementById('coll-search-input')?.value || '').toLowerCase();
  var items = Object.values(kitsById)
    .filter(k => k.status === activeTab)
    .filter(k => !q || (k.name || '').toLowerCase().includes(q) || (k.brand || '').toLowerCase().includes(q));

  var list = document.getElementById('kit-list');
  if (!list) return;

  if (!items.length) {
    var msg = EMPTY_MSG[activeTab];
    list.innerHTML = `<div class="coll-empty"><strong>${msg.title}</strong>${msg.body}</div>`;
    return;
  }

  var moves = MOVE_OPTIONS[activeTab];
  list.innerHTML = items.map(kit => {
    var moveBtns = moves.map(([target, label]) =>
      `<button class="kit-action-btn" data-move="${target}" data-id="${kit.id}">${label}</button>`
    ).join('');
    return `<div class="kit-item" data-id="${kit.id}">
      <div class="kit-thumb">${genreEmoji(kit.type)}</div>
      <div class="kit-item-info">
        <div class="kit-item-name">${esc(kit.name)}</div>
        <div class="kit-item-meta">${[kit.scale, kit.brand].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="kit-item-actions">
        ${moveBtns}
        <button class="kit-action-btn" data-delete="${kit.id}" style="color:#d93025">✕</button>
      </div>
    </div>`;
  }).join('') + `<div class="coll-count">${items.length} kit${items.length !== 1 ? 's' : ''}</div>`;
}

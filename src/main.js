import { loadFirebase, PREVIEW_MODE } from './firebase.js';
import { initAdviser, sendAdviserMessage } from './views/adviser.js';
import { initPicker }                      from './views/picker.js';
import { initPaints }                      from './views/paints.js';
import { initCollection }                  from './views/collection.js';
import { initMatt, sendMattMessage, linkMatt, unlinkMatt } from './views/matt.js';
import { setPendingAttachment, clearPendingAttachment, uploadAttachment } from './attachment.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
var loadingTimer = setTimeout(function () {
  showError('Taking too long to load. <br><a href="" style="color:#1a73e8">Tap to reload</a>');
}, 8000);

loadFirebase(function (db, firebase) {
  clearTimeout(loadingTimer);
  if (!db || !firebase) {
    showError('Could not load Firebase. Check your connection and reload.');
    return;
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      showApp(db, user, firebase);
    } else {
      showAuthScreen(firebase);
    }
  });
});

// ── Auth screens ──────────────────────────────────────────────────────────────
function showAuthScreen(firebase) {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display   = 'flex';

  document.getElementById('sign-in-btn').addEventListener('click', function () {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(function (err) {
      document.getElementById('auth-error').textContent = err.message;
    });
  }, { once: true });
}

function showError(msg) {
  document.getElementById('loading-screen').innerHTML =
    `<p style="color:#d93025;font-size:14px;text-align:center;padding:24px">${msg}</p>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
var appInitialised = false;
function showApp(db, user, firebase) {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display   = 'none';

  if (appInitialised) return;
  appInitialised = true;

  // User avatar in header
  if (user.photoURL) {
    var avatar = document.getElementById('user-avatar');
    avatar.style.backgroundImage = `url(${user.photoURL})`;
    avatar.style.display = 'block';
  }

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  // Settings sheet
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-overlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('settings-overlay')) closeSettings();
  });
  document.getElementById('sign-out-btn').addEventListener('click', function () {
    firebase.auth().signOut();
    closeSettings();
  });

  document.getElementById('matt-link-submit-btn').addEventListener('click', handleMattLink);
  document.getElementById('matt-unlink-btn').addEventListener('click', handleMattUnlink);

  // Initialise views
  initAdviser();
  initPicker();
  initPaints();
  initCollection(db, user.uid);
  initMatt(db, user.uid);

  // Shared chat input
  initChatInput();

  // Unregister any service worker — it was causing stale caching issues
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.unregister(); });
    });
  }

  document.getElementById('refresh-btn').addEventListener('click', function () {
    window.location.reload();
  });
}

// ── Chat input (shared by Adviser + Matt) ─────────────────────────────────────
var activeChatMode = 'adviser';

function initChatInput() {
  var input     = document.getElementById('chat-input');
  var btn       = document.getElementById('chat-send-btn');
  var fileInput = document.getElementById('chat-file-input');

  document.getElementById('chat-mode-bar').addEventListener('click', function (e) {
    var modeBtn = e.target.closest('.chat-mode-btn');
    if (!modeBtn) return;
    switchChatMode(modeBtn.dataset.mode);
  });

  btn.addEventListener('click', dispatchChatSend);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dispatchChatSend(); }
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Attachment button → open file picker
  document.getElementById('chat-attach-btn').addEventListener('click', function () {
    fileInput.click();
  });

  // File selected → read as base64 and store
  fileInput.addEventListener('change', async function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'];
    if (!allowed.includes(file.type)) {
      alert('Attach an image (JPG, PNG, WEBP, GIF) or a PDF.');
      fileInput.value = '';
      return;
    }
    // 10 MB limit — larger files cause mobile fetch failures
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large (max 10 MB). Try a smaller image or a compressed PDF.');
      fileInput.value = '';
      return;
    }
    try {
      showAttachPreview('Uploading…');
      var att = await uploadAttachment(file);
      setPendingAttachment(att);
      showAttachPreview(file.name);
    } catch (e) {
      clearPendingAttachment();
      hideAttachPreview();
      alert('Could not upload file: ' + e.message);
    }
    fileInput.value = '';
  });

  // Remove attachment
  document.getElementById('chat-attach-remove').addEventListener('click', function () {
    clearPendingAttachment();
    hideAttachPreview();
  });
}

function showAttachPreview(name) {
  var chip = document.getElementById('chat-attach-preview');
  document.getElementById('chat-attach-name').textContent = name;
  chip.style.display = 'flex';
}

function hideAttachPreview() {
  document.getElementById('chat-attach-preview').style.display = 'none';
  document.getElementById('chat-attach-name').textContent = '';
}

function dispatchChatSend() {
  hideAttachPreview();
  if (activeChatMode === 'adviser') sendAdviserMessage();
  else sendMattMessage();
}

function switchChatMode(mode) {
  activeChatMode = mode;
  document.querySelectorAll('.chat-mode-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  document.querySelectorAll('.chat-pane').forEach(function (p) {
    p.classList.toggle('active', p.id === 'pane-' + mode);
  });
  document.getElementById('chat-input').placeholder =
    mode === 'adviser' ? 'Ask about paints…' : 'Ask Matt anything…';
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('chat-input-bar').style.display = tab === 'chat' ? 'flex' : 'none';
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

// ── Matt Telegram link ────────────────────────────────────────────────────────
async function handleMattLink() {
  var code  = (document.getElementById('matt-link-code').value || '').trim();
  var errEl = document.getElementById('matt-link-error');
  errEl.textContent = '';
  if (!/^\d{6}$/.test(code)) {
    errEl.textContent = 'Enter the 6-digit code from the bot.';
    return;
  }
  var btn = document.getElementById('matt-link-submit-btn');
  btn.disabled = true;
  btn.textContent = '…';
  try {
    var res  = await fetch('/api/matt-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    var data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Failed');
    await linkMatt(data.chatId);
    document.getElementById('matt-link-code').value = '';
    closeSettings();
  } catch (e) {
    errEl.textContent = e.message || 'Could not link. Try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Link';
  }
}

async function handleMattUnlink() {
  await unlinkMatt();
}

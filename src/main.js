import { loadFirebase, PREVIEW_MODE } from './firebase.js';
import { initAdviser }                from './views/adviser.js';
import { initPicker }                 from './views/picker.js';
import { initPaints }                 from './views/paints.js';
import { initCollection }             from './views/collection.js';

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
  });
}

function showError(msg) {
  document.getElementById('loading-screen').innerHTML =
    `<p style="color:#d93025;font-size:14px;text-align:center;padding:24px">${msg}</p>`;
}

// ── App ───────────────────────────────────────────────────────────────────────
function showApp(db, user, firebase) {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display   = 'none';
  document.getElementById('app-screen').style.display    = 'flex';

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

  // Initialise views
  initAdviser();
  initPicker();
  initPaints();
  initCollection(db, user.uid);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  initPullToRefresh();
}

// ── Pull-to-refresh ───────────────────────────────────────────────────────────
function initPullToRefresh() {
  var el        = document.getElementById('app-screen');
  var indicator = document.getElementById('ptr-indicator');
  var startY = 0, pulling = false;
  var THRESHOLD = 72;

  el.addEventListener('touchstart', function (e) {
    if (el.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  el.addEventListener('touchmove', function (e) {
    if (!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      var progress = Math.min(dy / THRESHOLD, 1);
      indicator.style.opacity  = progress;
      indicator.style.transform = `translateY(${Math.min(dy * 0.4, 28)}px)`;
    }
  }, { passive: true });

  el.addEventListener('touchend', function (e) {
    if (!pulling) return;
    var dy = e.changedTouches[0].clientY - startY;
    indicator.style.opacity   = '';
    indicator.style.transform = '';
    pulling = false;
    if (dy >= THRESHOLD) window.location.reload();
  }, { passive: true });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('adviser-search-bar').style.display = tab === 'adviser' ? '' : 'none';
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

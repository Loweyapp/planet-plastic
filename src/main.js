import { loadFirebase, PREVIEW_MODE } from './firebase.js';
import { initAdviser }                from './views/adviser.js';
import { initPicker }                 from './views/picker.js';
import { initPaints }                 from './views/paints.js';
import { initCollection, connectCollectionFirestore } from './views/collection.js';

var appShellReady = false;

// ── Boot ──────────────────────────────────────────────────────────────────────
// If the user was previously signed in, show the app shell immediately so the
// bottom nav is never hidden during a page reload while Firebase re-authenticates.
if (localStorage.getItem('pp_loggedIn')) {
  showAppShell();
}

var loadingTimer = appShellReady ? null : setTimeout(function () {
  showError('Taking too long to load. <br><a href="" style="color:#1a73e8">Tap to reload</a>');
}, 8000);

loadFirebase(function (db, firebase) {
  if (loadingTimer) clearTimeout(loadingTimer);
  if (!db || !firebase) {
    if (!appShellReady) showError('Could not load Firebase. Check your connection and reload.');
    return;
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      localStorage.setItem('pp_loggedIn', '1');

      // Avatar
      if (user.photoURL) {
        var avatar = document.getElementById('user-avatar');
        avatar.style.backgroundImage = `url(${user.photoURL})`;
        avatar.style.display = 'block';
      }

      // Sign-out (needs firebase reference)
      document.getElementById('sign-out-btn').addEventListener('click', function () {
        localStorage.removeItem('pp_loggedIn');
        firebase.auth().signOut();
        closeSettings();
      });

      if (appShellReady) {
        // Shell already visible — just connect live Firestore
        connectCollectionFirestore(db, user.uid);
      } else {
        showAppShell();
        connectCollectionFirestore(db, user.uid);
      }
    } else {
      localStorage.removeItem('pp_loggedIn');
      if (appShellReady) {
        document.getElementById('app-screen').style.display = 'none';
      }
      showAuthScreen(firebase);
    }
  });
});

// ── App shell ─────────────────────────────────────────────────────────────────
function showAppShell() {
  if (appShellReady) return;
  appShellReady = true;

  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display   = 'none';
  document.getElementById('app-screen').style.display    = 'flex';

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  // Settings sheet
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-overlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('settings-overlay')) closeSettings();
  });

  // Refresh — full reload is fine now because the shell shows immediately on load
  document.getElementById('refresh-btn').addEventListener('click', function () {
    window.location.reload();
  });

  // Initialise views; collection loads from localStorage cache until Firestore connects
  initAdviser();
  initPicker();
  initPaints();
  initCollection(null, null);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

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

// Firebase loaded via CDN (same pattern as planit-lowe — avoids npm firebase package).

var firebaseReady = false;
var _db = null;
var _fb = null;

export var PREVIEW_MODE = (function () {
  try {
    var inIframe = window.self !== window.top;
    var host = window.location.hostname;
    var REAL_HOSTS = ['planet-plastic.vercel.app', 'localhost', '127.0.0.1'];
    return inIframe || !REAL_HOSTS.includes(host);
  } catch (e) {
    return true;
  }
})();

var FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAsYzWnyKTGff8cP_p2DbQDgeYqf5Gvvdc',
  authDomain:        'planet-plastic-d92e0.firebaseapp.com',
  projectId:         'planet-plastic-d92e0',
  storageBucket:     'planet-plastic-d92e0.firebasestorage.app',
  messagingSenderId: '561552427864',
  appId:             '1:561552427864:web:7c340c31e8f1d21840f32d',
};

export function loadFirebase(callback) {
  if (firebaseReady) { callback(_db, _fb); return; }

  function load(src, onload, onerror) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = onerror || function () { callback(null, null); };
    document.head.appendChild(s);
  }

  var base = 'https://www.gstatic.com/firebasejs/9.23.0/';
  load(base + 'firebase-app-compat.js', function () {
    load(base + 'firebase-firestore-compat.js', function () {
      load(base + 'firebase-auth-compat.js', function () {
        try {
          var app = window.firebase.apps.length
            ? window.firebase.app()
            : window.firebase.initializeApp(FIREBASE_CONFIG);
          _db = app.firestore();
          _fb = window.firebase;
          firebaseReady = true;
          callback(_db, _fb);
        } catch (e) {
          callback(null, null);
        }
      });
    });
  });
}

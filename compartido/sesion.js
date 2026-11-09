/* Sesión común local: no contiene usuarios, tokens ni una alternativa a Google.
   Carga config y SDK en orden con etiquetas script creadas por código (sin document.write);
   TW_SESION existe desde el primer instante y listo() espera el primer estado de sesión. */
(function () {
  'use strict';
  var self = document.currentScript && document.currentScript.src;
  var base = self ? self.slice(0, self.lastIndexOf('/') + 1) : 'compartido/';
  var config = null, app = null, auth = null, actual = null, firestorePromise = null;

  function cargarScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function usuario() {
    return actual ? { uid: actual.uid, nombre: actual.displayName || '', correo: actual.email || '' } : null;
  }

  var primera = cargarScript(base + 'config.js')
    .then(function () { return cargarScript(base + '../vendor/firebase-app-compat-13.2.0.js'); })
    .then(function () { return cargarScript(base + '../vendor/firebase-auth-compat-13.2.0.js'); })
    .then(function () {
      config = window.TW_CONFIG;
      if (!config || !window.firebase) throw new Error('No se pudo iniciar la sesión local.');
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp({
        apiKey: config.apiKey || 'local-only',
        authDomain: config.authDomain || 'localhost',
        projectId: config.projectId,
        appId: config.appId || 'theway-local'
      });
      auth = firebase.auth(app);
      if (config.emulador) auth.useEmulator(config.authHost, { disableWarnings: true });
      return new Promise(function (resolve) {
        auth.onAuthStateChanged(function (u) { actual = u || null; resolve(usuario()); });
      });
    });

  function cargarFirestore() {
    if (firestorePromise) return firestorePromise;
    firestorePromise = primera.then(function () {
      if (firebase.firestore) return null;
      return cargarScript(base + '../vendor/firebase-firestore-compat-13.2.0.js');
    }).then(function () {
      var db = firebase.firestore(app);
      if (config.emulador) {
        var h = String(config.firestoreHost || '127.0.0.1:18080').split(':');
        db.useEmulator(h[0], Number(h[1]));
      }
      return db;
    });
    return firestorePromise;
  }
  function entrar() {
    /* Sin await ni promesas antes de signInWithPopup: debe seguir dentro del gesto del clic. */
    if (!auth) {
      var e0 = new Error('El ingreso se está preparando.'); e0.code = 'error';
      return Promise.reject(e0);
    }
    var intento = auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    return intento.then(function (u) { actual = u.user || auth.currentUser; return usuario(); }, function (e) {
      var error = new Error(e && e.message || 'No pudimos completar el ingreso.');
      error.code = e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') ? 'cancelado' : 'error';
      throw error;
    });
  }
  function salir() { return primera.then(function () { return auth.signOut(); }); }
  function tieneDerecho() {
    return primera.then(function () {
      var u = usuario();
      if (!u) return false;
      return cargarFirestore().then(function (db) {
        return db.collection('derechos').doc(u.uid).get();
      }).then(function (doc) {
        var d = doc.exists && doc.data();
        return !!(d && d.apps && d.apps.metanoia && d.apps.metanoia.activo === true);
      });
    });
  }
  window.TW_SESION = { listo: function () { return primera; }, usuario: usuario, entrar: entrar, salir: salir, tieneDerecho: tieneDerecho, firestore: cargarFirestore };
})();

/* Adaptador del curso (v2): usa la sesión común; no pinta pantallas ni inicializa Firebase.
   Avance sincronizado COMPLETO (jornadas, pasos, cierres, insignias): cada elemento lleva su hora de cambio y gana el
   más reciente, así reabrir un día o desmarcar un paso también viaja. Lo local se guarda primero; la nube se actualiza
   con reintentos y NUNCA bloquea la apertura del curso. No guarda contenido privado en el dispositivo. */
(function () {
  'use strict';
  var K_PROG = 'tw_metanoia_prog', K_SYNC = 'tw_metanoia_sync', K_ACC = 'tw_metanoia_acceso', K_DUENO = 'tw_metanoia_dueno';
  var VIGENCIA = 7 * 24 * 60 * 60 * 1000;
  var REINTENTOS = [5000, 30000, 120000];
  var CFG = { apertura: 4000 };
  var ISOD = /^\d{4}-\d{2}-\d{2}$/;
  var RX = { h: /^([1-9]|1\d|20)$/, p: /^\d{1,2}:\d{1,2}$/, c: /^\d{1,2}$/, b: /^[a-z]{1,20}$/ };
  var SECC = ['h', 'p', 'c'];
  var setRaw = Storage.prototype.setItem;
  var vista = null, corriendo = false, sucio = false, fallos = 0, temporizador = null, recargaPend = false;
  var cursoAbierto = false, usoCache = false, vigilando = null, terminados = [];

  function error(codigo, correo) { var e = new Error(codigo); e.code = codigo; if (correo) e.correo = correo; return e; }
  function sesion() { return window.TW_SESION; }
  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function guardar(k, v) { try { setRaw.call(localStorage, k, JSON.stringify(v)); } catch (e) {} }
  function revivir(valor) {
    if (Array.isArray(valor)) return valor.map(revivir);
    if (!valor || typeof valor !== 'object') return valor;
    if (Object.keys(valor).length === 1 && Array.isArray(valor.__twArray)) return valor.__twArray.map(revivir);
    Object.keys(valor).forEach(function (k) { valor[k] = revivir(valor[k]); }); return valor;
  }

  /* ---------- Avance: formas y fusión (funciones puras) ---------- */
  function vacio() { return { h: {}, p: {}, c: {} }; }
  function vivo(e) { return e.v === true || typeof e.v === 'string'; }
  function aplanar(o) {
    var f = vacio();
    if (!o || o.v !== 1) return f;
    (Array.isArray(o.done) ? o.done : []).forEach(function (n) { if (Number.isInteger(n) && n >= 1 && n <= 20) f.h[n] = true; });
    Object.keys(o.step || {}).forEach(function (k) { if (RX.p.test(k) && o.step[k] === true) f.p[k] = true; });
    Object.keys(o.closedOn || {}).forEach(function (k) { if (RX.c.test(k) && ISOD.test(o.closedOn[k] || '')) f.c[k] = o.closedOn[k]; });
    return f;
  }
  function extrasDe(o) {
    if (!o || o.v !== 1 || !ISOD.test(o.inicio || '')) return null;
    var b = {}; Object.keys(o.badges || {}).forEach(function (k) { if (RX.b.test(k) && o.badges[k] === true) b[k] = true; });
    return { inicio: o.inicio, welcomed: o.welcomed === true, badges: b };
  }
  function union(a, b) { var r = {}; Object.keys(a || {}).forEach(function (k) { r[k] = 1; }); Object.keys(b || {}).forEach(function (k) { r[k] = 1; }); return Object.keys(r); }
  function mejor(a, b) {
    if (!a) return b; if (!b) return a;
    if (a.t !== b.t) return a.t > b.t ? a : b;
    return vivo(a) ? a : (vivo(b) ? b : a);
  }
  /* Marca con la hora actual lo que cambió entre lo que el curso tenía (vista) y lo que acaba de guardar (nuevo). */
  function estampar(ent, vistaPrev, nuevo, ahora) {
    SECC.forEach(function (s) {
      union(vistaPrev[s], nuevo[s]).forEach(function (k) {
        var a = vistaPrev[s][k], b = nuevo[s][k];
        if (a === b) return;
        ent[s][k] = { v: b === undefined ? (s === 'c' ? null : false) : b, t: ahora };
      });
    });
  }
  function fusionar(ent, nube) {
    var out = vacio(), cambios = false, subir = false;
    SECC.forEach(function (s) {
      union(ent[s], nube[s]).forEach(function (k) {
        var a = ent[s][k], b = nube[s][k], g = mejor(a, b);
        out[s][k] = g;
        if (g === b && b && (!a || a.v !== b.v)) cambios = true;
        if (g === a && a && (!b || b.v !== a.v || b.t !== a.t)) subir = true;
      });
    });
    return { ent: out, cambios: cambios, subir: subir };
  }
  function unirEntradas(a, b) {
    var out = vacio();
    SECC.forEach(function (s) { union(a[s], b[s]).forEach(function (k) { out[s][k] = mejor(a[s][k], b[s][k]); }); });
    return out;
  }
  function iguales(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  /* inicio = la fecha más antigua; bienvenida e insignias nunca se retiran. */
  function fusionarExtras(x, n) {
    var fechas = [x && x.inicio, n.inicio].filter(function (v) { return ISOD.test(v || ''); }).sort();
    var badges = {}; Object.keys((x && x.badges) || {}).forEach(function (k) { badges[k] = true; }); n.badges.forEach(function (k) { badges[k] = true; });
    var res = { inicio: fechas[0], welcomed: !!((x && x.welcomed) || n.welcomed), badges: badges };
    var nb = {}; n.badges.forEach(function (k) { nb[k] = true; });
    var subir = res.inicio !== n.inicio || (res.welcomed && !n.welcomed) || Object.keys(badges).some(function (k) { return !nb[k]; });
    var cambios = !x || res.inicio !== x.inicio || (res.welcomed && !x.welcomed) || Object.keys(badges).some(function (k) { return !(x && x.badges[k]); });
    res.subir = !!subir && !!res.inicio; res.cambios = !!cambios && !!res.inicio;
    return res;
  }
  function materializar(ent, x) {
    var done = Object.keys(ent.h).filter(function (k) { return ent.h[k].v === true; }).map(Number).sort(function (a, b) { return a - b; });
    var step = {}, closedOn = {};
    Object.keys(ent.p).forEach(function (k) { if (ent.p[k].v === true) step[k] = true; });
    Object.keys(ent.c).forEach(function (k) { if (typeof ent.c[k].v === 'string') closedOn[k] = ent.c[k].v; });
    return { v: 1, inicio: x.inicio, done: done, step: step, closedOn: closedOn, badges: x.badges, welcomed: !!x.welcomed };
  }
  /* Lo que llega de la nube se valida antes de usarlo. */
  function limpiarNube(d) {
    var r = { ent: vacio(), inicio: null, welcomed: false, badges: [] };
    if (!d || typeof d !== 'object') return r;
    if (ISOD.test(d.inicio || '')) r.inicio = d.inicio;
    r.welcomed = d.welcomed === true;
    (Array.isArray(d.badges) ? d.badges : []).forEach(function (k) { if (RX.b.test(k)) r.badges.push(k); });
    if (d.v === 2) {
      [['h', 'hechos'], ['p', 'pasos'], ['c', 'cierres']].forEach(function (par) {
        var m = d[par[1]] && typeof d[par[1]] === 'object' ? d[par[1]] : {};
        Object.keys(m).forEach(function (k) {
          var e = m[k];
          if (!RX[par[0]].test(k) || !e || typeof e.t !== 'number' || !isFinite(e.t)) return;
          if (par[0] === 'c' ? (e.v === null || (typeof e.v === 'string' && ISOD.test(e.v))) : typeof e.v === 'boolean') r.ent[par[0]][k] = { v: e.v, t: e.t };
        });
      });
    } else if (Array.isArray(d.done)) { /* documento de la versión anterior: solo jornadas hechas */
      d.done.forEach(function (n) { if (Number.isInteger(n) && n >= 1 && n <= 20) r.ent.h[n] = { v: true, t: 0 }; });
    }
    return r;
  }
  function docNube(ent, x) {
    return { v: 2, inicio: x.inicio, welcomed: !!x.welcomed, badges: Object.keys(x.badges).sort(), hechos: ent.h, pasos: ent.p, cierres: ent.c, actualizado: firebase.firestore.FieldValue.serverTimestamp() };
  }
  function maxT(ent) { var m = 0; SECC.forEach(function (s) { Object.keys(ent[s]).forEach(function (k) { if (ent[s][k].t > m) m = ent[s][k].t; }); }); return m; }

  /* ---------- Meta de sincronización (en el dispositivo) ---------- */
  function cargarMeta() {
    var m = leer(K_SYNC);
    if (m && m.v === 2 && m.ent) return m;
    m = { v: 2, ent: vacio(), lam: 0, x: null };
    var prog = leer(K_PROG), f = aplanar(prog);
    SECC.forEach(function (s) { Object.keys(f[s]).forEach(function (k) { m.ent[s][k] = { v: f[s][k], t: 0 }; }); });
    m.x = extrasDe(prog);
    return m;
  }
  function ahora(m) { var t = Math.max(Date.now(), (m.lam || 0) + 1); m.lam = t; return t; }
  function alGuardarCurso() {
    var prog = leer(K_PROG), nuevo = aplanar(prog), m = cargarMeta();
    if (!vista) vista = vacio();
    estampar(m.ent, vista, nuevo, ahora(m));
    var x = extrasDe(prog); if (x) m.x = x;
    vista = nuevo; guardar(K_SYNC, m); pedir();
  }
  var original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key) {
    var r = original.apply(this, arguments);
    if (key === K_PROG && this === window.localStorage) { try { alGuardarCurso(); } catch (e) { console.error(e); } }
    return r;
  };
  vista = aplanar(leer(K_PROG));

  /* Cada cuenta conserva su avance en este dispositivo; al cambiar de cuenta se guarda el de la anterior. */
  function prepararLocal(uid) {
    var dueno = localStorage.getItem(K_DUENO);
    if (dueno && dueno !== uid) {
      [K_PROG, K_SYNC].forEach(function (k) {
        var v = localStorage.getItem(k);
        if (v !== null) { setRaw.call(localStorage, k + '_' + dueno, v); localStorage.removeItem(k); }
        var w = localStorage.getItem(k + '_' + uid);
        if (w !== null) { setRaw.call(localStorage, k, w); localStorage.removeItem(k + '_' + uid); }
      });
    }
    setRaw.call(localStorage, K_DUENO, uid);
    var m = leer(K_SYNC);
    if (m && m.v === 2 && m.x) guardar(K_PROG, materializar(m.ent, m.x));
    vista = aplanar(leer(K_PROG));
  }

  /* ---------- Sincronización con cola y reintentos ---------- */
  function pedir() { sucio = true; if (!corriendo) correr(); }
  function programar() {
    clearTimeout(temporizador);
    var d = REINTENTOS[Math.min(fallos, REINTENTOS.length - 1)]; fallos++;
    temporizador = setTimeout(pedir, d);
  }
  async function correr() {
    corriendo = true;
    try { while (sucio) { sucio = false; await intento(); fallos = 0; } }
    catch (e) { sucio = true; programar(); }
    finally { corriendo = false; terminados.splice(0).forEach(function (f) { f(); }); }
  }
  function esperarCiclo(ms) {
    return new Promise(function (resolve) {
      var t = setTimeout(resolve, ms); terminados.push(function () { clearTimeout(t); resolve(); });
      pedir();
    });
  }
  async function intento() {
    var s = sesion(); if (!s) return;
    var u = await s.listo(); if (!u) return;
    if (localStorage.getItem(K_DUENO) !== u.uid) return;
    var db = await s.firestore();
    var ref = db.collection('apps').doc('metanoia').collection('usuarios').doc(u.uid);
    var res = await db.runTransaction(async function (tx) {
      var snap = await tx.get(ref), nube = limpiarNube(snap.exists ? snap.data() : null);
      var m = cargarMeta(), f = fusionar(m.ent, nube.ent), xs = fusionarExtras(m.x, nube);
      var hayDatos = !!xs.inicio;
      if (hayDatos && (!snap.exists || f.subir || xs.subir)) tx.set(ref, docNube(f.ent, xs));
      return { ent: f.ent, cambios: f.cambios || xs.cambios, xs: hayDatos ? xs : null, lam: Math.max(maxT(nube.ent), maxT(f.ent)) };
    });
    aplicar(res);
  }
  function aplicar(res) {
    var m = cargarMeta();
    var unido = unirEntradas(m.ent, res.ent);
    if (!iguales(unido, res.ent)) sucio = true; /* el curso guardó algo mientras se sincronizaba */
    m.ent = unido; m.lam = Math.max(m.lam || 0, res.lam || 0);
    if (res.xs) m.x = { inicio: res.xs.inicio, welcomed: res.xs.welcomed, badges: res.xs.badges };
    guardar(K_SYNC, m);
    if (res.cambios && res.xs) {
      var prog = materializar(unido, m.x);
      guardar(K_PROG, prog);
      if (cursoAbierto && !iguales(aplanar(prog), vista)) recargarCuandoPueda();
    }
  }
  function libre() {
    var a = document.activeElement;
    return document.visibilityState === 'visible' && !(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
  }
  /* El avance ya está guardado; recargar solo muestra en pantalla lo que llegó de otro dispositivo. */
  function recargarCuandoPueda() {
    if (recargaPend) return; recargaPend = true;
    var t = setInterval(function () { if (libre()) { clearInterval(t); location.reload(); } }, 1500);
  }
  window.addEventListener('online', function () { pedir(); revalidar(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pedir(); });

  /* ---------- Acceso: el servidor decide; la validación local dura 7 días y solo tras un «sí» ---------- */
  function cacheValida(uid) {
    var c = leer(K_ACC), t = c && c.t;
    return !!(c && c.uid === uid && typeof t === 'number' && Date.now() - t <= VIGENCIA && t <= Date.now() + 60000);
  }
  function porRed(e) {
    var c = e && e.code;
    return (typeof navigator !== 'undefined' && navigator.onLine === false) || c === 'unavailable' || c === 'deadline-exceeded' || c === 'failed-precondition' || c === 'auth/network-request-failed' || c === 'network-request-failed';
  }
  async function revalidar() {
    if (!usoCache) return;
    var s = sesion(), u = s && s.usuario && s.usuario(); if (!u) return;
    try {
      var ok = await s.tieneDerecho();
      if (!ok) { localStorage.removeItem(K_ACC); usoCache = false; location.reload(); }
      else { guardar(K_ACC, { uid: u.uid, t: Date.now() }); usoCache = false; clearInterval(vigilando); vigilando = null; }
    } catch (e) { /* sigue sin red: se reintenta */ }
  }
  function vigilarCache() { if (!vigilando) vigilando = setInterval(revalidar, 60000); }
  async function usuarioConDerecho() {
    var s = sesion();
    if (!s) throw error('sin-sesion');
    var u = await s.listo();
    if (!u) throw error('sin-sesion');
    var ok;
    try { ok = await s.tieneDerecho(); }
    catch (e) { if (porRed(e) && cacheValida(u.uid)) { usoCache = true; vigilarCache(); return u; } throw e; }
    if (!ok) { localStorage.removeItem(K_ACC); throw error('sin-derecho', u.correo); }
    guardar(K_ACC, { uid: u.uid, t: Date.now() });
    return u;
  }

  window.TW_PROVEEDOR = {
    base: async function () {
      var u = await usuarioConDerecho();
      prepararLocal(u.uid);
      await esperarCiclo(CFG.apertura); /* si la nube no responde a tiempo, el curso abre con lo guardado aquí */
      var db = await sesion().firestore();
      var snap = await db.collection('cursos').doc('metanoia').collection('comun').doc('base').get();
      if (!snap.exists) throw new Error('base no disponible');
      vista = aplanar(leer(K_PROG)); /* lo que el curso va a leer ahora es lo que "tiene" */
      cursoAbierto = true;
      return revivir(snap.data());
    },
    jornada: async function (n) {
      await usuarioConDerecho();
      var db = await sesion().firestore();
      var snap = await db.collection('cursos').doc('metanoia').collection('jornadas').doc(String(n)).get();
      if (!snap.exists) throw new Error('jornada no disponible');
      return revivir(snap.data());
    },
    _t: { aplanar: aplanar, estampar: estampar, fusionar: fusionar, fusionarExtras: fusionarExtras, materializar: materializar, limpiarNube: limpiarNube, mejor: mejor, cacheValida: cacheValida, reintentos: REINTENTOS, cfg: CFG }
  };
})();

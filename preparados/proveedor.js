/* Preparados para amar · proveedor de datos (THE WAY, Habilidad [2.3.2.3.1]).
   Usa la sesión común (compartido/sesion.js) sin modificarla. No pinta pantallas.
   PRIVACIDAD (decisión de Juan, 24-nov-2026): todo lo que escribe la persona o la pareja se cifra EN EL APARATO
   con AES-GCM y una clave derivada del PIN (PBKDF2-SHA-256). En la nube solo queda texto ilegible: ni el mentor,
   ni LHS, ni los administradores pueden leerlo. Si se olvida el PIN, el contenido no se puede recuperar.
   Rutas de Firestore:
     derechos/{uid}.apps.preparados.activo      acceso al curso (lo escribe la herramienta de Juan)
     cursos/preparados/comun/base               contenido común (texto JSON en el campo «json»)
     cursos/preparados/jornadas/{1..20}         jornadas (texto JSON en el campo «json»)
     apps/preparados/usuarios/{uid}             { v, sal, iv, datos, actualizado }  (cifrado, solo su dueño)
     apps/preparados/parejas/{codigo}           { miembros, v, sal, iv, datos, actualizado }  (cifrado, solo los dos) */
(function () {
  'use strict';
  var ITER = 210000;
  var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var claveP = null, salP = null, datosP = null;      // persona
  var claveC = null, salC = null, datosC = null;      // pareja
  var escuchaPareja = null, alCambiarPareja = null;

  function S() { return window.TW_SESION; }
  function err(code, extra) { var e = new Error(code); e.code = code; if (extra) Object.assign(e, extra); return e; }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(t) { return Uint8Array.from(atob(t), function (c) { return c.charCodeAt(0); }); }
  function azar(n) { return crypto.getRandomValues(new Uint8Array(n)); }

  /* ---------- Cifrado ---------- */
  async function derivar(pin, sal) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrar(clave, obj) {
    var iv = azar(12);
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, clave, new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: b64(iv), datos: b64(ct) };
  }
  async function descifrar(clave, doc) {
    try {
      var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(doc.iv) }, clave, unb64(doc.datos));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { throw err('pin-incorrecto'); }
  }

  /* ---------- Fusión por campo (gana el cambio más reciente) ---------- */
  function fusionar(a, b) {
    var out = {}; a = a || {}; b = b || {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
      var x = a[k], y = b[k];
      if (!x) out[k] = y; else if (!y) out[k] = x; else out[k] = (y.t || 0) > (x.t || 0) ? y : x;
    });
    return out;
  }
  function fusionarPersona(nube, local) {
    return {
      v: 1,
      inicio: (local && local.inicio) || (nube && nube.inicio) || null,
      campos: fusionar(nube && nube.campos, local && local.campos),
      hechos: fusionar(nube && nube.hechos, local && local.hechos),
      inv: fusionar(nube && nube.inv, local && local.inv),
      pareja: (local && local.pareja) || (nube && nube.pareja) || null
    };
  }
  function fusionarPareja(nube, local) {
    return { v: 1, campos: fusionar(nube && nube.campos, local && local.campos), inicio: (nube && nube.inicio) || (local && local.inicio) || null };
  }

  /* ---------- Firestore ---------- */
  async function db() { return S().firestore(); }
  async function uid() { var u = await S().listo(); if (!u) throw err('sin-sesion'); return u.uid; }
  async function refP() { return (await db()).collection('apps').doc('preparados').collection('usuarios').doc(await uid()); }
  async function refC(codigo) { return (await db()).collection('apps').doc('preparados').collection('parejas').doc(codigo); }
  function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }

  async function tieneDerecho() {
    var u = await S().listo(); if (!u) throw err('sin-sesion');
    var d = await (await db()).collection('derechos').doc(u.uid).get();
    var x = d.exists && d.data();
    return !!(x && x.apps && x.apps.preparados && x.apps.preparados.activo === true);
  }
  async function leerJSON(ruta) {
    var d = await (await db()).doc(ruta).get();
    if (!d.exists) throw err('sin-contenido');
    return JSON.parse(d.data().json);
  }

  /* ---------- Persona ---------- */
  async function estadoPersona() {
    var s = await (await refP()).get();
    return s.exists ? 'con-pin' : 'nuevo';
  }
  async function crearPersona(pin, inicio) {
    salP = azar(16); claveP = await derivar(pin, salP);
    datosP = { v: 1, inicio: inicio, campos: {}, hechos: {}, inv: {}, pareja: null };
    var c = await cifrar(claveP, datosP);
    await (await refP()).set({ v: 1, sal: b64(salP), iv: c.iv, datos: c.datos, actualizado: ts() });
    return datosP;
  }
  async function abrirPersona(pin) {
    var s = await (await refP()).get();
    if (!s.exists) throw err('sin-datos');
    var d = s.data(), sal = unb64(d.sal), k = await derivar(pin, sal);
    var x = await descifrar(k, d);
    claveP = k; salP = sal; datosP = fusionarPersona(x, null);
    return datosP;
  }
  /* Guarda con transacción: lee lo de la nube (otro aparato pudo cambiarlo), fusiona por campo y vuelve a cifrar. */
  async function guardarPersona(cambio) {
    if (!claveP) throw err('bloqueado');
    var ref = await refP(), d0 = await db();
    var local = JSON.parse(JSON.stringify(datosP));
    cambio(local);
    var res = await d0.runTransaction(async function (tx) {
      var s = await tx.get(ref);
      var nube = s.exists ? await descifrar(claveP, s.data()) : null;
      var unido = fusionarPersona(nube, local);
      var c = await cifrar(claveP, unido);
      tx.set(ref, { v: 1, sal: b64(salP), iv: c.iv, datos: c.datos, actualizado: ts() });
      return unido;
    });
    datosP = res; return res;
  }
  async function borrarPersona() { await (await refP()).delete(); claveP = null; datosP = null; }

  /* ---------- Pareja ---------- */
  function nuevoCodigo() { var a = azar(10), s = ''; for (var i = 0; i < 10; i++) s += ALFABETO[a[i] % 32]; return s; }
  function normalizarCodigo(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  async function crearPareja(pinPareja) {
    var codigo = nuevoCodigo(), ref = await refC(codigo), u = await uid();
    salC = azar(16); claveC = await derivar(pinPareja, salC);
    datosC = { v: 1, campos: {}, inicio: datosP && datosP.inicio || null };
    var c = await cifrar(claveC, datosC);
    await ref.set({ miembros: [u], v: 1, sal: b64(salC), iv: c.iv, datos: c.datos, actualizado: ts() });
    await guardarPersona(function (p) { p.pareja = { codigo: codigo, pin: String(pinPareja) }; });
    return codigo;
  }
  async function unirPareja(codigoTexto, pinPareja) {
    var codigo = normalizarCodigo(codigoTexto);
    if (!/^[A-Z2-9]{10}$/.test(codigo)) throw err('codigo-invalido');
    var ref = await refC(codigo), u = await uid();
    try { await ref.update({ miembros: firebase.firestore.FieldValue.arrayUnion(u) }); }
    catch (e) { throw err('codigo-no-sirve'); }  /* no existe, ya tiene dos personas o no hay acceso */
    await guardarPersona(function (p) { p.pareja = { codigo: codigo, pin: String(pinPareja) }; });
    return abrirPareja();
  }
  async function abrirPareja() {
    var p = datosP && datosP.pareja; if (!p) return null;
    var s = await (await refC(p.codigo)).get();
    if (!s.exists) throw err('pareja-no-existe');
    var d = s.data(), sal = unb64(d.sal), k = await derivar(p.pin, sal);
    var x = await descifrar(k, d);
    claveC = k; salC = sal; datosC = fusionarPareja(x, null);
    return { codigo: p.codigo, miembros: d.miembros.length, datos: datosC };
  }
  async function cambiarPinPareja(pinPareja) {
    await guardarPersona(function (p) { if (p.pareja) p.pareja.pin = String(pinPareja); });
    return abrirPareja();
  }
  async function guardarPareja(cambio) {
    if (!claveC) throw err('sin-pareja');
    var ref = await refC(datosP.pareja.codigo), d0 = await db();
    var local = JSON.parse(JSON.stringify(datosC)); cambio(local);
    var res = await d0.runTransaction(async function (tx) {
      var s = await tx.get(ref), d = s.data();
      var nube = await descifrar(claveC, d);
      var unido = fusionarPareja(nube, local);
      var c = await cifrar(claveC, unido);
      tx.update(ref, { v: 1, sal: d.sal, iv: c.iv, datos: c.datos, actualizado: ts() });
      return unido;
    });
    datosC = res; return res;
  }
  /* Cuando el otro escribe, se avisa a la pantalla (si ya se pudo descifrar). */
  async function escucharPareja(fn) {
    alCambiarPareja = fn;
    if (escuchaPareja) escuchaPareja();
    var p = datosP && datosP.pareja; if (!p || !claveC) return;
    escuchaPareja = (await refC(p.codigo)).onSnapshot(async function (s) {
      if (!s.exists || !claveC) return;
      try { var x = await descifrar(claveC, s.data()); datosC = fusionarPareja(x, datosC); if (alCambiarPareja) alCambiarPareja(datosC, s.data().miembros.length); } catch (e) { /* aún no */ }
    }, function () {});
  }

  function bloquear() { claveP = claveC = null; datosP = datosC = null; if (escuchaPareja) { escuchaPareja(); escuchaPareja = null; } }

  window.TW_PREP = {
    sesion: S, tieneDerecho: tieneDerecho,
    base: function () { return leerJSON('cursos/preparados/comun/base'); },
    jornada: function (n) { return leerJSON('cursos/preparados/jornadas/' + n); },
    estadoPersona: estadoPersona, crearPersona: crearPersona, abrirPersona: abrirPersona, guardarPersona: guardarPersona, borrarPersona: borrarPersona,
    persona: function () { return datosP; }, pareja: function () { return datosC; },
    crearPareja: crearPareja, unirPareja: unirPareja, abrirPareja: abrirPareja, cambiarPinPareja: cambiarPinPareja, guardarPareja: guardarPareja, escucharPareja: escucharPareja,
    bloquear: bloquear, normalizarCodigo: normalizarCodigo,
    _t: { fusionar: fusionar, fusionarPersona: fusionarPersona, derivar: derivar, cifrar: cifrar, descifrar: descifrar, ITER: ITER }
  };
})();

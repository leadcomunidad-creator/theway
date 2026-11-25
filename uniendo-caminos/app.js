/* Uniendo Caminos · pantallas. Datos y cifrado: proveedor.js (TW_PREP). Sesión: compartido/sesion.js (TW_SESION).
   Nada de lo que escribe la persona se guarda sin cifrar, ni en la nube ni en este aparato. */
(function () {
  'use strict';
  var P = window.TW_PREP;
  var $app = document.getElementById('app');
  var st = { u: null, base: null, jor: {}, vista: 'inicio', n: 1, pareja: null, miembros: 0, guardando: 0, aviso: '' };
  var DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MODO = { ensenanza: 'Enseñanza', individual: 'Cada uno', pareja: 'Los dos' };

  /* ---------- utilidades ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  /* Markdown sencillo: títulos ###, párrafos, citas >, listas (- y 1.) con un nivel de anidación, tablas y separadores. */
  function md(texto) {
    var L = String(texto || '').split('\n'), out = [], i = 0;
    function lista(ini) {
      var ordenada = /^\s*\d+\.\s/.test(L[ini]), tag = ordenada ? 'ol' : 'ul', html = '<' + tag + '>', j = ini, base = L[ini].match(/^\s*/)[0].length;
      while (j < L.length) {
        var m = L[j].match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)$/);
        if (!m) { if (/^\s{2,}\S/.test(L[j]) && html.endsWith('</li>')) { html = html.slice(0, -5) + ' ' + inline(L[j].trim()) + '</li>'; j++; continue; } break; }
        var nivel = m[1].length;
        if (nivel > base) { var sub = lista(j); html = html.slice(0, -5) + sub.html + '</li>'; j = sub.fin; continue; }
        if (nivel < base) break;
        html += '<li>' + inline(m[2]) + '</li>'; j++;
      }
      return { html: html + '</' + tag + '>', fin: j };
    }
    while (i < L.length) {
      var l = L[i];
      if (!l.trim()) { i++; continue; }
      if (/^-{3,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      var h = l.match(/^(#{2,4})\s+(.*)$/);
      if (h) { out.push('<h' + (h[1].length + 1) + '>' + inline(h[2]) + '</h' + (h[1].length + 1) + '>'); i++; continue; }
      if (/^>\s?/.test(l)) { var q = []; while (i < L.length && /^>\s?/.test(L[i])) { q.push(L[i].replace(/^>\s?/, '')); i++; } out.push('<blockquote>' + md(q.join('\n')) + '</blockquote>'); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) { var r = lista(i); out.push(r.html); i = r.fin; continue; }
      if (/^\|/.test(l)) {
        var filas = []; while (i < L.length && /^\|/.test(L[i])) { filas.push(L[i]); i++; }
        var celdas = function (f) { return f.replace(/^\||\|\s*$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var t = '<div class="tabla"><table><thead><tr>' + celdas(filas[0]).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        filas.slice(2).forEach(function (f) { t += '<tr>' + celdas(f).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; });
        out.push(t + '</tbody></table></div>'); continue;
      }
      var p = [l]; i++;
      while (i < L.length && L[i].trim() && !/^(#{2,4}\s|>|\s*([-*]|\d+\.)\s|\||-{3,})/.test(L[i])) { p.push(L[i]); i++; }
      out.push('<p>' + inline(p.join(' ')) + '</p>');
    }
    return out.join('');
  }
  function hoyISO() { var d = new Date(); return iso(d); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function deISO(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function masDias(s, n) { var d = deISO(s); d.setDate(d.getDate() + n); return iso(d); }
  function fechaLarga(s) { var d = deISO(s); return DIAS_SEM[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
  function fechaDe(n) { var w = Math.floor((n - 1) / 5), d = (n - 1) % 5; return masDias(st.persona.inicio, 7 * w + d); }
  function abierta(n) { return hoyISO() >= fechaDe(n); }
  function hecha(n) { var h = st.persona.hechos[n]; return !!(h && h.v); }
  function lunes() {
    var d = new Date(); var dia = d.getDay(); var aLunes = dia === 1 ? 0 : (dia === 0 ? -6 : 1 - dia);
    var base = new Date(d.getFullYear(), d.getMonth(), d.getDate() + aLunes), out = [];
    for (var k = 0; k < 7; k++) { var x = new Date(base); x.setDate(base.getDate() + 7 * k); out.push(iso(x)); }
    return out;
  }
  function pinValido(p) { return typeof p === 'string' && p.length >= 6 && p.length <= 40; }
  function codigoBonito(c) { return c.slice(0, 5) + '-' + c.slice(5); }
  function pintar(html) { $app.innerHTML = html; window.scrollTo(0, 0); }
  function marco(contenido, opciones) {
    opciones = opciones || {};
    return '<header class="barra"><button class="marca" data-ir="inicio" aria-label="Ir al inicio"><span class="marca-t">Uniendo Caminos</span><span class="marca-s">The Way · Habilidades relacionales</span></button>' +
      (opciones.sinMenu ? '' : '<button class="btn-txt" data-act="bloquear" title="Cerrar con PIN">Bloquear</button>') + '</header>' +
      '<main class="hoja">' + contenido + '</main>' +
      '<footer class="pie"><span class="candado" aria-hidden="true"></span> Lo que escriben se guarda cifrado con su PIN. Nadie más puede leerlo.</footer>';
  }
  function estadoGuardado(txt) { var e = document.getElementById('guardado'); if (e) e.textContent = txt; }

  /* ---------- pantallas de entrada ---------- */
  function pantallaCargando(t) { pintar('<div class="centro"><div class="giro" aria-hidden="true"></div><p>' + esc(t || 'Abriendo el curso…') + '</p></div>'); }
  /* Landing (decisiones de Juan, 24-nov-2026): sin montaña; nombre «Uniendo Caminos»; colores de la portada del libro.
     Dibujo: dos personas, cada una por su camino, se encuentran y siguen juntas, de la mano, por un solo camino hacia el amanecer. */
  function persona(color) {
    return '<circle cx="0" cy="-27" r="5.6" fill="' + color + '"/><path d="M-6.5 -19.5 Q0 -22.5 6.5 -19.5 L7.5 -1.5 Q0 1.5 -7.5 -1.5 Z" fill="' + color + '"/>';
  }
  function caminante(id, color, ruta) {
    return '<g><animateMotion dur="4.6s" fill="freeze" calcMode="linear" keyTimes="0;0.3;1" keyPoints="0;0;1" path="' + ruta + '"/>' +
      '<g>' + persona(color) + '<animateTransform attributeName="transform" type="scale" values="1.25;1.25;0.78" keyTimes="0;0.3;1" dur="4.6s" fill="freeze"/></g></g>';
  }
  var CAMINOS = '<svg class="caminos" viewBox="0 0 400 236" role="img" aria-label="Dos personas, cada una por su camino, se encuentran y siguen juntas por un solo camino hacia el amanecer">' +
    '<defs><radialGradient id="luz" cx="50%" cy="100%" r="62%"><stop offset="0" stop-color="#FFE3A6" stop-opacity=".95"/><stop offset=".55" stop-color="#F6C46A" stop-opacity=".3"/><stop offset="1" stop-color="#F6C46A" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="uno" gradientUnits="userSpaceOnUse" x1="0" y1="146" x2="0" y2="80"><stop offset="0" stop-color="#2AB3B1"/><stop offset="1" stop-color="#F3C877"/></linearGradient>' +
    '<clipPath id="revela"><rect x="0" y="236" width="400" height="0"><animate attributeName="y" values="236;236;78" keyTimes="0;0.08;1" dur="2.6s" fill="freeze"/><animate attributeName="height" values="0;0;158" keyTimes="0;0.08;1" dur="2.6s" fill="freeze"/></rect></clipPath></defs>' +
    '<g opacity="0"><animate attributeName="opacity" values="0;0;1" keyTimes="0;0.6;1" dur="5.6s" fill="freeze"/><path d="M56 80 A144 74 0 0 1 344 80 Z" fill="url(#luz)"/><path d="M170 80 A30 30 0 0 1 230 80 Z" fill="#F6C46A"/></g>' +
    '<path d="M0 80 Q 60 64 120 74 T 230 70 T 400 76 L 400 80 L 0 80 Z" fill="#CFEAE9" opacity=".8"/>' +
    '<line x1="0" y1="80" x2="400" y2="80" stroke="#B9CACA" stroke-width="1"/>' +
    '<g clip-path="url(#revela)">' +
    '<path d="M8 236 C 74 210, 142 176, 190 148 L 199 143 L 197 155 C 158 182, 106 214, 64 236 Z" fill="#2AB3B1"/>' +
    '<path d="M392 236 C 326 210, 258 176, 210 148 L 201 143 L 203 155 C 242 182, 294 214, 336 236 Z" fill="#E2A23B"/>' +
    '<path d="M189 148 L 211 148 L 201.4 80 L 198.6 80 Z" fill="url(#uno)"/>' +
    '</g>' +
    caminante('a', '#0B4F51', 'M44 228 C 96 206, 152 176, 192 146') +
    caminante('b', '#9A5B12', 'M356 228 C 304 206, 248 176, 208 146') +
    '<line x1="196" y1="135" x2="204" y2="135" stroke="#4A5057" stroke-width="2.4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;0;1" keyTimes="0;0.85;1" dur="5s" fill="freeze"/></line>' +
    '</svg>';
  function pantallaLanding() {
    var u = st.u, nombre = u && u.nombre ? u.nombre.split(' ')[0] : '';
    var boton = u ? '<button class="btn" data-act="continuar">' + (nombre ? 'Entrar, ' + esc(nombre) : 'Entrar a mi curso') + '</button><p class="nota">Entraste como ' + esc(u.correo || u.nombre) + ' · <button class="btn-txt claro" data-act="salir">usar otra cuenta</button></p>'
      : '<button class="btn" data-act="entrar">Entrar con Google</button><p class="nota">Cada uno entra con su propia cuenta.</p>';
    pintar('<div class="portada"><div class="portada-in">' + CAMINOS +
      '<p class="sobre">The Way · Curso prematrimonial</p><h1><span class="t1">Uniendo</span><span class="t2">Caminos</span></h1><p class="lema">De la boda al pacto</p>' +
      '<p class="versiculo">«…se unirá a su mujer, y serán una sola carne».<span>Génesis 2:24</span></p>' +
      '<ul class="claves"><li><b>4</b><span>semanas</span></li><li><b>L–V</b><span>unos 20 minutos al día</span></li><li><b>4</b><span>citas de pareja, los viernes</span></li><li><b>1</b><span>Pacto escrito al final</span></li></ul>' +
      '<p class="intro">Una boda dura un día; un pacto, toda la vida. Cuatro semanas para conocerse de verdad, hablar lo que no han hablado y salir con acuerdos claros.</p>' +
      boton + '<p class="privado"><span class="candado" aria-hidden="true"></span> Lo que escriban se guarda cifrado con su PIN. Solo ustedes pueden leerlo.</p></div></div>');
    var svg = document.querySelector('.caminos');
    if (svg && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && svg.setCurrentTime) { svg.pauseAnimations(); svg.setCurrentTime(10); }
  }
  function pantallaSinAcceso() {
    pintar(marco('<section class="tarjeta"><h2>Tu cuenta todavía no tiene acceso</h2><p>Entraste como <strong>' + esc(st.u.correo || st.u.nombre) + '</strong>. Si ya hicieron la inscripción, escríbele a tu líder para que active el curso para esta cuenta.</p><button class="btn sec" data-act="salir">Entrar con otra cuenta</button></section>', { sinMenu: true }));
  }
  function pantallaCrear() {
    var L = lunes(), porDefecto = L[0] === hoyISO() ? 0 : 1;
    var opciones = L.map(function (l, i) { return '<option value="' + l + '"' + (i === porDefecto ? ' selected' : '') + '>' + fechaLarga(l) + (l < hoyISO() ? ' (ya empezó esta semana)' : '') + '</option>'; }).join('');
    pintar(marco('<section class="tarjeta"><h2>Bienvenidos</h2>' +
      '<p>Antes de empezar, crea tu <strong>PIN personal</strong>. Con él se cifra todo lo que escribas: ni tu pareja, ni tu mentor, ni LHS pueden leerlo.</p>' +
      '<label class="campo-l">Tu PIN (mínimo 6 letras o números)<input type="password" id="pin1" autocomplete="new-password" inputmode="text" maxlength="40"></label>' +
      '<label class="campo-l">Escríbelo otra vez<input type="password" id="pin2" autocomplete="new-password" maxlength="40"></label>' +
      '<div class="alerta"><strong>Importante:</strong> si olvidas tu PIN, lo que escribiste no se puede recuperar. Nadie puede abrirlo, ni siquiera nosotros. Anótalo en un lugar seguro.</div>' +
      '<label class="campo-l">¿Qué lunes empiezan?<select id="inicio">' + opciones + '</select></label>' +
      '<p class="nota">Cada día del curso se abre en su fecha, de lunes a viernes. Pónganse de acuerdo para empezar el mismo lunes.</p>' +
      '<p class="error" id="err"></p><button class="btn" data-act="crear">Crear mi PIN y empezar</button></section>', { sinMenu: true }));
  }
  function pantallaPin(msg) {
    pintar(marco('<section class="tarjeta estrecha"><h2>Hola' + (st.u.nombre ? ', ' + esc(st.u.nombre.split(' ')[0]) : '') + '</h2><p>Escribe tu PIN para abrir lo tuyo.</p>' +
      '<label class="campo-l">PIN<input type="password" id="pin" autocomplete="current-password" maxlength="40"></label>' +
      '<p class="error" id="err">' + esc(msg || '') + '</p><button class="btn" data-act="abrir">Abrir</button>' +
      '<details class="olvido"><summary>Olvidé mi PIN</summary><p>Lo que escribiste está cifrado con tu PIN y no se puede recuperar. Si no lo recuerdas, puedes empezar de nuevo: se borra lo que escribiste (lo de pareja no se borra).</p><button class="btn peligro" data-act="reiniciar">Borrar lo mío y empezar de nuevo</button></details>' +
      '<button class="btn-txt" data-act="salir">Entrar con otra cuenta</button></section>', { sinMenu: true }));
    setTimeout(function () { var e = document.getElementById('pin'); if (e) e.focus(); }, 50);
  }

  /* ---------- inicio ---------- */
  function siguiente() { for (var n = 1; n <= 20; n++) if (abierta(n) && !hecha(n)) return n; for (var m = 20; m >= 1; m--) if (abierta(m)) return m; return 1; }
  function tarjetaPareja() {
    var p = st.persona.pareja, f = st.formPareja;
    var pinCampos = '<label class="campo-l">PIN de pareja (mínimo 6 letras o números)<input type="password" id="pp1" autocomplete="off" maxlength="40"></label>';
    if (!p && f === 'crear') return '<section class="tarjeta pareja" id="tpareja"><h3>Crear el código de pareja</h3><p>Inventa un <strong>PIN de pareja</strong>. Se lo vas a decir a tu pareja en persona o en una llamada; con él se cifra lo que escriban juntos.</p>' + pinCampos +
      '<label class="campo-l">Escríbelo otra vez<input type="password" id="pp2" autocomplete="off" maxlength="40"></label><p class="error" id="errp"></p><div class="fila"><button class="btn" data-act="pareja-crear-ok">Crear</button><button class="btn-txt" data-act="pareja-cancelar">Cancelar</button></div></section>';
    if (!p && f === 'unir') return '<section class="tarjeta pareja" id="tpareja"><h3>Unirme a mi pareja</h3><p>Escribe el código y el PIN de pareja que te dio tu pareja.</p>' +
      '<label class="campo-l">Código (10 letras y números)<input type="text" id="pcod" autocomplete="off" autocapitalize="characters" maxlength="14" placeholder="XXXXX-XXXXX"></label>' + pinCampos +
      '<p class="error" id="errp"></p><div class="fila"><button class="btn" data-act="pareja-unir-ok">Unirme</button><button class="btn-txt" data-act="pareja-cancelar">Cancelar</button></div></section>';
    if (!p) return '<section class="tarjeta pareja"><h3>Unan sus cuentas</h3><p>Los acuerdos y el Pacto se escriben entre los dos. Uno crea un código y un <strong>PIN de pareja</strong>; el otro los escribe en su cuenta.</p><div class="fila"><button class="btn" data-act="pareja-crear">Crear el código</button><button class="btn sec" data-act="pareja-unir">Tengo un código</button></div></section>';
    if (!st.pareja) return '<section class="tarjeta pareja" id="tpareja"><h3>Su espacio de pareja</h3><p>El PIN de pareja guardado no abre su espacio. Pídeselo otra vez a tu pareja y escríbelo aquí.</p>' + pinCampos + '<p class="error" id="errp"></p><button class="btn" data-act="pareja-pin-ok">Abrir</button></section>';
    if (st.miembros < 2) return '<section class="tarjeta pareja"><h3>Falta tu pareja</h3><p>Compártele este código y el PIN de pareja que creaste. Díselos en persona o en una llamada.</p><p class="codigo">' + codigoBonito(p.codigo) + '</p><p class="nota">Cuando tu pareja los escriba en su cuenta, aquí verás que ya están unidos.</p></section>';
    return '<section class="tarjeta pareja ok"><h3>Unidos</h3><p>Ya pueden escribir juntos los acuerdos y el Pacto. Lo que uno escribe le aparece al otro.</p></section>';
  }
  function pantallaInicio() {
    var b = st.base, sig = siguiente(), j = st.base.indice[sig - 1];
    var semanas = b.semanas.map(function (s) {
      var dias = '';
      for (var k = 1; k <= 5; k++) {
        var n = (s.n - 1) * 5 + k, ab = abierta(n), he = hecha(n), jj = st.base.indice[n - 1];
        dias += '<li><button class="dia ' + (he ? 'hecha' : ab ? 'abierta' : 'cerrada') + '" data-jornada="' + n + '"' + (ab ? '' : ' disabled') + '>' +
          '<span class="dia-n">' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][k - 1] + '</span><span class="dia-t">' + esc(jj ? jj.titulo.replace(/^Cita \d · /, 'Cita · ') : '') + '</span>' +
          '<span class="dia-e">' + (he ? '✓ Hecha' : ab ? (jj && jj.modo === 'pareja' ? 'Los dos' : 'Abierta') : 'Se abre el ' + fechaLarga(fechaDe(n))) + '</span></button></li>';
      }
      return '<section class="semana"><h3><span>Semana ' + s.n + '</span> ' + esc(s.titulo) + '</h3><p class="trata">' + inline(s.trata.charAt(0).toUpperCase() + s.trata.slice(1)) + '</p><ul class="dias">' + dias + '</ul></section>';
    }).join('');
    var invI = st.persona.inv['inicial:hecho'], invF = st.persona.inv['final:hecho'];
    var inv = '<section class="tarjeta"><h3>Inventario</h3><p>Una herramienta personal de 15 minutos. Se responde al inicio y otra vez al final, para ver qué cambió. Nadie más ve tus respuestas.</p><div class="fila">' +
      '<button class="btn ' + (invI ? 'sec' : '') + '" data-act="inv" data-cual="inicial">' + (invI ? 'Ver mi inventario inicial' : 'Llenar el inventario inicial') + '</button>' +
      (abierta(20) ? '<button class="btn ' + (invF ? 'sec' : '') + '" data-act="inv" data-cual="final">' + (invF ? 'Ver mi inventario final' : 'Llenar el inventario final') + '</button>' : '<span class="nota">El final se abre el día 20.</span>') + '</div></section>';
    var hechas = 0; for (var n = 1; n <= 20; n++) if (hecha(n)) hechas++;
    pintar(marco(
      '<section class="hero"><p class="sobre">Curso prematrimonial · ' + hechas + ' de 20 días</p><h1>Uniendo Caminos</h1><p class="lema">De la boda al pacto</p>' +
      '<div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="20" aria-valuenow="' + hechas + '"><span style="width:' + (hechas * 5) + '%"></span></div></section>' +
      (st.aviso ? '<p class="aviso">' + esc(st.aviso) + '</p>' : '') +
      (abierta(1) ? '<section class="tarjeta hoy"><p class="sobre">' + (hecha(sig) ? 'Lo último abierto' : 'Para hoy') + '</p><h2>' + esc(j ? j.titulo : '') + '</h2><p>' + esc(j ? 'Semana ' + j.semana + ' · ' + j.dia + ' · ' + MODO[j.modo] : '') + '</p><button class="btn" data-jornada="' + sig + '">Abrir</button></section>'
        : '<section class="tarjeta hoy"><p class="sobre">Empiezan el ' + fechaLarga(st.persona.inicio) + '</p><h2>Mientras tanto</h2><p>Llena tu inventario inicial y unan sus cuentas.</p></section>') +
      tarjetaPareja() + inv + semanas +
      '<section class="tarjeta"><h3>Imprimir</h3><div class="fila"><button class="btn sec" data-act="imprimir" data-que="mis">Mis respuestas</button><button class="btn sec" data-act="imprimir" data-que="acuerdos">Nuestros acuerdos y Pacto</button><button class="btn sec" data-act="imprimir" data-que="inv-blanco">Inventario en blanco</button></div></section>' +
      '<p class="centro-t"><button class="btn-txt" data-act="salir">Cerrar sesión</button></p>'));
  }

  /* ---------- jornada ---------- */
  function valorP(id) { var c = st.persona.campos[id]; return c ? c.v : ''; }
  function valorC(id) { var c = st.pareja && st.pareja.campos[id]; return c ? c.v : ''; }
  function htmlBloque(bq) {
    if (bq.t === 'md') return '<div class="texto">' + md(bq.md) + '</div>';
    if (bq.t === 'campo') return '<div class="ej"><label class="ej-l" for="c-' + bq.id + '">' + inline(bq.etiqueta) + '</label>' + (bq.ayuda ? '<div class="ej-a">' + md(bq.ayuda) + '</div>' : '') + '<textarea id="c-' + bq.id + '" data-campo="' + bq.id + '" rows="3">' + esc(valorP(bq.id)) + '</textarea></div>';
    if (bq.t === 'formulario') {
      var cuerpo;
      if (!st.pareja || st.miembros < 2) cuerpo = '<p class="aviso">Para escribir esto juntos, primero unan sus cuentas desde el inicio. Mientras tanto, pueden escribirlo en papel.</p>';
      else cuerpo = (bq.intro ? '<div class="texto">' + md(bq.intro) + '</div>' : '') + bq.campos.map(function (c) {
        return '<div class="ej"><label class="ej-l" for="f-' + c.id + '">' + inline(c.etiqueta) + '</label>' + (c.ayuda ? '<div class="ej-a">' + md(c.ayuda) + '</div>' : '') + '<textarea id="f-' + c.id + '" data-formulario="' + c.id + '" rows="3">' + esc(valorC(c.id)) + '</textarea></div>';
      }).join('') + '<p class="nota">Lo escriben entre los dos: lo que uno escribe le aparece al otro.</p>';
      return '<section class="form-pareja"><h3>' + inline(bq.titulo) + '</h3>' + cuerpo + '</section>';
    }
    return '';
  }
  function pantallaJornada(n) {
    var j = st.jor[n];
    var nav = '<nav class="nav-j">' + (n > 1 && abierta(n - 1) ? '<button class="btn sec" data-jornada="' + (n - 1) + '">← Anterior</button>' : '<span></span>') +
      (n < 20 && abierta(n + 1) ? '<button class="btn sec" data-jornada="' + (n + 1) + '">Siguiente →</button>' : '<span></span>') + '</nav>';
    pintar(marco('<article class="jornada modo-' + j.modo + '"><p class="sobre">Semana ' + j.semana + ' · ' + esc(j.dia) + ' · Día ' + n + ' de 20</p>' +
      '<h1>' + inline(j.titulo) + '</h1><p class="meta"><span class="chip">' + MODO[j.modo] + '</span> ' + inline(j.meta) + '</p>' +
      j.bloques.map(htmlBloque).join('') +
      '<div class="cierre"><p id="guardado" class="nota" aria-live="polite"></p><button class="btn ' + (hecha(n) ? 'sec' : '') + '" data-act="hecha" data-n="' + n + '">' + (hecha(n) ? '✓ Hecha · desmarcar' : 'Marcar como hecha') + '</button>' +
      '<button class="btn-txt" data-act="imprimir" data-que="jornada" data-n="' + n + '">Imprimir este día</button></div>' + nav + '</article>'));
  }

  /* ---------- inventario ---------- */
  function pantallaInventario(cual) {
    var inv = st.base.inventario, pre = cual + ':', prev = 'inicial:';
    var v = function (id) { var x = st.persona.inv[pre + id]; return x ? x.v : ''; };
    var grupos = [], ult = null;
    inv.escala.forEach(function (it) {
      if (it.grupo !== ult) { grupos.push('<h3>' + esc(it.grupo) + '</h3>'); ult = it.grupo; }
      var antes = cual === 'final' && st.persona.inv[prev + it.id] ? '<span class="antes">Al inicio: ' + esc(st.persona.inv[prev + it.id].v) + '</span>' : '';
      var radios = [1, 2, 3, 4, 5].map(function (k) { return '<label class="r"><input type="radio" name="' + it.id + '" value="' + k + '" data-inv="' + it.id + '"' + (String(v(it.id)) === String(k) ? ' checked' : '') + '><span>' + k + '</span></label>'; }).join('');
      grupos.push('<fieldset class="esc"><legend>' + esc(it.id.replace('inv-', '')) + '. ' + inline(it.etiqueta) + (it.nota ? ' <em class="nota">(' + esc(it.nota) + ')</em>' : '') + '</legend><div class="radios">' + radios + '</div>' + antes + '</fieldset>');
    });
    var abiertas = inv.abiertas.map(function (a) { return '<div class="ej"><label class="ej-l" for="i-' + a.id + '">' + inline(a.etiqueta) + '</label><textarea id="i-' + a.id + '" data-inv="' + a.id + '" rows="3">' + esc(v(a.id)) + '</textarea></div>'; }).join('');
    var pv = v(inv.privada.id);
    var privada = '<section class="privada"><h3>Una pregunta solo para ti</h3><p>' + inline(inv.privada.etiqueta) + '</p><div class="radios">' +
      ['No', 'Sí'].map(function (k) { return '<label class="r ancho"><input type="radio" name="privada" value="' + k + '" data-inv="' + inv.privada.id + '"' + (pv === k ? ' checked' : '') + '><span>' + k + '</span></label>'; }).join('') + '</div>' +
      '<div class="alerta" id="ayuda-privada"' + (pv === 'Sí' ? '' : ' hidden') + '>Gracias por responder con honestidad. Esto no lo ve nadie más. Te animamos a hablar a solas con el líder de tu grupo o con el líder principal de LHS; si hay violencia o peligro, busca ayuda de inmediato. Pedir ayuda es parte de prepararse bien.</div></section>';
    pintar(marco('<article class="jornada"><p class="sobre">Herramienta personal · 15 minutos</p><h1>Inventario ' + cual + '</h1><div class="texto">' + md(inv.intro) + '</div>' +
      grupos.join('') + '<h3>Tres preguntas abiertas</h3>' + abiertas + privada +
      '<div class="cierre"><p id="guardado" class="nota" aria-live="polite"></p><button class="btn" data-act="inv-listo" data-cual="' + cual + '">Listo</button></div></article>'));
  }

  /* ---------- imprimir ---------- */
  async function todasLasJornadas() { for (var n = 1; n <= 20; n++) if (!st.jor[n]) st.jor[n] = await P.jornada(n); }
  async function imprimir(que, n) {
    pantallaCargando('Preparando para imprimir…');
    var partes = [], titulo = '';
    if (que === 'jornada') {
      var j = st.jor[n]; titulo = 'Día ' + n + ' · ' + j.titulo;
      partes.push('<h1>' + inline(j.titulo) + '</h1><p class="sobre">Semana ' + j.semana + ' · ' + esc(j.dia) + '</p>' + j.bloques.map(function (bq) {
        if (bq.t === 'campo') return '<div class="ej"><p class="ej-l">' + inline(bq.etiqueta) + '</p><div class="resp">' + esc(valorP(bq.id) || ' ') + '</div></div>';
        if (bq.t === 'formulario') return '<section><h3>' + inline(bq.titulo) + '</h3>' + bq.campos.map(function (c) { return '<p class="ej-l">' + inline(c.etiqueta) + '</p><div class="resp">' + esc(valorC(c.id) || ' ') + '</div>'; }).join('') + '</section>';
        return htmlBloque(bq);
      }).join(''));
    } else if (que === 'mis') {
      await todasLasJornadas(); titulo = 'Mis respuestas';
      partes.push('<h1>Mis respuestas</h1><p class="sobre">Uniendo Caminos · ' + esc(st.u.nombre || '') + '</p><p class="nota">Por tu privacidad, aquí no se imprime la pregunta solo para ti del inventario.</p>');
      for (var k = 1; k <= 20; k++) {
        var jj = st.jor[k], campos = jj.bloques.filter(function (b) { return b.t === 'campo'; });
        if (!campos.length) continue;
        partes.push('<section><h2>Día ' + k + ' · ' + inline(jj.titulo) + '</h2>' + campos.map(function (c) { return '<p class="ej-l">' + inline(c.etiqueta) + '</p><div class="resp">' + esc(valorP(c.id) || ' ') + '</div>'; }).join('') + '</section>');
      }
    } else if (que === 'acuerdos') {
      await todasLasJornadas(); titulo = 'Nuestros acuerdos y Pacto';
      partes.push('<h1>Nuestros acuerdos y Pacto</h1><p class="sobre">Uniendo Caminos</p>');
      for (var m = 1; m <= 20; m++) st.jor[m].bloques.filter(function (b) { return b.t === 'formulario'; }).forEach(function (f) {
        partes.push('<section class="' + (f.id === 'pacto' ? 'pacto' : '') + '"><h2>' + inline(f.titulo) + '</h2>' + f.campos.map(function (c) { return '<p class="ej-l">' + inline(c.etiqueta) + '</p><div class="resp">' + esc(valorC(c.id) || ' ') + '</div>'; }).join('') +
          (f.id === 'pacto' ? '<p class="firmas">Firmas: ______________________ · ______________________ · Fecha: ____________</p><p class="firmas">Testigos: ______________________</p>' : '') + '</section>');
      });
    } else if (que === 'inv-blanco') {
      titulo = 'Inventario'; var inv = st.base.inventario, ult = null;
      partes.push('<h1>Inventario</h1><p class="sobre">Uniendo Caminos · Inicial ☐ · Final ☐</p>' + md(inv.intro));
      inv.escala.forEach(function (it) { if (it.grupo !== ult) { partes.push('<h3>' + esc(it.grupo) + '</h3>'); ult = it.grupo; } partes.push('<p class="linea-esc">' + esc(it.id.replace('inv-', '')) + '. ' + inline(it.etiqueta) + ' <span class="cajas">1 ☐ 2 ☐ 3 ☐ 4 ☐ 5 ☐</span></p>'); });
      partes.push('<h3>Tres preguntas abiertas</h3>' + inv.abiertas.map(function (a) { return '<p class="ej-l">' + inline(a.etiqueta) + '</p><div class="resp vacia"></div>'; }).join(''));
      partes.push('<h3>Una pregunta solo para ti (no la compartas)</h3><p>' + inline(inv.privada.etiqueta) + '</p><p>No ☐ · Sí ☐</p>');
    }
    document.title = titulo + ' · Uniendo Caminos';
    pintar('<div class="imprimible">' + partes.join('') + '</div><div class="no-imp centro-t"><button class="btn" data-act="imprimir-ya">Imprimir o guardar PDF</button> <button class="btn sec" data-ir="' + (que === 'jornada' ? 'jornada' : 'inicio') + '" data-n="' + (n || '') + '">Volver</button></div>');
    setTimeout(function () { window.print(); }, 400);
  }

  /* ---------- guardado ---------- */
  var esperas = {};
  function programar(clave, fn) {
    estadoGuardado('Guardando…');
    clearTimeout(esperas[clave]);
    esperas[clave] = setTimeout(async function () {
      st.guardando++;
      try { await fn(); estadoGuardado('Guardado y cifrado ✓'); }
      catch (e) { console.error(e); estadoGuardado('No se pudo guardar. Revisa tu conexión; lo intentaremos otra vez al seguir escribiendo.'); }
      finally { st.guardando--; }
    }, 700);
  }

  $app.addEventListener('input', function (e) {
    var t = e.target, ahora = Date.now();
    if (t.dataset.campo) { var id = t.dataset.campo, v = t.value; programar('c' + id, function () { return P.guardarPersona(function (p) { p.campos[id] = { v: v, t: ahora }; }).then(function (d) { st.persona = d; }); }); }
    if (t.dataset.formulario) { var fid = t.dataset.formulario, fv = t.value; programar('f' + fid, function () { return P.guardarPareja(function (c) { c.campos[fid] = { v: fv, t: ahora }; }).then(function (d) { st.pareja = d; }); }); }
    if (t.dataset.inv && t.tagName === 'TEXTAREA') guardarInv(t.dataset.inv, t.value);
  });
  $app.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.inv && t.type === 'radio') {
      guardarInv(t.dataset.inv, t.value);
      if (t.name === 'privada') { var a = document.getElementById('ayuda-privada'); if (a) a.hidden = t.value !== 'Sí'; }
    }
  });
  function guardarInv(id, v) {
    var cual = st.vista === 'inv-final' ? 'final' : 'inicial', clave = cual + ':' + id, ahora = Date.now();
    programar('i' + clave, function () { return P.guardarPersona(function (p) { p.inv[clave] = { v: v, t: ahora }; }).then(function (d) { st.persona = d; }); });
  }

  /* ---------- acciones ---------- */
  async function ir(vista, n) {
    try {
      if (vista === 'inicio') { st.vista = 'inicio'; document.title = 'Uniendo Caminos · The Way'; history.replaceState(null, '', location.pathname); pantallaInicio(); return; }
      if (vista === 'jornada') { n = Number(n); if (!abierta(n)) return; if (!st.jor[n]) { pantallaCargando(); st.jor[n] = await P.jornada(n); } st.vista = 'jornada'; st.n = n; pantallaJornada(n); history.replaceState(null, '', '#dia-' + n); }
    } catch (e) { console.error(e); st.aviso = 'No pudimos abrir ese día. Revisa tu conexión.'; pantallaInicio(); }
  }
  $app.addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.jornada) return ir('jornada', b.dataset.jornada);
    if (b.dataset.ir) return ir(b.dataset.ir, b.dataset.n || st.n);
    var act = b.dataset.act; if (!act) return;
    var err = document.getElementById('err');
    try {
      if (act === 'entrar') { await P.sesion().entrar(); st.u = await P.sesion().listo(); return seguir(); }
      if (act === 'continuar') return seguir();
      if (act === 'salir') { P.bloquear(); await P.sesion().salir(); return location.reload(); }
      if (act === 'bloquear') { P.bloquear(); st.persona = st.pareja = null; return pantallaPin(); }
      if (act === 'crear') {
        var p1 = document.getElementById('pin1').value, p2 = document.getElementById('pin2').value;
        if (!pinValido(p1)) { err.textContent = 'El PIN debe tener al menos 6 letras o números.'; return; }
        if (p1 !== p2) { err.textContent = 'Los dos PIN no coinciden.'; return; }
        b.disabled = true; pantallaCargando('Creando tu espacio cifrado…');
        st.persona = await P.crearPersona(p1, document.getElementById('inicio') ? document.getElementById('inicio').value : lunes()[0]);
        return despuesDeAbrir();
      }
      if (act === 'abrir') {
        var pin = document.getElementById('pin').value; if (!pin) return;
        b.disabled = true; b.textContent = 'Abriendo…';
        try { st.persona = await P.abrirPersona(pin); } catch (x) { if (x.code === 'pin-incorrecto') return pantallaPin('Ese PIN no abre tu espacio. Intenta otra vez.'); throw x; }
        return despuesDeAbrir();
      }
      if (act === 'reiniciar') {
        if (!confirm('Se borrará todo lo que escribiste en este curso. No se puede deshacer. ¿Continuar?')) return;
        await P.borrarPersona(); return pantallaCrear();
      }
      if (act === 'hecha') {
        var n = Number(b.dataset.n), ya = hecha(n);
        st.persona = await P.guardarPersona(function (p) { p.hechos[n] = { v: !ya, t: Date.now() }; });
        if (!ya && n < 20 && abierta(n + 1)) return ir('jornada', n + 1);
        return ya ? pantallaJornada(n) : ir('inicio');
      }
      if (act === 'inv') { st.vista = 'inv-' + b.dataset.cual; return pantallaInventario(b.dataset.cual); }
      if (act === 'inv-listo') { st.persona = await P.guardarPersona(function (p) { p.inv[b.dataset.cual + ':hecho'] = { v: true, t: Date.now() }; }); return ir('inicio'); }
      if (act === 'imprimir') return imprimir(b.dataset.que, Number(b.dataset.n || 0));
      if (act === 'imprimir-ya') return window.print();
      if (act === 'pareja-crear' || act === 'pareja-unir') { st.formPareja = act === 'pareja-crear' ? 'crear' : 'unir'; pantallaInicio(); var t = document.getElementById('tpareja'); if (t) { t.scrollIntoView({ block: 'center' }); var i0 = t.querySelector('input'); if (i0) i0.focus(); } return; }
      if (act === 'pareja-cancelar') { st.formPareja = null; return pantallaInicio(); }
      var errp = document.getElementById('errp');
      if (act === 'pareja-crear-ok') {
        var pc = document.getElementById('pp1').value, pc2 = document.getElementById('pp2').value;
        if (!pinValido(pc)) { errp.textContent = 'El PIN de pareja debe tener al menos 6 letras o números.'; return; }
        if (pc !== pc2) { errp.textContent = 'Los dos PIN no coinciden.'; return; }
        pantallaCargando('Creando su espacio de pareja…');
        await P.crearPareja(pc); st.persona = P.persona(); st.formPareja = null; await abrirParejaSegura(); return ir('inicio');
      }
      if (act === 'pareja-unir-ok') {
        var cod = document.getElementById('pcod').value, pu = document.getElementById('pp1').value;
        if (P.normalizarCodigo(cod).length !== 10) { errp.textContent = 'El código tiene 10 letras y números.'; return; }
        if (!pu) { errp.textContent = 'Escribe el PIN de pareja.'; return; }
        pantallaCargando('Uniendo sus cuentas…');
        st.formPareja = null;
        try { await P.unirPareja(cod, pu); } catch (x) {
          st.persona = P.persona();
          st.aviso = x.code === 'codigo-invalido' ? 'Ese código no tiene el formato correcto: son 10 letras y números.' : x.code === 'pin-incorrecto' ? 'Ya quedaron unidos, pero ese PIN de pareja no abre su espacio. Pídele el PIN otra vez a tu pareja.' : 'Ese código no sirve: revisa que esté bien escrito, o puede que ya lo estén usando dos personas.';
          await abrirParejaSegura(); return ir('inicio');
        }
        st.persona = P.persona(); await abrirParejaSegura(); st.aviso = ''; return ir('inicio');
      }
      if (act === 'pareja-pin-ok') {
        var np = document.getElementById('pp1').value; if (!np) return;
        try { await P.cambiarPinPareja(np); } catch (x) { if (x.code !== 'pin-incorrecto') throw x; }
        st.persona = P.persona(); await abrirParejaSegura();
        if (!st.pareja) { pantallaInicio(); var e2 = document.getElementById('errp'); if (e2) e2.textContent = 'Ese PIN no abre su espacio de pareja.'; return; }
        return ir('inicio');
      }
    } catch (x) {
      console.error(x);
      err = err || document.getElementById('errp');
      if (err) err.textContent = 'Algo no funcionó. Revisa tu conexión e intenta de nuevo.'; else { st.aviso = 'Algo no funcionó. Revisa tu conexión e intenta de nuevo.'; if (st.persona) pantallaInicio(); }
    }
  });
  $app.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'pin') { var b = $app.querySelector('[data-act="abrir"]'); if (b) b.click(); } });

  async function abrirParejaSegura() {
    st.pareja = null; st.miembros = 0;
    if (!st.persona.pareja) return;
    try { var r = await P.abrirPareja(); st.pareja = r.datos; st.miembros = r.miembros; }
    catch (e) { if (e.code !== 'pin-incorrecto') console.error(e); return; }
    P.escucharPareja(function (datos, miembros) {
      st.pareja = datos; var antes = st.miembros; st.miembros = miembros;
      var a = document.activeElement;
      if (st.vista === 'jornada' && !(a && a.dataset && a.dataset.formulario)) pantallaJornadaConservando();
      else if (st.vista === 'inicio' && antes !== miembros) pantallaInicio();
    });
  }
  function pantallaJornadaConservando() { var y = window.scrollY; pantallaJornada(st.n); window.scrollTo(0, y); }

  async function despuesDeAbrir() {
    pantallaCargando();
    if (!st.base) st.base = await P.base();
    await abrirParejaSegura();
    for (var n = 1; n <= 20; n++) if (abierta(n) && !st.jor[n]) st.jor[n] = await P.jornada(n);
    var m = location.hash.match(/^#dia-(\d+)$/);
    if (m && abierta(Number(m[1]))) return ir('jornada', m[1]);
    return ir('inicio');
  }
  async function arrancar() {
    pantallaCargando();
    try { st.u = await P.sesion().listo(); } catch (x) { console.error(x); st.u = null; }
    pantallaLanding();
  }
  async function seguir() {
    pantallaCargando();
    try {
      if (!st.u) return pantallaLanding();
      if (!(await P.tieneDerecho())) return pantallaSinAcceso();
      var e = await P.estadoPersona();
      return e === 'nuevo' ? pantallaCrear() : pantallaPin();
    } catch (x) {
      console.error(x);
      pintar('<div class="centro"><p>No pudimos abrir el curso. Revisa tu conexión.</p><button class="btn" onclick="location.reload()">Intentar de nuevo</button></div>');
    }
  }
  arrancar();
})();

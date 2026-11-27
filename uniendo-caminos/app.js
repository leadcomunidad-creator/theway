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
  /* ===== LANDING DEL CURSO (24-nov-2026) =====
     Misma arquitectura y nivel que el landing de Metanoia (vLandingV3): portada con «‹ Mi Mapa», cifras, introducción,
     las cuatro semanas, cómo lo vivirán, una semana típica, lo que se llevarán, acompañamiento, privacidad, para quién
     y botón según la cuenta (tarjeta fija en escritorio, botón fijo abajo en celular). Identidad propia aprobada por Juan:
     colores del libro y el dibujo de dos caminos que se unen. Nada de esto copia elementos de Metanoia. */
  var WA_INSCRIBIR = 'https://wa.me/573173708570?text=' + encodeURIComponent('Hola, queremos inscribirnos en el curso prematrimonial Uniendo Caminos de THE WAY.');
  var SEMS = [
    { n: 1, c: '#2AB3B1', t: 'El diseño', s: 'De la boda al pacto', p: 'Qué es el matrimonio según Dios, los mitos que traemos y las reglas que nunca hemos dicho. Dejar padre y madre sin dejar de honrarlos.', a: 'Acuerdo 1 · Expectativas y familias' },
    { n: 2, c: '#E0896A', t: 'Amar de verdad', s: 'Más allá del enamoramiento', p: 'El amor que se decide y se cultiva. Cómo da y recibe amor cada uno, amor y honra, respeto y admiración, y la sexualidad según el diseño de Dios.', a: 'Acuerdo 2 · El afecto y la intimidad' },
    { n: 3, c: '#3E8FB0', t: 'Hablar y pelear bien', s: 'La verdad dicha en amor', p: 'Escuchar de verdad, reconocer cómo nos defendemos, discutir sin herir y saber pedir perdón. Y las señales que piden ayuda.', a: 'Acuerdo 3 · Nuestro protocolo para el conflicto' },
    { n: 4, c: '#D9962E', t: 'Un hogar con propósito', s: 'Si el Señor no edifica la casa', p: 'Liderar sin imponer, el dinero sin secretos, hijos, casa y trabajo, y una vida espiritual compartida.', a: 'El Pacto de pareja' }
  ];
  var IC = {
    palabra: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/><path d="M7 8h2M15 8h2"/></svg>',
    libro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/></svg>',
    uno: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>',
    dos: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8.5" r="2.8"/><circle cx="15.5" cy="8.5" r="2.8"/><path d="M3 19.5a5.5 5.5 0 0 1 11 0M10 19.5a5.5 5.5 0 0 1 11 0"/></svg>',
    candado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
    mentor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
  };
  function botonCurso() {
    var u = st.u, nombre = u && u.nombre ? u.nombre.split(' ')[0] : '';
    if (!u) return { html: '<button class="btn lc-cta" data-act="entrar">Entrar con Google</button>', nota: 'Cada uno entra con su propia cuenta de Google.' };
    if (st.acceso === false) return { html: '<a class="btn lc-cta" href="../inscripcion/?curso=preparados">Inscribirnos</a>',nota: 'Tu cuenta (' + esc(u.correo || u.nombre) + ') aún no tiene este curso. <button class="btn-txt" data-act="salir">Usar otra cuenta</button>' };
    return { html: '<button class="btn lc-cta" data-act="continuar">' + (nombre ? 'Entrar al curso, ' + esc(nombre) : 'Entrar al curso') + '</button>', nota: 'Ya están inscritos. <button class="btn-txt" data-act="salir">Usar otra cuenta</button>' };
  }
  function bloqueRequisitos() {
    return '<h2 class="lc-h">Para quién es</h2>' +
      '<div class="lc-r ok"><span>' + IC.check + '</span><div><b>Parejas que se preparan para casarse</b><small>Comprometidos o pensando casarse en los próximos meses.</small></div></div>' +
      '<div class="lc-r ok"><span>' + IC.check + '</span><div><b>Se inscriben los dos</b><small>Cada uno entra con su cuenta; el precio es por pareja.</small></div></div>' +
      '<div class="lc-r ok"><span>' + IC.check + '</span><div><b>Sin requisitos previos</b><small>Habilidad es a la carta: no hace falta haber hecho otra ruta.</small></div></div>';
  }
  function pantallaLanding() {
    var B = botonCurso();
    var semanas = SEMS.map(function (s) {
      return '<article class="lc-wk" style="--c:' + s.c + '"><small>Semana ' + s.n + '</small><b>' + s.t + '</b><em>' + s.s + '</em><p>' + s.p + '</p><span class="lc-ac">' + IC.check + s.a + '</span></article>';
    }).join('');
    var puntos = SEMS.map(function (s) {
      return '<div style="--c:' + s.c + '"><span><i></i><i></i><i></i><i></i><i class="cita"></i></span><small>' + s.t + '</small></div>';
    }).join('');
    var dias = [['Lun', 'Enseñanza', 'La Palabra y la idea de la semana. 10 minutos.', 'palabra'], ['Mar', 'Cada uno', 'Lectura breve y un ejercicio personal.', 'uno'], ['Mié', 'Cada uno', 'Otra pregunta para pensar a solas.', 'uno'], ['Jue', 'Cada uno', 'Lo que traigo a la conversación.', 'uno'], ['Vie', 'Cita de pareja', 'Una conversación guiada y un acuerdo escrito.', 'dos']];
    var semanaTipo = dias.map(function (d, k) {
      return '<li class="' + (k === 4 ? 'cita' : k === 0 ? 'ens' : '') + '"><span class="lc-ti">' + IC[d[3]] + '</span><div><small>' + d[0] + '</small><b>' + d[1] + '</b><p>' + d[2] + '</p></div></li>';
    }).join('');
    var lateral = '<aside class="lc-side" aria-label="Entrar al curso"><small class="w">Habilidad · Relacionales · Parejas</small><b class="t">Uniendo Caminos</b><span class="lc-sub">Curso prematrimonial · 4 semanas</span><hr>' + bloqueRequisitos() + B.html + '<p class="lc-nota">' + B.nota + '</p><a class="btn sec lc-back" href="../mi-mapa/">Seguir explorando el mapa</a></aside>';
    pintar('<div class="lc">' +
      '<header class="lc-hero"><a class="lc-mm" href="../mi-mapa/" aria-label="Volver a Mi Mapa">‹ Mi Mapa</a>' +
      '<div class="lc-hero-in"><div class="lc-art">' + CAMINOS + '</div>' +
      '<div class="lc-tit"><p class="lc-eye">The Way · Habilidad · Relacionales</p><h1><span class="t1">Uniendo</span><span class="t2">Caminos</span></h1>' +
      '<p class="lc-tag">De la boda al pacto</p><p class="lc-vers">«…se unirá a su mujer, y serán una sola carne».<span>Génesis 2:24</span></p>' +
      '<div class="lc-hcta">' + B.html + '<p class="lc-nota">' + B.nota + '</p></div></div></div></header>' +
      '<div class="lc-g"><main class="lc-m">' +
      '<div class="lc-f"><div><b>4</b><span>semanas</span></div><div><b>20</b><span>días, de lunes a viernes</span></div><div><b>4</b><span>citas de pareja</span></div><div><b>1</b><span>Pacto firmado</span></div></div>' +
      '<div class="lc-intro"><p>Una boda se prepara durante meses. El matrimonio, casi nunca. Muchas parejas llegan al altar con todo listo para la fiesta y casi nada conversado sobre lo que empieza al día siguiente.</p>' +
      '<p><b>Uniendo Caminos</b> es un curso prematrimonial de cuatro semanas para conocerse de verdad, hablar lo que no han hablado y salir con acuerdos claros. Cada uno llega completo en Cristo; juntos aprenden a caminar como uno solo.</p></div>' +
      '<section class="lc-sec"><h2 class="lc-h">Cuatro semanas</h2><p class="lc-s">Cada semana termina con una cita y un acuerdo escrito. Al final, los acuerdos se vuelven su Pacto.</p><div class="lc-wks">' + semanas + '</div></section>' +
      '<section class="lc-sec"><h2 class="lc-h">Cómo lo vivirán</h2><div class="lc-how">' +
      '<div><span class="lc-i">' + IC.palabra + '</span><b>La Palabra</b><p>Cada lunes, una enseñanza bíblica breve abre la semana: el diseño de Dios para el matrimonio.</p></div>' +
      '<div><span class="lc-i">' + IC.libro + '</span><b>El libro</b><p><i>Asegure el éxito en su matrimonio antes de casarse</i>, de Les y Leslie Parrott. Lo leen en su resumen del BookClub, o completo si lo prefieren.</p></div>' +
      '<div><span class="lc-i">' + IC.dos + '</span><b>La cita</b><p>Los viernes se sientan juntos, guiados paso a paso, y escriben un acuerdo. Es el corazón del curso.</p></div></div></section>' +
      '<section class="lc-sec"><h2 class="lc-h">Una semana típica</h2><p class="lc-s">Unos 20 minutos al día, de lunes a jueves; la cita del viernes, entre 45 y 60.</p><ol class="lc-semana">' + semanaTipo + '</ol>' +
      '<div class="lc-dots" aria-hidden="true">' + puntos + '</div><p class="lc-s lc-c">Cada punto es un día. El último de cada semana es la cita de los dos.</p></section>' +
      '<section class="lc-sec"><h2 class="lc-h">Lo que se llevarán</h2><div class="lc-pacto"><div class="doc" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><em></em><em></em></div>' +
      '<div><b>Su Pacto de pareja</b><p>Una página escrita entre los dos: por qué se casan, sus familias, el afecto, el conflicto, el dinero, los hijos, la casa, el trabajo y su fe. Lo firman, lo imprimen y lo revisan durante el primer año.</p></div></div></section>' +
      '<section class="lc-sec lc-duo"><div class="lc-card"><span class="lc-i">' + IC.mentor + '</span><b>Acompañados</b><p>Un matrimonio mentor, su líder de grupo si está casado, los acompaña en tres encuentros: al inicio, a mitad del camino y al cierre.</p></div>' +
      '<div class="lc-card"><span class="lc-i">' + IC.candado + '</span><b>Solo para ustedes</b><p>Lo que escriben se cifra en su celular con su PIN. Ni su mentor ni LHS pueden leerlo: solo cada uno y, en los acuerdos, los dos.</p></div></section>' +
      '<section class="lc-sec lc-rq">' + bloqueRequisitos() + '</section>' +
      '</main>' + lateral + '</div>' +
      '<div class="lc-bot">' + B.html + '<p class="lc-nota">' + B.nota + '</p></div></div>');
    var svg = document.querySelector('.caminos');
    if (svg && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && svg.setCurrentTime) { svg.pauseAnimations(); svg.setCurrentTime(10); }
    /* aparición suave de las secciones al bajar */
    if ('IntersectionObserver' in window && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('.lc-sec,.lc-f,.lc-intro').forEach(function (el) { el.classList.add('rev'); io.observe(el); });
    }
  }
  /* ===== INTERIOR DEL CURSO (25-nov-2026) =====
     Aprobado por Juan sobre la propuesta con imágenes. Identidad propia, sin copiar Metanoia: el hilo es el dibujo
     aprobado (dos caminos que se unen). Tú = turquesa; tu pareja = dorado; la cita = el aro; el Pacto = la línea única.
     Pantallas: Hoy · la jornada por pasos · el modo cita (viernes) · Sus caminos · El Pacto · Más (pareja, inventario,
     imprimir, PIN). Lo de siempre (PIN, cifrado, unión de pareja, formularios, inventario, impresión) no cambia.
     Novedad de datos (sin tocar reglas): cada uno copia sus días hechos, cifrados, al espacio de pareja ('_av:<uid>'),
     y el paso al que llegó en cada día va en sus campos cifrados ('_paso:<n>'). */
  var BOOK = 'https://bookclublhscol.netlify.app/libros/asegure-el-exito-en-su-matrimonio-antes-de-casarse-json.html';
  var I2 = {
    sol: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    camino: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21c0-6 3-7 6-9M18 21c0-6-3-7-6-9M12 12V3"/></svg>',
    cita: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/></svg>',
    pacto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>',
    aj: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>',
    uno: IC.uno, dos: IC.dos, libro: IC.libro, palabra: IC.palabra, candado: IC.candado, corazon: IC.mentor,
    reloj: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 3h6"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/></svg>',
    flecha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    orar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M9 6h6"/><path d="M5 21c0-6 3-9 7-9s7 3 7 9"/></svg>'
  };
  var MODO2 = { ensenanza: ['Enseñanza', 'palabra'], individual: ['Cada uno', 'uno'], pareja: ['Los dos', 'dos'] };
  var DSC = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MSC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fechaCorta(s) { var d = deISO(s); return DSC[d.getDay()] + ' ' + d.getDate() + ' ' + MSC[d.getMonth()]; }
  function diasEntre(a, b) { return Math.round((deISO(b) - deISO(a)) / 86400000); }
  function semDe(n) { return Math.ceil(n / 5); }
  function esCita(n) { return n % 5 === 0; }
  function wc(w) { return 'var(--w' + w + ')'; }
  function primerNombre(u) { return u && u.nombre ? u.nombre.split(' ')[0] : ''; }
  function inicial(t) { return esc((t || '?').charAt(0).toUpperCase()); }
  function misHechos() { var o = []; for (var n = 1; n <= 20; n++) if (hecha(n)) o.push(n); return o; }
  function hoyCal() { var h = hoyISO(), r = 0; for (var n = 1; n <= 20; n++) if (fechaDe(n) <= h) r = n; return r; }
  function titDia(n) { var j = st.base.indice[n - 1]; return j ? j.titulo : ''; }
  function titCorto(n) { return titDia(n).replace(/^Cita \d · /, ''); }
  function citaDe(n) { return semDe(n) * 5; }
  function pasoVisto(n) { var c = st.persona.campos['_paso:' + n]; return c ? Number(c.v) || 0 : 0; }
  /* la pareja: sus días hechos y su nombre, tal como los compartió (cifrados) en el espacio de los dos */
  function otro() {
    if (!st.pareja || st.miembros < 2) return null;
    var c = st.pareja.campos || {}, yo = '_av:' + (st.u && st.u.uid);
    for (var k in c) if (k.indexOf('_av:') === 0 && k !== yo && c[k] && c[k].v) return { nombre: c[k].v.nombre || 'Tu pareja', hechos: c[k].v.hechos || [] };
    return { nombre: 'Tu pareja', hechos: [], sinDatos: true };
  }
  function compartirAvance() {
    if (!st.pareja || !st.u) return;
    var v = { nombre: primerNombre(st.u), hechos: misHechos() }, k = '_av:' + st.u.uid, c = st.pareja.campos[k];
    if (c && JSON.stringify(c.v) === JSON.stringify(v)) return;
    P.guardarPareja(function (x) { x.campos[k] = { v: v, t: Date.now() }; }).then(function (d) { st.pareja = d; }).catch(function (e) { console.error(e); });
  }
  function acuerdoEscrito(pref) { var c = st.pareja && st.pareja.campos; if (!c) return false; for (var k in c) if (k.indexOf(pref + '-') === 0 && c[k] && String(c[k].v || '').trim()) return true; return false; }
  var ACU = [{ p: 'acuerdo1', n: 5, t: 'Expectativas y familias' }, { p: 'acuerdo2', n: 10, t: 'El afecto y la intimidad' }, { p: 'acuerdo3', n: 15, t: 'Nuestro protocolo para el conflicto' }, { p: 'pacto', n: 20, t: 'Nuestro hogar con propósito' }];
  function toast(t) {
    var v = document.querySelector('.toast'); if (v) v.remove();
    var d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.innerHTML = '<i>✓</i><span>' + esc(t) + '</span>';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3800);
  }
  function congelarDibujo() { var svg = document.querySelector('.caminos'); if (svg && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && svg.setCurrentTime) { svg.pauseAnimations(); svg.setCurrentTime(10); } }

  /* ---------- los pasos de un día: se arman del contenido aprobado, sin cambiar su texto ---------- */
  function secciones(t) {
    var out = [], cur = null;
    String(t || '').split(/\n\s*\n/).forEach(function (p) {
      var l = p.replace(/^\n+|\s+$/g, ''); if (!l.trim()) return;
      var h = l.match(/^\*\*([^*]+?)\*\*/) || l.match(/^###\s+(.*)/);
      if (h || !cur) { cur = { t: 'sec', h: h ? h[1].trim() : '', md: l }; out.push(cur); } else cur.md += '\n\n' + l;
    });
    return out;
  }
  function minDe(h) { var m = String(h || '').match(/\((\d+)\s*min/); return m ? Number(m[1]) : 0; }
  function limpia(h) { return String(h || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^\d+\.\s*/, '').replace(/[.:]\s*$/, '').replace(/\s+/g, ' ').trim(); }
  function pasosDe(j) {
    if (j._pasos) return j._pasos;
    var items = [], L = [], cur = null;
    j.bloques.forEach(function (b) { if (b.t === 'md') secciones(b.md).forEach(function (s) { items.push(s); }); else items.push(b); });
    function nuevo(t, ex) { cur = { t: t, min: 0, items: [] }; if (ex) for (var k in ex) cur[k] = ex[k]; L.push(cur); return cur; }
    if (esCita(j.n)) {
      var escribir = null, despues = false;
      items.forEach(function (it) {
        if (it.t === 'formulario') { (escribir || cur || nuevo('Escribir')).items.push(it); despues = true; return; }
        if (despues) { if (!cur.despues) nuevo('Para el fin de semana', { despues: true }); cur.items.push(it); return; }
        if (it.h && /^\d+\.\s/.test(it.h)) {
          nuevo(limpia(it.h), { min: minDe(it.h) }); if (/^Escribir/i.test(cur.t)) escribir = cur;
          var resto = it.md.replace(/^\*\*[^*]+?\*\*\s*/, ''); if (resto.trim()) cur.items.push({ t: 'sec', h: '', md: resto }); return;
        }
        if (!cur) nuevo('Antes de empezar', { prep: true }); cur.items.push(it);
      });
    } else if (j.modo === 'ensenanza') {
      items.forEach(function (it) {
        var h = it.h || '';
        if (/^(Esta semana|Lo que vamos a hacer)/i.test(h)) nuevo('Esta semana'); else if (/^Una oración/i.test(h)) nuevo('Para orar'); else if (!cur) nuevo('La enseñanza');
        cur.items.push(it);
      });
    } else {
      var iC = -1, iL = -1, iE = -1;
      items.forEach(function (it, i) { if (it.t === 'campo') { if (iC < 0) iC = i; iL = i; } });
      for (var k = iC - 1; k >= 0; k--) if (items[k].t === 'sec' && items[k].h) { iE = k; break; }
      items.forEach(function (it, i) {
        if (i === 0) nuevo(j.modo === 'pareja' ? 'La práctica' : 'Leer');
        if (i === iE && iE > 0) {
          var t0 = limpia(it.h), sub = /^Tu ejercicio:/i.test(t0) ? t0.replace(/^Tu ejercicio:\s*/i, '') : '';
          nuevo(/^Tu ejercicio/i.test(t0) ? 'Tu ejercicio' : t0 || 'Tu ejercicio', { min: minDe(it.h), sub: sub });
          var resto = it.md.replace(/^\*\*[^*]+?\*\*\s*/, '');
          if (resto.trim()) cur.items.push({ t: 'sec', h: '', md: resto });
          return;
        }
        if (iL >= 0 && i === iL + 1) nuevo('Para cerrar');
        cur.items.push(it);
      });
    }
    L.forEach(function (p) { if (!p.min) for (var q = 0; q < p.items.length; q++) { var m = minDe(p.items[q].h); if (m) { p.min = m; break; } } });
    j._pasos = L; return L;
  }
  function htmlItems(items) {
    var h = '', campos = false;
    items.forEach(function (it) {
      if (it.t === 'sec') h += '<div class="lee">' + md(it.md) + '</div>';
      else { if (it.t === 'campo') campos = true; h += htmlBloque(it); }
    });
    if (campos) h += '<p class="cif">' + I2.candado + '<span id="guardado" aria-live="polite">Lo que escribas se guarda cifrado con tu PIN.</span></p>';
    return h;
  }
  function iconoPaso(t) { return /leer/i.test(t) ? 'libro' : /ejercicio|notar|escribir/i.test(t) ? 'lapiz' : /orar|cerrar|empezar/i.test(t) ? 'corazon' : /enseñanza/i.test(t) ? 'palabra' : /semana/i.test(t) ? 'camino' : 'lapiz'; }

  /* ---------- marco: barra, navegación y columnas ---------- */
  function barra(act, op) {
    op = op || {};
    var sig = st.base && st.persona ? siguiente() : 1, w = semDe(sig), o = st.persona ? otro() : null;
    var tabs = [['inicio', 'Hoy', 'sol'], ['camino', 'Sus caminos', 'camino'], ['cita', 'La cita', 'cita'], ['pacto', 'El Pacto', 'pacto']];
    var sub = op.sub || (st.base ? 'Semana ' + w + ' · ' + SEMS[w - 1].t : 'Curso prematrimonial');
    return '<header class="ub">' + (op.volver ? '<button class="ub-mm" data-ir="inicio">‹ Salir de la cita</button>' : '<a class="ub-mm" href="../mi-mapa/">‹ Mi Mapa</a>') +
      '<div class="ub-t"><b>Uniendo Caminos</b><small>' + esc(sub) + '</small></div>' +
      (op.sinMenu ? '' : '<nav class="ub-tabs" aria-label="Secciones del curso">' + tabs.map(function (t) { return '<button data-ir="' + t[0] + '"' + (t[0] === act ? ' aria-current="page"' : '') + '>' + I2[t[2]] + t[1] + '</button>'; }).join('') + '</nav>') +
      (op.sinMenu || !st.persona ? '' : '<div class="duo only-dd" title="' + (o ? 'Unidos' : 'Aún sin unir') + '"><span class="av yo">' + inicial(primerNombre(st.u)) + '</span><span class="lk"></span><span class="av el"' + (o ? '' : ' style="opacity:.35"') + '>' + (o ? inicial(o.nombre) : '?') + '</span><span class="nm only-d"><b>' + esc(primerNombre(st.u)) + (o ? ' y ' + esc(o.nombre) : '') + '</b>' + (o ? 'Unidos' : 'Falta tu pareja') + '</span></div>') +
      (op.sinMenu ? '' : '<button class="ib" data-ir="mas" aria-label="Más: pareja, inventario, imprimir y PIN">' + I2.aj + '</button>') + '</header>';
  }
  function navInf(act) {
    var t = [['inicio', 'Hoy', 'sol'], ['camino', 'Caminos', 'camino'], ['cita', 'Cita', 'cita'], ['pacto', 'Pacto', 'pacto']];
    return '<nav class="nav" aria-label="Secciones del curso">' + t.map(function (x) { return '<button data-ir="' + x[0] + '"' + (x[0] === act ? ' aria-current="page"' : '') + '>' + I2[x[2]] + x[1] + '</button>'; }).join('') + '</nav>';
  }
  function shell(act, main, rail, op) {
    op = op || {};
    return '<div class="uc' + (op.cm ? ' cm' : '') + '">' + barra(act, op) + '<main class="pg">' + (st.aviso && !op.cm ? '<p class="aviso" role="status">' + esc(st.aviso) + '</p>' : '') +
      (rail ? '<div class="cols"><div>' + main + '</div><aside class="rail only-d">' + rail + '</aside></div>' : main) + '</main>' +
      (op.sinNav ? '' : navInf(act)) + (op.extra || '') + '</div>';
  }
  /* las pantallas de PIN, bienvenida e inventario usan el mismo marco, sin menú */
  function marco(contenido, opciones) {
    opciones = opciones || {};
    return '<div class="uc">' + barra('', { sinMenu: opciones.sinMenu, sub: opciones.sub }) + '<main class="pg" style="max-width:760px">' + contenido + '</main>' + (opciones.sinMenu ? '' : navInf('')) + '</div>';
  }

  /* ---------- carriles de la semana: dos líneas que se encuentran en el aro de la cita ---------- */
  function carril(A, B, hoyIdx, citaHecha, fecha, nA, nB) {
    var X = [52, 110, 168, 226], yA = 26, yB = 104, M = [304, 65], dias = ['Lun', 'Mar', 'Mié', 'Jue'];
    function ruta(y) { return 'M30 ' + y + ' L226 ' + y + ' C 268 ' + y + ', 272 ' + M[1] + ', ' + (M[0] - 16) + ' ' + M[1]; }
    function ult(H) { var u = 0; for (var i = 0; i < 4; i++) if (H && H[i]) u = i + 1; return u; }
    function tramo(y, H) { var k = ult(H); if (!k) return ''; return 'M30 ' + y + ' L' + X[k - 1] + ' ' + y + (k === 4 && citaHecha ? ' C 268 ' + y + ', 272 ' + M[1] + ', ' + (M[0] - 16) + ' ' + M[1] : ''); }
    function dot(x, y, ok, cur, col) {
      if (ok) return '<circle cx="' + x + '" cy="' + y + '" r="7.5" fill="' + col + '"/><path d="M' + (x - 3.4) + ' ' + (y + 0.2) + 'l2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      if (cur) return '<circle cx="' + x + '" cy="' + y + '" r="12" fill="' + col + '" opacity=".16"/><circle cx="' + x + '" cy="' + y + '" r="7.5" fill="var(--card)" stroke="' + col + '" stroke-width="3"/>';
      return '<circle cx="' + x + '" cy="' + y + '" r="6.5" fill="var(--card)" stroke="#B9C7C7" stroke-width="1.6" stroke-dasharray="2.6 2.4"/>';
    }
    var gB = B ? 'var(--g)' : '#C9D6D6';
    return '<svg class="carril" viewBox="0 0 340 130" role="img" aria-label="Su semana: ' + esc(nA) + ' ' + ult(A) + ' de 4 días' + (B ? ', ' + esc(nB) + ' ' + ult(B) + ' de 4' : '') + '; el viernes, la cita">' +
      '<defs><linearGradient id="u1" x1="0" x2="1"><stop offset="0" stop-color="#2AB3B1"/><stop offset="1" stop-color="#D9962E"/></linearGradient></defs>' +
      dias.map(function (d, i) { return '<text class="lbl" x="' + X[i] + '" y="' + (M[1] + 4) + '" text-anchor="middle">' + d + '</text>'; }).join('') +
      '<path d="' + ruta(yA) + '" fill="none" stroke="#C9D6D6" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/>' +
      '<path d="' + ruta(yB) + '" fill="none" stroke="#C9D6D6" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/>' +
      '<path d="' + tramo(yA, A) + '" fill="none" stroke="var(--tl)" stroke-width="4" stroke-linecap="round"/>' +
      (B ? '<path d="' + tramo(yB, B) + '" fill="none" stroke="var(--g)" stroke-width="4" stroke-linecap="round"/>' : '') +
      '<path d="M' + (M[0] + 16) + ' ' + M[1] + ' L 340 ' + M[1] + '" stroke="url(#u1)" stroke-width="4" stroke-linecap="round" opacity="' + (citaHecha ? 1 : 0.35) + '"/>' +
      '<circle cx="14" cy="' + yA + '" r="12" fill="var(--tl)"/><text x="14" y="' + (yA + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="DM Sans,sans-serif">' + inicial(nA) + '</text>' +
      '<circle cx="14" cy="' + yB + '" r="12" fill="' + gB + '"/><text x="14" y="' + (yB + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="DM Sans,sans-serif">' + (B ? inicial(nB) : '?') + '</text>' +
      X.map(function (x, i) { return dot(x, yA, A[i], i === hoyIdx && !A[i], 'var(--tl)') + (B ? dot(x, yB, B[i], i === hoyIdx && !B[i], 'var(--g)') : dot(x, yB, false, false, '')); }).join('') +
      '<circle cx="' + M[0] + '" cy="' + M[1] + '" r="17" fill="' + (citaHecha ? 'var(--g)' : 'var(--card)') + '" stroke="var(--g)" stroke-width="3.5"/>' +
      '<circle cx="' + M[0] + '" cy="' + M[1] + '" r="9" fill="none" stroke="' + (citaHecha ? '#fff' : 'var(--tl)') + '" stroke-width="2.5"/>' +
      '<text class="lblc" x="' + M[0] + '" y="' + (M[1] + 34) + '" text-anchor="middle">CITA · ' + esc(fecha.toUpperCase()) + '</text></svg>';
  }
  function semanaCard(w) {
    var o = otro(), A = [], B = o ? [] : null, b0 = (w - 1) * 5, hc = hoyCal(), hoyIdx = hc > b0 && hc < b0 + 5 ? hc - b0 - 1 : -1;
    for (var i = 1; i <= 4; i++) { A.push(hecha(b0 + i)); if (B) B.push(o.hechos.indexOf(b0 + i) >= 0); }
    var cA = A.filter(Boolean).length, cB = B ? B.filter(Boolean).length : 0, nom = primerNombre(st.u) || 'Tú';
    var yaHoy = o && hc > 0 && hc <= 20 && semDe(hc) === w && o.hechos.indexOf(hc) >= 0;
    var citaH = hecha(w * 5) && (!o || o.hechos.indexOf(w * 5) >= 0);
    return '<div class="card sem"><div class="sem-h"><b>Su semana ' + w + '</b><small>' + fechaCorta(fechaDe(b0 + 1)) + ' – ' + fechaCorta(fechaDe(w * 5)) + '</small></div>' +
      carril(A, B, hoyIdx, citaH, fechaCorta(fechaDe(w * 5)).replace(/ \S+$/, ''), nom, o ? o.nombre : '') +
      '<div class="ley"><span><i class="a"></i>' + esc(nom) + ' (tú) · ' + cA + ' de 4</span>' +
      (o ? '<span><i class="b"></i>' + esc(o.nombre) + ' · ' + cB + ' de 4' + (yaHoy ? ' · ya hizo el de hoy' : '') + '</span>' : '<span><i class="b" style="background:#C9D6D6"></i>Cuando se unan, aquí verán a su pareja</span>') + '</div></div>';
  }
  function proxCita(sig) {
    var w = semDe(sig), c = w * 5; if (hecha(c) && w < 4) c += 5; if (hecha(c)) return '';
    var d = diasEntre(hoyISO(), fechaDe(c)), num = d <= 0 ? 'Hoy' : d === 1 ? '1' : String(d), lab = d <= 0 ? '' : d === 1 ? 'día' : 'días';
    return '<button class="prox" data-ir="cita" data-n="' + c + '" style="width:100%;text-align:left;border:0"><div class="ring"><div><b>' + num + '</b><small>' + lab + '</small></div></div><div class="tx"><small>' + (d <= 0 ? 'Su cita es hoy' : 'Próxima cita · ' + fechaCorta(fechaDe(c))) + '</small><b>' + esc(titDia(c)) + '</b><p>Los dos juntos · ' + (d <= 0 ? 'guiados paso a paso' : 'pasos guiados con reloj') + '</p></div><span class="go">' + I2.flecha + '</span></button>';
  }
  function miniPacto() {
    var k = 0, lis = ACU.map(function (a, i) { var ok = acuerdoEscrito(a.p); if (ok) k++; return '<li' + (ok ? ' class="on"' : '') + '><i></i>' + (i < 3 ? 'Acuerdo ' + (i + 1) : 'El Pacto') + ' · ' + (ok ? esc(a.t) : fechaCorta(fechaDe(a.n))) + '</li>'; }).join('');
    var rayas = ''; for (var r = 0; r < 7; r++) rayas += '<i' + (r < k * 2 ? ' class="on"' : '') + (r === 0 ? ' style="width:70%"' : '') + '></i>';
    return '<button class="card mp" data-ir="pacto" style="width:100%;text-align:left"><div class="hoja" aria-hidden="true">' + rayas + '</div><div><b>Su Pacto se va escribiendo</b><ul>' + lis + '</ul></div></button>';
  }
  function privCard() { return '<div class="card privc">' + I2.candado + '<div><b>Solo para ustedes.</b> Lo de cada uno se cifra con su PIN; los acuerdos, con el PIN de pareja. Ni su mentor ni LHS pueden leerlo.</div></div>'; }
  function semanaDias(w) {
    var h = '';
    for (var k = 1; k <= 5; k++) {
      var n = (w - 1) * 5 + k, ab = abierta(n), he = hecha(n), cur = ab && !he && n === siguiente(), jj = st.base.indice[n - 1];
      h += '<button class="sdd ' + (he ? 'ok' : cur ? 'cur' : esCita(n) ? 'vc' : '') + '" ' + (esCita(n) ? 'data-ir="cita" data-n="' + n + '"' : 'data-jornada="' + n + '"') + (ab ? '' : ' disabled') + '><small>' + ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][k - 1] + ' ' + deISO(fechaDe(n)).getDate() + '</small><b>' + esc(titDia(n)) + '</b><span>' + (he ? '✓ Hecho' : cur ? 'Hoy' : ab ? 'Abierto' : MODO2[jj.modo][0]) + '</span></button>';
    }
    return '<div class="sd">' + h + '</div>';
  }

  /* ---------- HOY ---------- */
  function heroDia(n) {
    var j = st.jor[n], jj = st.base.indice[n - 1], w = semDe(n), L = j ? pasosDe(j) : [], hechos = Math.min(pasoVisto(n), L.length), he = hecha(n);
    if (he) hechos = L.length;
    var f = fechaDe(n), fl = f === hoyISO() ? 'Hoy · ' + fechaLarga(f) : f < hoyISO() ? 'Se abrió el ' + fechaLarga(f) : fechaLarga(f);
    var mins = (j && j.meta.match(/(\d+(?: a \d+)?) minutos/)) || null;
    var cta = esCita(n) ? '<button class="btn gold w" data-ir="cita" data-n="' + n + '">' + (hechos ? 'Seguir con la cita' : 'Empezar la cita') + '</button>'
      : '<button class="btn w" data-jornada="' + n + '">' + (he ? 'Volver a leerlo' : hechos ? 'Seguir donde quedé' : 'Comenzar') + '</button>';
    var tiles = L.filter(function (p) { return !p.prep && !p.despues; }).slice(0, 6).map(function (p) {
      var i = L.indexOf(p), ok = i < hechos, cu = i === hechos && !he;
      return '<button class="paso ' + (ok ? 'ok' : cu ? 'cur' : '') + '" ' + (esCita(n) ? 'data-ir="cita" data-n="' + n + '"' : 'data-jornada="' + n + '"') + ' data-paso="' + i + '"><small>' + (ok ? '✓ Hecho' : cu ? 'AHORA' : String(i + 1).padStart(2, '0')) + '</small><b>' + esc(p.t) + '</b></button>';
    }).join('');
    return '<section class="hoy"><div class="sol" aria-hidden="true"></div>' +
      '<div class="hoy-top"><span class="chipw" style="--c:' + wc(w) + '"><i></i>Semana ' + w + ' · ' + SEMS[w - 1].t + '</span><span class="pill">Día ' + n + ' de 20</span></div>' +
      '<h1>' + inline(titDia(n)) + '</h1><div class="eye" style="position:relative">' + esc(fl) + '</div>' +
      '<div class="meta"><span class="modo' + (jj.modo === 'pareja' ? ' par' : '') + '">' + I2[MODO2[jj.modo][1]] + MODO2[jj.modo][0] + '</span>' + (mins ? '<span class="modo">' + I2.reloj + mins[1] + ' minutos</span>' : '') + '</div>' +
      '<div class="hoy-pr" style="--p:' + (L.length ? Math.round(100 * hechos / L.length) : 0) + '%"><span class="bar"><i></i></span><small>' + hechos + ' de ' + L.length + ' pasos</small></div>' + cta +
      (tiles ? '<div class="pasos">' + tiles + '</div>' : '') + '</section>';
  }
  function pantallaInicio() {
    var sig = siguiente(), w = semDe(sig), o = otro(), arriba = '', hero;
    if (!st.persona.pareja || !st.pareja || st.miembros < 2 || st.formPareja) arriba = tarjetaPareja();
    if (!abierta(1)) {
      var d = diasEntre(hoyISO(), st.persona.inicio);
      hero = '<section class="hoy"><div class="sol" aria-hidden="true"></div><div class="hoy-top"><span class="chipw" style="--c:var(--w1)"><i></i>Antes de empezar</span><span class="pill">' + (d === 1 ? 'Falta 1 día' : 'Faltan ' + d + ' días') + '</span></div>' +
        '<h1>Empiezan el ' + esc(fechaLarga(st.persona.inicio)) + '</h1><p style="position:relative;margin:0 0 14px;color:var(--mu)">Cada día del curso se abre en su fecha, de lunes a viernes. Mientras tanto, dejen todo listo:</p>' +
        '<div class="pasos"><button class="paso ' + (st.persona.inv['inicial:hecho'] ? 'ok' : 'cur') + '" data-act="inv" data-cual="inicial"><small>' + (st.persona.inv['inicial:hecho'] ? '✓ Hecho' : '01') + '</small><b>Mi inventario</b></button>' +
        '<button class="paso ' + (o ? 'ok' : '') + '" data-ir="mas"><small>' + (o ? '✓ Hecho' : '02') + '</small><b>Unir cuentas</b></button><a class="paso" href="' + BOOK + '" target="_blank" rel="noopener"><small>03</small><b>Ver el libro</b></a></div></section>';
    } else if (misHechos().length === 20) {
      hero = '<section class="hoy fin"><div class="sol" aria-hidden="true"></div><div class="hoy-top"><span class="chipw" style="--c:var(--g)"><i></i>Camino recorrido</span><span class="pill">20 de 20</span></div><h1>Terminaron el camino</h1><p style="position:relative;margin:0 0 16px">Prepararon algo más grande que una boda: un pacto. Guárdenlo en un lugar visible y revísenlo una noche al mes durante el primer año.</p><button class="btn gold w" data-ir="pacto">Ver nuestro Pacto</button></section>';
    } else if (hecha(sig)) {
      var prox = sig < 20 ? sig + 1 : 20;
      hero = '<section class="hoy"><div class="sol" aria-hidden="true"></div><div class="hoy-top"><span class="chipw" style="--c:' + wc(w) + '"><i></i>Estás al día</span><span class="pill">' + misHechos().length + ' de 20</span></div><h1>Hoy ya caminaste tu parte</h1>' +
        '<p style="position:relative;margin:0 0 14px;color:var(--mu)">El Día ' + prox + ', «' + esc(titCorto(prox)) + '», se abre el ' + esc(fechaLarga(fechaDe(prox))) + '.</p><button class="btn sec w" data-jornada="' + sig + '">Volver a leer el Día ' + sig + '</button></section>';
    } else hero = heroDia(sig);
    var atras = []; for (var n = sig + 1; n <= 20; n++) if (abierta(n) && !hecha(n)) atras.push(n);
    var ponerse = atras.length ? '<div class="card ponerse"><div class="eye">Para ponerte al día</div><p class="nota" style="margin:4px 0 0">Ya están abiertos. Puedes hacerlos en orden cuando termines el Día ' + sig + '.</p>' + atras.map(filaDia).join('') + '</div>' : '';
    var mov = '<div class="only-m" style="display:grid;gap:14px;margin-top:16px">' + ponerse + semanaCard(w) + proxCita(sig) + miniPacto() + '</div>';
    var esc_ = '<div class="only-d"><h2 class="h-s">Semana ' + w + ' · ' + SEMS[w - 1].t + '</h2>' + semanaDias(w) + (ponerse ? '<div style="margin-top:16px">' + ponerse + '</div>' : '') + '</div>';
    st.vista = 'inicio';
    pintar(shell('inicio', arriba + hero + mov + esc_, semanaCard(w) + proxCita(sig) + miniPacto() + privCard()));
  }

  /* ---------- LA JORNADA POR PASOS ---------- */
  function pantallaJornada(n) {
    var j = st.jor[n], L = pasosDe(j), i = Math.max(0, Math.min(st.paso || 0, L.length - 1)), p = L[i], w = semDe(n), visto = hecha(n) ? L.length : pasoVisto(n), ult = i === L.length - 1;
    var mins = j.meta.match(/(\d+(?: a \d+)?) minutos/);
    var tren = '<div class="tren">' + L.map(function (x, k) { return '<button class="e ' + (k < visto && k !== i ? 'ok' : k === i ? 'cur' : '') + '" data-jornada="' + n + '" data-paso="' + k + '" aria-label="Paso ' + (k + 1) + ': ' + esc(x.t) + '"' + (k === i ? ' aria-current="step"' : '') + '><i>' + (k < visto && k !== i ? '✓' : k + 1) + '</i><span>' + esc(x.t) + '</span></button>'; }).join('') + '</div>';
    var head = '<section class="jh" style="--c:' + wc(w) + '"><button class="back" data-ir="inicio">‹ Hoy</button><span class="eye">Semana ' + w + ' · ' + esc(fechaLarga(fechaDe(n))) + ' · Día ' + n + ' de 20</span><h1>' + inline(j.titulo) + '</h1>' +
      '<div class="meta"><span class="modo">' + I2[MODO2[j.modo][1]] + MODO2[j.modo][0] + '</span>' + (mins ? '<span class="modo">' + I2.reloj + mins[1] + ' minutos</span>' : '') + '</div>' + (L.length > 1 ? tren : '') + '</section>';
    var puente = /leer/i.test(p.t) && /BookClub/i.test(p.items.map(function (x) { return x.md || ''; }).join(' ')) ? '<div class="puente">' + I2.libro + '<div><b>Resumen en BookClub</b>Asegure el éxito en su matrimonio antes de casarse</div><a class="btn sm" href="' + BOOK + '" target="_blank" rel="noopener">Abrir</a></div>' : '';
    var sigTxt = ult ? (hecha(n) ? 'Volver a Hoy' : 'Terminar el día') : 'Listo · siguiente paso';
    var sigAct = ult ? (hecha(n) ? 'data-ir="inicio"' : 'data-act="terminar-dia" data-n="' + n + '"') : 'data-act="paso-sig" data-n="' + n + '" data-i="' + i + '"';
    var antAct = i > 0 ? 'data-jornada="' + n + '" data-paso="' + (i - 1) + '"' : 'data-ir="inicio"';
    var escena = '<section class="card esc"><div class="k"><i>' + I2[iconoPaso(p.t)] + '</i><div><small>Paso ' + (i + 1) + ' de ' + L.length + (p.min ? ' · ' + p.min + ' min' : '') + '</small><b>' + esc(p.t) + '</b>' + (p.sub ? '<em class="sub">' + esc(p.sub.charAt(0).toUpperCase() + p.sub.slice(1)) + '</em>' : '') + '</div></div>' + puente + htmlItems(p.items) +
      (ult ? '<div class="fin-dia"><button class="btn-txt" data-act="imprimir" data-que="jornada" data-n="' + n + '">Imprimir este día</button>' + (hecha(n) ? '<button class="btn-txt" data-act="hecha" data-n="' + n + '">Desmarcar este día</button>' : '') + '</div>' : '') +
      '<div class="jfoot"><button class="btn sec sm" ' + antAct + '>' + (i > 0 ? '‹ Paso anterior' : '‹ Volver a Hoy') + '</button><button class="btn" ' + sigAct + '>' + sigTxt + '</button></div></section>';
    var rail = '<div class="card rpasos"><h4>Los pasos de hoy <small>' + Math.min(visto, L.length) + ' de ' + L.length + '</small></h4>' + L.map(function (x, k) { return '<button class="rp ' + (k < visto ? 'ok' : '') + (k === i ? ' cur' : '') + '" data-jornada="' + n + '" data-paso="' + k + '"><i>' + (k < visto ? '✓' : k + 1) + '</i>' + esc(x.t) + (x.min ? '<small>' + x.min + ' min</small>' : '') + '</button>'; }).join('') + '</div>' + semanaCard(w) + privCard();
    var jbar = '<div class="jbar"><button class="btn sec" ' + antAct + '>‹ ' + (i > 0 ? 'Anterior' : 'Hoy') + '</button><button class="btn" ' + sigAct + '>' + sigTxt + '</button></div>';
    pintar(shell('inicio', head + escena, rail, { sinNav: true, extra: jbar }));
  }

  /* ---------- EL MODO CITA ---------- */
  var reloj = { clave: '', total: 0, resta: 0, fin: 0, corre: false, h: null };
  function fmt(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function relojTick() {
    if (reloj.corre) { reloj.resta = Math.max(0, reloj.fin - Date.now()); if (!reloj.resta) reloj.corre = false; }
    var t = document.getElementById('rl-t'), c = document.getElementById('rl-c'), s = document.getElementById('rl-s'), b = document.getElementById('rl-b');
    if (!t) return;
    var L = 2 * Math.PI * 96, f = reloj.total ? reloj.resta / reloj.total : 0;
    t.textContent = fmt(reloj.resta); c.setAttribute('stroke-dasharray', (L * f) + ' ' + L);
    s.textContent = !reloj.resta ? 'Tiempo cumplido · sigan cuando estén listos' : reloj.corre ? 'de ' + Math.round(reloj.total / 60000) + ' minutos' : 'En pausa · toquen para seguir';
    if (b) b.innerHTML = (reloj.corre ? I2.pausa + 'Pausa' : I2.play + (reloj.resta ? 'Seguir' : 'Otra vez'));
  }
  function relojPara(n, i, min) {
    var k = n + ':' + i;
    if (reloj.clave !== k) { reloj.clave = k; reloj.total = min * 60000; reloj.resta = reloj.total; reloj.corre = true; reloj.fin = Date.now() + reloj.resta; }
    if (!reloj.h) reloj.h = setInterval(function () { if (st.vista === 'cita') relojTick(); }, 1000);
  }
  function citaActual() { var sig = siguiente(), c = citaDe(sig); if (hecha(c) && c < 20 && abierta(c + 5)) c += 5; return c; }
  function pantallaCita(n) {
    var w = semDe(n), sub = titDia(n).replace(/^Cita \d · /, ''), j = st.jor[n], f = fechaDe(n);
    var cab = '<div class="ctop"><span class="eye">Cita ' + w + ' · ' + esc(fechaLarga(f)) + '</span><h1>' + inline(sub) + '</h1>';
    var regla = '<div class="regla">' + I2.corazon + '<div><b>La regla de la cita:</b> el que escucha no se defiende; primero repite lo que entendió.</div></div>';
    st.vista = 'cita';
    if (!abierta(n) || !j) {
      var dd = diasEntre(hoyISO(), f);
      var lista0 = '';
      if (j) {
        var L0 = pasosDe(j).filter(function (x) { return !x.prep && !x.despues; }), tot = 0; L0.forEach(function (x) { tot += x.min || 0; });
        lista0 = '<h2 class="h-s" style="color:var(--gl);margin:26px 2px 0">Así será su cita · unos ' + tot + ' minutos</h2><div class="cpasos">' + L0.map(function (x) { return '<div><span>' + esc(x.t) + '</span><small>' + (x.min ? x.min + ' min' : '') + '</small></div>'; }).join('') + '</div>';
      }
      var prev = '<div class="chead centro-c">' + cab + '</div></div><div class="prep"><div class="cerrada"><b>Se abre el ' + esc(fechaLarga(f)) + '</b><br>' + (dd === 1 ? 'Falta 1 día.' : 'Faltan ' + dd + ' días.') + ' Ese día los guiaremos paso a paso, con un reloj para cada parte.</div>' + lista0 +
        regla + '<div class="regla">' + I2.libro + '<div><b>Para llegar listos:</b> cada uno trae lo que escribió de lunes a jueves. Busquen un lugar tranquilo y dejen los celulares a un lado.</div></div>' +
        '<p style="margin:22px 0 0"><button class="btn w" data-ir="inicio">Volver a Hoy</button></p></div>';
      pintar(shell('cita', prev, '', { cm: true, sub: 'Modo cita · Semana ' + w }));
      return;
    }
    var L = pasosDe(j), i = Math.max(0, Math.min(st.paso || 0, L.length - 1)), p = L[i], ult = i === L.length - 1;
    var segs = '<div class="segs" aria-hidden="true">' + L.map(function (x, k) { return '<i class="' + (k < i ? 'ok' : k === i ? 'cur' : '') + '" style="--m:' + (x.min || 2) + ';--p:' + (k === i ? 50 : 0) + '%"></i>'; }).join('') + '</div>';
    var R = 96, LL = 2 * Math.PI * R, conReloj = !!p.min;
    if (conReloj) relojPara(n, i, p.min);
    var circulo = conReloj ? '<div class="reloj"><svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="' + R + '" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="10"/><circle id="rl-c" cx="110" cy="110" r="' + R + '" fill="none" stroke="#E8B25A" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + LL + ' ' + LL + '"/></svg><div class="in"><small>Paso ' + (i + 1) + ' de ' + L.length + '</small><b id="rl-t">' + fmt(reloj.resta) + '</b><span id="rl-s"></span></div><button data-act="reloj" aria-label="Pausar o seguir el reloj"></button></div>'
      : '<div class="icono-paso">' + I2[p.prep ? 'dos' : p.despues ? 'camino' : 'lapiz'] + '</div><p class="paso-n">Paso ' + (i + 1) + ' de ' + L.length + '</p>';
    var sigB = ult ? (hecha(n) ? '<button class="btn" data-ir="pacto">Ver nuestro Pacto ›</button>' : '<button class="btn" data-act="terminar-cita" data-n="' + n + '">Terminar la cita ✓</button>') : '<button class="btn" data-act="cita-sig" data-n="' + n + '" data-i="' + i + '">Siguiente paso ›</button>';
    var izqB = conReloj ? '<button class="pausa" id="rl-b" data-act="reloj">' + I2.pausa + 'Pausa</button>' : '<button class="pausa" ' + (i > 0 ? 'data-ir="cita" data-n="' + n + '" data-paso="' + (i - 1) + '"' : 'data-ir="inicio"') + '>‹ ' + (i > 0 ? 'Anterior' : 'Hoy') + '</button>';
    var lista = p.prep ? '<div class="cpasos">' + L.filter(function (x) { return !x.prep && !x.despues; }).map(function (x) { return '<div><span>' + esc(x.t) + '</span><small>' + (x.min ? x.min + ' min' : '') + '</small></div>'; }).join('') + '</div>' : '';
    var paso = '<div class="cpaso"><h2>' + esc(p.t) + '</h2>' + htmlItems(p.items) + lista + (p.despues ? '' : regla) + '<div class="cbar">' + izqB + sigB + '</div>' +
      (i > 0 && conReloj ? '<p style="text-align:center;margin:12px 0 0"><button class="btn-txt" data-ir="cita" data-n="' + n + '" data-paso="' + (i - 1) + '">‹ Paso anterior</button></p>' : '') + '</div>';
    var tension = '<div class="regla only-d" style="margin-top:20px">' + I2.reloj + '<div><b>Si se pone tensa:</b> pausen. Digan «necesito un momento», tomen 20 minutos y vuelvan. Si no logran volver con calma, anoten el tema como pendiente para su mentor.</div></div>';
    pintar(shell('cita', '<div class="chead">' + cab + segs + '</div></div><div class="cgrid"><div class="cizq">' + circulo + tension + '</div>' + paso + '</div>', '', { cm: true, sinNav: true, volver: true, sub: 'Modo cita · Semana ' + w }));
    if (conReloj) relojTick();
  }

  /* ---------- SUS CAMINOS: las 4 semanas, cada una más cerca, hasta el Pacto ---------- */
  function partir(t) { var o = ['']; t.split(' ').forEach(function (x) { var u = o.length - 1; if ((o[u] + ' ' + x).trim().length > 13 && o[u]) o.push(x); else o[u] = (o[u] + ' ' + x).trim(); }); return o; }
  function trenza(nA, nB, hayB) {
    var C = 180, S = [0, 118, 86, 56, 28], H = 196, top = 96, base = top + 4 * H + 30, lab = '', pA = [], pB = [], dots = '', hc = hoyCal();
    for (var w = 1; w <= 4; w++) {
      var yb = base - (w - 1) * H, yt = yb - H, s = S[w], ini = w === 1 ? [[C - 150, yb + 24], [C + 150, yb + 24]] : [[C, yb], [C, yb]];
      var ruta = function (sg, i0) { return 'M' + i0[0] + ' ' + i0[1] + ' C ' + (C + sg * s) + ' ' + (yb - 4) + ', ' + (C + sg * s) + ' ' + (yb - 14) + ', ' + (C + sg * s) + ' ' + (yb - 34) + ' L ' + (C + sg * s) + ' ' + (yb - 150) + ' C ' + (C + sg * s) + ' ' + (yb - 176) + ', ' + C + ' ' + (yt + 12) + ', ' + C + ' ' + yt; };
      pA.push([ruta(-1, ini[0]), w]); pB.push([ruta(1, ini[1]), w]);
      for (var k = 0; k < 4; k++) { var y = yb - 46 - k * 34, n = (w - 1) * 5 + k + 1; dots += '<g data-n="' + n + '" data-who="A" data-x="' + (C - s) + '" data-y="' + y + '"></g><g data-n="' + n + '" data-who="B" data-x="' + (C + s) + '" data-y="' + y + '"></g>'; }
      var nc = w * 5, hechaC = nA.indexOf(nc) >= 0 && (!hayB || nB.indexOf(nc) >= 0);
      dots += '<circle cx="' + C + '" cy="' + yt + '" r="15" fill="' + (hechaC ? 'var(--g)' : 'var(--card)') + '" stroke="var(--g)" stroke-width="3.5"/><circle cx="' + C + '" cy="' + yt + '" r="8" fill="none" stroke="' + (hechaC ? '#fff' : 'var(--tl)') + '" stroke-width="2.5"/>';
      var dentro = s > 70, lx = dentro ? C : C + s + 18, ly = yb - 108, an = dentro ? 'middle' : 'start';
      lab += '<text class="wl" x="' + lx + '" y="' + ly + '" text-anchor="' + an + '" fill="' + wc(w) + '">Semana ' + w + '</text><text class="wt" x="' + lx + '" y="' + (ly + 19) + '" text-anchor="' + an + '">' + (dentro ? [SEMS[w - 1].t] : partir(SEMS[w - 1].t)).map(function (t, q) { return '<tspan x="' + lx + '" dy="' + (q ? 18 : 0) + '">' + esc(t) + '</tspan>'; }).join('') + '</text>';
      lab += '<text class="dl" x="' + (C + 22) + '" y="' + (yt - 16) + '">Cita ' + w + ' · ' + fechaCorta(fechaDe(nc)) + '</text>';
    }
    var yp = base - 4 * H, todo = nA.indexOf(20) >= 0;
    var gris = function (d) { return '<path d="' + d + '" fill="none" stroke="#C9D6D6" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/>'; };
    return '<svg viewBox="0 0 360 ' + (base + 40) + '" role="img" aria-label="Sus caminos: cada semana se acercan más, hasta el Pacto">' +
      '<defs><radialGradient id="luzT" cx="50%" cy="100%" r="62%"><stop offset="0" stop-color="#FFE3A6" stop-opacity=".95"/><stop offset=".6" stop-color="#F6C46A" stop-opacity=".25"/><stop offset="1" stop-color="#F6C46A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="unoT" gradientUnits="userSpaceOnUse" x1="0" y1="' + yp + '" x2="0" y2="' + (yp - 70) + '"><stop offset="0" stop-color="#2AB3B1"/><stop offset="1" stop-color="#E2A23B"/></linearGradient></defs>' +
      '<path d="M' + (C - 110) + ' ' + (yp - 70) + ' A110 64 0 0 1 ' + (C + 110) + ' ' + (yp - 70) + ' Z" fill="url(#luzT)"/><path d="M' + (C - 26) + ' ' + (yp - 70) + ' A26 26 0 0 1 ' + (C + 26) + ' ' + (yp - 70) + ' Z" fill="#F6C46A"/><line x1="40" x2="320" y1="' + (yp - 70) + '" y2="' + (yp - 70) + '" stroke="#E4D8BE"/>' +
      '<path d="M' + C + ' ' + yp + ' L ' + C + ' ' + (yp - 70) + '" stroke="' + (todo ? 'url(#unoT)' : '#C9D6D6') + '" stroke-width="' + (todo ? 6 : 2.5) + '" stroke-linecap="round"' + (todo ? '' : ' stroke-dasharray="1 6"') + '/>' +
      '<text x="' + C + '" y="' + (yp - 86) + '" text-anchor="middle" class="wl" fill="var(--g)">El Pacto · ' + esc(fechaLarga(fechaDe(20))) + '</text>' +
      pA.map(function (x) { return gris(x[0]); }).join('') + pB.map(function (x) { return gris(x[0]); }).join('') +
      pA.map(function (x) { return '<path class="hecho" data-who="A" data-w="' + x[1] + '" d="' + x[0] + '" fill="none" stroke="var(--tl)" stroke-width="5" stroke-linecap="round"/>'; }).join('') +
      (hayB ? pB.map(function (x) { return '<path class="hecho" data-who="B" data-w="' + x[1] + '" d="' + x[0] + '" fill="none" stroke="var(--g)" stroke-width="5" stroke-linecap="round"/>'; }).join('') : '') +
      lab + dots +
      '<circle cx="' + (C - 150) + '" cy="' + (base + 24) + '" r="14" fill="var(--tl)"/><text x="' + (C - 150) + '" y="' + (base + 28.5) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="DM Sans,sans-serif">' + inicial(primerNombre(st.u)) + '</text>' +
      '<circle cx="' + (C + 150) + '" cy="' + (base + 24) + '" r="14" fill="' + (hayB ? 'var(--g)' : '#C9D6D6') + '"/><text x="' + (C + 150) + '" y="' + (base + 28.5) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="DM Sans,sans-serif">' + (hayB ? inicial(otro().nombre) : '?') + '</text>' +
      '<text data-hc="' + hc + '" style="display:none"></text></svg>';
  }
  function pintarTrenza(el, hA, hB) {
    el.querySelectorAll('path.hecho').forEach(function (p) {
      var who = p.dataset.who, w = Number(p.dataset.w), H = who === 'A' ? hA : hB, Lt = p.getTotalLength(), hasta = -1;
      for (var n = (w - 1) * 5 + 1; n <= w * 5; n++) if (H.indexOf(n) >= 0) hasta = n;
      if (hasta < 0) { p.style.display = 'none'; return; }
      var len = Lt;
      if (hasta < w * 5) { var g = el.querySelector('g[data-n="' + hasta + '"][data-who="' + who + '"]'), ty = Number(g.dataset.y), lo = 0, hi = Lt; for (var i = 0; i < 30; i++) { var m = (lo + hi) / 2; if (p.getPointAtLength(m).y > ty) lo = m; else hi = m; } len = hi; }
      p.setAttribute('stroke-dasharray', len + ' ' + Lt);
    });
    var hc = hoyCal(), hayB = !!otro();
    el.querySelectorAll('g[data-n]').forEach(function (g) {
      var n = Number(g.dataset.n), who = g.dataset.who, H = who === 'A' ? hA : hB, ok = H.indexOf(n) >= 0, x = g.dataset.x, y = g.dataset.y, c = who === 'A' ? 'var(--tl)' : 'var(--g)';
      if (who === 'B' && !hayB) ok = false;
      g.innerHTML = ok ? '<circle cx="' + x + '" cy="' + y + '" r="7" fill="' + c + '"/>' : (n === hc && (who === 'A' || hayB)) ? '<circle cx="' + x + '" cy="' + y + '" r="12" fill="' + c + '" opacity=".16"/><circle cx="' + x + '" cy="' + y + '" r="7" fill="var(--card)" stroke="' + c + '" stroke-width="3"/>' : '<circle cx="' + x + '" cy="' + y + '" r="5.5" fill="var(--card)" stroke="#B9C7C7" stroke-width="1.5" stroke-dasharray="2.4 2.2"/>';
    });
  }
  function filaDia(n) {
    var ab = abierta(n), he = hecha(n), o = otro(), suyo = o && o.hechos.indexOf(n) >= 0, cur = ab && !he && n === siguiente();
    return '<button class="dr ' + (he ? 'ok' : cur ? 'cur' : '') + (esCita(n) ? ' vc' : '') + '" ' + (esCita(n) ? 'data-ir="cita" data-n="' + n + '"' : 'data-jornada="' + n + '"') + (ab || esCita(n) ? '' : ' disabled') + '><span class="n">' + n + '</span><span><b>' + esc(titDia(n)) + '</b><small>' + esc(fechaCorta(fechaDe(n))) + ' · ' + MODO2[st.base.indice[n - 1].modo][0] + '</small></span>' +
      '<span class="e">' + (he ? '✓ Hecho' : cur ? 'Hoy' : ab ? 'Abierto' : 'Se abre ' + fechaCorta(fechaDe(n))) + (suyo ? '<i style="background:var(--g)" title="' + esc(o.nombre) + ' ya lo hizo"></i>' : '') + '</span></button>';
  }
  function pantallaCamino() {
    var o = otro(), hA = misHechos(), hB = o ? o.hechos : [], k = 0; ACU.forEach(function (a) { if (acuerdoEscrito(a.p)) k++; });
    var lista = [1, 2, 3, 4].map(function (w) { var h = 0, d = ''; for (var n = (w - 1) * 5 + 1; n <= w * 5; n++) { if (hecha(n)) h++; d += filaDia(n); } return '<div class="dl-sem"><span class="chipw" style="--c:' + wc(w) + '"><i></i>Semana ' + w + ' · ' + SEMS[w - 1].t + '</span><small>' + h + ' de 5</small></div><div class="dl">' + d + '</div>'; }).join('');
    var main = '<div class="cam-h"><span class="eye">Sus caminos</span><h1>' + (o ? 'Se van uniendo' : 'Tu camino') + '</h1><p>Cada uno camina su parte de lunes a jueves. Los viernes se encuentran en la cita. Semana a semana, sus caminos se acercan hasta volverse uno en el Pacto.</p></div>' +
      '<div class="cifras"><div><b>' + hA.length + '</b><span>de 20 · ' + esc(primerNombre(st.u) || 'tú') + '</span></div><div><b class="g">' + (o ? hB.length : '–') + '</b><span>' + (o ? 'de 20 · ' + esc(o.nombre) : 'falta tu pareja') + '</span></div><div><b>' + k + '</b><span>de 4 · acuerdos</span></div></div>' +
      '<div class="trenza" id="tz">' + trenza(hA, hB, !!o) + '</div><h2 class="h-s">Los 20 días</h2>' + lista;
    st.vista = 'camino';
    pintar(shell('camino', main, semanaCard(semDe(siguiente())) + proxCita(siguiente()) + miniPacto()));
    var tz = document.getElementById('tz'); if (tz) pintarTrenza(tz, hA, hB);
    var g = tz && tz.querySelector('g[data-n="' + Math.max(1, Math.min(20, hoyCal())) + '"][data-who="A"] circle');
    if (g && hoyCal() > 1) { var r = g.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - window.innerHeight * 0.45)); }
  }

  /* ---------- EL PACTO ---------- */
  function pantallaPacto() {
    var o = otro(), yo = primerNombre(st.u) || '______________', el = o && !o.sinDatos ? o.nombre : '______________';
    var secs = ACU.map(function (a, i) {
      var j = st.jor[a.n], f = j && j.bloques.filter(function (b) { return b.t === 'formulario'; })[0], escrito = acuerdoEscrito(a.p), ab = abierta(a.n);
      var cuerpo;
      if (escrito && f) cuerpo = f.campos.map(function (c) { var v = valorC(c.id); return v ? '<p><em>' + inline(c.etiqueta.replace(/\*\*/g, '')) + '</em>' + esc(v).replace(/\n/g, '<br>') + '</p>' : ''; }).join('') + '<button class="btn-txt" data-ir="cita" data-n="' + a.n + '" data-paso="escribir">Editar juntos</button>';
      else if (ab) cuerpo = '<div class="vacio">Ya pueden escribirlo juntos. <button class="btn-txt" data-ir="cita" data-n="' + a.n + '" data-paso="escribir">Escribirlo ahora</button></div>';
      else cuerpo = '<div class="vacio">' + (i < 3 ? 'Lo escriben juntos en la Cita ' + (i + 1) + ', el ' + esc(fechaLarga(fechaDe(a.n))) + '.' : 'En la Cita 4, el ' + esc(fechaLarga(fechaDe(20))) + ', copian lo esencial de los tres acuerdos y escriben su Pacto: dinero, hijos, casa, trabajo, fe y su primer año.') + '</div>';
      return '<div class="pa' + (escrito ? '' : ' pend') + '"><span class="n">' + (i + 1) + '</span><h3>' + esc(a.t) + '</h3><div class="de">' + (i < 3 ? 'Acuerdo ' + (i + 1) : 'El Pacto completo') + ' · Cita ' + (i + 1) + ', ' + esc(fechaCorta(fechaDe(a.n))) + '</div>' + cuerpo + '</div>';
    }).join('');
    var aviso = !o ? '<p class="aviso">Los acuerdos se escriben entre los dos. Primero unan sus cuentas desde <button class="btn-txt" data-ir="mas">Más</button>; mientras tanto, pueden escribirlos en papel.</p>' : '';
    var main = aviso + '<article class="pacto"><span class="eye">Uniendo Caminos · Nuestro</span><h1>Pacto</h1><p class="nos">Nosotros, <b>' + esc(yo) + '</b> y <b>' + esc(el) + '</b>, delante de Dios y como preparación para nuestro matrimonio, acordamos:</p><p class="vers">«…y serán una sola carne» · Génesis 2:24</p><hr>' + secs +
      '<div class="firmas"><div>' + esc(yo) + '</div><div>' + esc(el) + '</div></div><div class="pacto-acc"><button class="btn sec sm" data-act="imprimir" data-que="acuerdos">Imprimir o guardar PDF</button></div></article>';
    st.vista = 'pacto';
    pintar(shell('pacto', main));
  }

  /* ---------- MÁS: pareja, inventario, imprimir y PIN ---------- */
  function pantallaMas() {
    var invI = st.persona.inv['inicial:hecho'], invF = st.persona.inv['final:hecho'];
    var inv = '<section class="tarjeta"><h3>Inventario</h3><p>Una herramienta personal de 15 minutos. Se responde al inicio y otra vez al final, para ver qué cambió. Nadie más ve tus respuestas.</p><div class="fila">' +
      '<button class="btn ' + (invI ? 'sec' : '') + '" data-act="inv" data-cual="inicial">' + (invI ? 'Ver mi inventario inicial' : 'Llenar el inventario inicial') + '</button>' +
      (abierta(20) ? '<button class="btn ' + (invF ? 'sec' : '') + '" data-act="inv" data-cual="final">' + (invF ? 'Ver mi inventario final' : 'Llenar el inventario final') + '</button>' : '<span class="nota">El final se abre el día 20.</span>') + '</div></section>';
    var imp = '<section class="tarjeta"><h3>Imprimir</h3><p class="nota">Todo se puede imprimir o guardar como PDF.</p><div class="fila"><button class="btn sec" data-act="imprimir" data-que="mis">Mis respuestas</button><button class="btn sec" data-act="imprimir" data-que="acuerdos">Nuestros acuerdos y Pacto</button><button class="btn sec" data-act="imprimir" data-que="inv-blanco">Inventario en blanco</button></div></section>';
    var priv = '<section class="tarjeta"><h3>Privacidad</h3><p>Lo que escribes se cifra en tu aparato con tu PIN. Los acuerdos, con el PIN de pareja. Ni su mentor ni LHS pueden leerlo.</p><div class="fila"><button class="btn sec" data-act="bloquear">Bloquear con mi PIN</button><button class="btn-txt" data-act="salir">Cerrar sesión</button></div></section>';
    var libro = '<section class="tarjeta"><h3>El libro</h3><p><i>Asegure el éxito en su matrimonio antes de casarse</i>, de Les y Leslie Parrott. Léanlo en su resumen del BookClub, o completo si lo prefieren.</p><div class="fila"><a class="btn sec" href="' + BOOK + '" target="_blank" rel="noopener">Abrir el resumen</a></div></section>';
    st.vista = 'mas';
    pintar(shell('', '<div class="cam-h" style="margin-bottom:16px"><span class="eye">Más</span><h1>Su espacio</h1></div><div class="mas"><div>' + tarjetaPareja() + inv + '</div><div>' + imp + libro + priv + '</div></div>'));
  }

  function pantallaSinAcceso() {
    pintar(marco('<section class="tarjeta estrecha"><div class="pin-art">' + CAMINOS + '</div><h2>Tu cuenta todavía no tiene acceso</h2><p>Entraste como <strong>' + esc(st.u.correo || st.u.nombre) + '</strong>. Si ya hicieron la inscripción, escríbele a tu líder para que active el curso para esta cuenta.</p><div class="fila"><a class="btn" href="../inscripcion/?curso=preparados">Inscribirnos</a><button class="btn sec" data-act="salir">Entrar con otra cuenta</button></div></section>', { sinMenu: true }));
    congelarDibujo();
  }
  function pantallaCrear() {
    var L = lunes(), porDefecto = L[0] === hoyISO() ? 0 : 1;
    var opciones = L.map(function (l, i) { return '<option value="' + l + '"' + (i === porDefecto ? ' selected' : '') + '>' + fechaLarga(l) + (l < hoyISO() ? ' (ya empezó esta semana)' : '') + '</option>'; }).join('');
    pintar(marco('<section class="tarjeta estrecha"><div class="pin-art">' + CAMINOS + '</div><h2>Bienvenidos a Uniendo Caminos</h2>' +
      '<p>Antes de empezar, crea tu <strong>PIN personal</strong>. Con él se cifra todo lo que escribas: ni tu pareja, ni tu mentor, ni LHS pueden leerlo.</p>' +
      '<label class="campo-l">Tu PIN (mínimo 6 letras o números)<input type="password" id="pin1" autocomplete="new-password" inputmode="text" maxlength="40"></label>' +
      '<label class="campo-l">Escríbelo otra vez<input type="password" id="pin2" autocomplete="new-password" maxlength="40"></label>' +
      '<div class="alerta"><strong>Importante:</strong> si olvidas tu PIN, lo que escribiste no se puede recuperar. Nadie puede abrirlo, ni siquiera nosotros. Anótalo en un lugar seguro.</div>' +
      '<label class="campo-l">¿Qué lunes empiezan?<select id="inicio">' + opciones + '</select></label>' +
      '<p class="nota">Cada día del curso se abre en su fecha, de lunes a viernes. Pónganse de acuerdo para empezar el mismo lunes.</p>' +
      '<p class="error" id="err"></p><button class="btn w" data-act="crear">Crear mi PIN y empezar</button></section>', { sinMenu: true }));
    congelarDibujo();
  }
  function pantallaPin(msg) {
    pintar(marco('<section class="tarjeta estrecha"><div class="pin-art">' + CAMINOS + '</div><h2>Hola' + (st.u.nombre ? ', ' + esc(st.u.nombre.split(' ')[0]) : '') + '</h2><p>Escribe tu PIN para abrir lo tuyo.</p>' +
      '<label class="campo-l">PIN<input type="password" id="pin" autocomplete="current-password" maxlength="40"></label>' +
      '<p class="error" id="err">' + esc(msg || '') + '</p><button class="btn w" data-act="abrir">Abrir</button>' +
      '<details class="olvido"><summary>Olvidé mi PIN</summary><p>Lo que escribiste está cifrado con tu PIN y no se puede recuperar. Si no lo recuerdas, puedes empezar de nuevo: se borra lo que escribiste (lo de pareja no se borra).</p><button class="btn peligro" data-act="reiniciar">Borrar lo mío y empezar de nuevo</button></details>' +
      '<p style="text-align:center"><button class="btn-txt" data-act="salir">Entrar con otra cuenta</button></p></section>', { sinMenu: true }));
    congelarDibujo();
    setTimeout(function () { var e = document.getElementById('pin'); if (e) e.focus(); }, 50);
  }

  /* ---------- pareja (igual que antes; ahora vive en Hoy y en Más) ---------- */
  function siguiente() { for (var n = 1; n <= 20; n++) if (abierta(n) && !hecha(n)) return n; for (var m = 20; m >= 1; m--) if (abierta(m)) return m; return 1; }
  function tarjetaPareja() {
    var p = st.persona.pareja, f = st.formPareja;
    var pinCampos = '<label class="campo-l">PIN de pareja (mínimo 6 letras o números)<input type="password" id="pp1" autocomplete="off" maxlength="40"></label>';
    if (!p && f === 'crear') return '<section class="tarjeta pareja" id="tpareja"><h3>Crear el código de pareja</h3><p>Inventa un <strong>PIN de pareja</strong>. Se lo vas a decir a tu pareja en persona o en una llamada; con él se cifra lo que escriban juntos.</p>' + pinCampos +
      '<label class="campo-l">Escríbelo otra vez<input type="password" id="pp2" autocomplete="off" maxlength="40"></label><p class="error" id="errp"></p><div class="fila"><button class="btn" data-act="pareja-crear-ok">Crear</button><button class="btn-txt" data-act="pareja-cancelar">Cancelar</button></div></section>';
    if (!p && f === 'unir') return '<section class="tarjeta pareja" id="tpareja"><h3>Unirme a mi pareja</h3><p>Escribe el código y el PIN de pareja que te dio tu pareja.</p>' +
      '<label class="campo-l">Código (10 letras y números)<input type="text" id="pcod" autocomplete="off" autocapitalize="characters" maxlength="14" placeholder="XXXXX-XXXXX"></label>' + pinCampos +
      '<p class="error" id="errp"></p><div class="fila"><button class="btn" data-act="pareja-unir-ok">Unirme</button><button class="btn-txt" data-act="pareja-cancelar">Cancelar</button></div></section>';
    if (!p) return '<section class="tarjeta pareja"><h3>Unan sus caminos</h3><p>Los acuerdos, el Pacto y el avance de los dos se comparten entre ustedes. Uno crea un código y un <strong>PIN de pareja</strong>; el otro los escribe en su cuenta.</p><div class="fila"><button class="btn" data-act="pareja-crear">Crear el código</button><button class="btn sec" data-act="pareja-unir">Tengo un código</button></div></section>';
    if (!st.pareja) return '<section class="tarjeta pareja" id="tpareja"><h3>Su espacio de pareja</h3><p>El PIN de pareja guardado no abre su espacio. Pídeselo otra vez a tu pareja y escríbelo aquí.</p>' + pinCampos + '<p class="error" id="errp"></p><button class="btn" data-act="pareja-pin-ok">Abrir</button></section>';
    if (st.miembros < 2) return '<section class="tarjeta pareja"><h3>Falta tu pareja</h3><p>Compártele este código y el PIN de pareja que creaste. Díselos en persona o en una llamada.</p><p class="codigo">' + codigoBonito(p.codigo) + '</p><p class="nota">Cuando tu pareja los escriba en su cuenta, aquí verás que ya están unidos.</p></section>';
    var o = otro();
    return '<section class="tarjeta pareja ok"><h3>Unidos' + (o && !o.sinDatos ? ' con ' + esc(o.nombre) : '') + '</h3><p>Ya pueden escribir juntos los acuerdos y el Pacto, y cada uno ve el avance del otro. Lo que uno escribe le aparece al otro.</p></section>';
  }

  /* ---------- jornada: piezas de siempre ---------- */
  function valorP(id) { var c = st.persona.campos[id]; return c ? c.v : ''; }
  function valorC(id) { var c = st.pareja && st.pareja.campos[id]; return c ? c.v : ''; }
  function htmlBloque(bq) {
    if (bq.t === 'md') return '<div class="lee">' + md(bq.md) + '</div>';
    if (bq.t === 'campo') return '<div class="ej"><label class="ej-l" for="c-' + bq.id + '">' + inline(bq.etiqueta) + '</label>' + (bq.ayuda ? '<div class="ej-a">' + md(bq.ayuda) + '</div>' : '') + '<textarea id="c-' + bq.id + '" data-campo="' + bq.id + '" rows="3">' + esc(valorP(bq.id)) + '</textarea></div>';
    if (bq.t === 'formulario') {
      var cuerpo;
      if (!st.pareja || st.miembros < 2) cuerpo = '<p class="aviso">Para escribir esto juntos, primero unan sus cuentas (en Más). Mientras tanto, pueden escribirlo en papel.</p>';
      else cuerpo = (bq.intro ? '<div class="lee">' + md(bq.intro) + '</div>' : '') + bq.campos.map(function (c) {
        return '<div class="ej"><label class="ej-l" for="f-' + c.id + '">' + inline(c.etiqueta) + '</label>' + (c.ayuda ? '<div class="ej-a">' + md(c.ayuda) + '</div>' : '') + '<textarea id="f-' + c.id + '" data-formulario="' + c.id + '" rows="3">' + esc(valorC(c.id)) + '</textarea></div>';
      }).join('') + '<p class="nota" id="guardado" aria-live="polite">Lo escriben entre los dos: lo que uno escribe le aparece al otro, cifrado con su PIN de pareja.</p>';
      return '<section class="form-pareja"><h3>' + inline(bq.titulo) + '</h3>' + cuerpo + '</section>';
    }
    return '';
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
  function render() {
    var v = st.vista;
    if (v === 'camino') return pantallaCamino();
    if (v === 'pacto') return pantallaPacto();
    if (v === 'mas') return pantallaMas();
    if (v === 'cita') return pantallaCita(st.n);
    if (v === 'jornada') return pantallaJornada(st.n);
    return pantallaInicio();
  }
  function conservando(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }
  async function cargar(n) { if (!st.jor[n]) { pantallaCargando(); st.jor[n] = await P.jornada(n); } }
  function marcarHash(h) { try { history.replaceState(null, '', location.pathname + (h ? '#' + h : '')); } catch (e) { } }
  async function ir(vista, n, paso) {
    try {
      var tt = { inicio: 'Hoy', camino: 'Sus caminos', pacto: 'El Pacto', mas: 'Más', cita: 'La cita', jornada: 'Día ' + n };
      if (vista === 'inicio' || vista === 'camino' || vista === 'pacto' || vista === 'mas') {
        st.vista = vista; st.formPareja = vista === 'mas' || vista === 'inicio' ? st.formPareja : null;
        document.title = tt[vista] + ' · Uniendo Caminos'; marcarHash(vista === 'inicio' ? '' : vista); render(); st.aviso = ''; return;
      }
      if (vista === 'jornada') {
        n = Number(n); if (!abierta(n)) return;
        if (esCita(n)) return ir('cita', n, paso);
        await cargar(n);
        var N = pasosDe(st.jor[n]).length;
        st.vista = 'jornada'; st.n = n; st.paso = paso != null && paso !== '' ? Math.min(Number(paso), N - 1) : (hecha(n) ? 0 : Math.min(pasoVisto(n), N - 1));
        document.title = 'Día ' + n + ' · Uniendo Caminos'; pantallaJornada(n); marcarHash('dia-' + n); return;
      }
      if (vista === 'cita') {
        n = Number(n) || citaActual();
        if (abierta(n)) await cargar(n); else if (!st.jor[n]) { try { st.jor[n] = await P.jornada(n); } catch (x) { /* la vista previa funciona sin el contenido */ } }
        st.vista = 'cita'; st.n = n; st.paso = 0;
        if (st.jor[n]) {
          var L = pasosDe(st.jor[n]);
          if (paso === 'escribir') { st.paso = 0; L.forEach(function (x, k) { if (/^Escribir/i.test(x.t)) st.paso = k; }); }
          else st.paso = paso != null && paso !== '' ? Math.min(Number(paso), L.length - 1) : (hecha(n) ? 0 : Math.min(pasoVisto(n), L.length - 1));
        }
        document.title = 'Cita ' + semDe(n) + ' · Uniendo Caminos'; pantallaCita(n); marcarHash('cita-' + n);
      }
    } catch (e) { console.error(e); st.aviso = 'No pudimos abrir eso. Revisa tu conexión.'; st.vista = 'inicio'; pantallaInicio(); }
  }
  async function guardarPaso(n, k) {
    if (k <= pasoVisto(n)) return;
    var ahora = Date.now();
    st.persona = await P.guardarPersona(function (p) { p.campos['_paso:' + n] = { v: k, t: ahora }; });
  }
  async function terminarDia(n) {
    var N = pasosDe(st.jor[n]).length, ahora = Date.now();
    st.persona = await P.guardarPersona(function (p) { p.hechos[n] = { v: true, t: ahora }; p.campos['_paso:' + n] = { v: N, t: ahora }; });
    compartirAvance();
  }
  $app.addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.jornada) return ir('jornada', b.dataset.jornada, b.dataset.paso);
    if (b.dataset.ir) return ir(b.dataset.ir, b.dataset.n || (b.dataset.ir === 'jornada' ? st.n : null), b.dataset.paso);
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
      if (act === 'paso-sig') {
        var n0 = Number(b.dataset.n), i0 = Number(b.dataset.i);
        b.disabled = true; await guardarPaso(n0, i0 + 1); return ir('jornada', n0, i0 + 1);
      }
      if (act === 'terminar-dia') {
        var nd = Number(b.dataset.n); b.disabled = true; await terminarDia(nd);
        st.aviso = ''; await ir('inicio'); return toast('Día ' + nd + ' listo. ¡Un paso más en su camino!');
      }
      if (act === 'cita-sig') {
        var nc = Number(b.dataset.n), ic = Number(b.dataset.i);
        b.disabled = true; await guardarPaso(nc, ic + 1); st.paso = ic + 1; pantallaCita(nc); window.scrollTo(0, 0); return;
      }
      if (act === 'terminar-cita') {
        var nt = Number(b.dataset.n); b.disabled = true; await terminarDia(nt);
        await ir('pacto'); return toast(nt === 20 ? '¡Cita 4 terminada! Su Pacto está escrito.' : 'Cita ' + semDe(nt) + ' terminada. Su acuerdo quedó en el Pacto.');
      }
      if (act === 'reloj') {
        if (reloj.corre) { reloj.resta = Math.max(0, reloj.fin - Date.now()); reloj.corre = false; }
        else { if (!reloj.resta) reloj.resta = reloj.total; reloj.fin = Date.now() + reloj.resta; reloj.corre = true; }
        return relojTick();
      }
      if (act === 'hecha') {
        var n = Number(b.dataset.n), ya = hecha(n);
        st.persona = await P.guardarPersona(function (p) { p.hechos[n] = { v: !ya, t: Date.now() }; });
        compartirAvance();
        return ya ? ir('jornada', n, 0) : ir('inicio');
      }
      if (act === 'inv') { st.vista = 'inv-' + b.dataset.cual; return pantallaInventario(b.dataset.cual); }
      if (act === 'inv-listo') { st.persona = await P.guardarPersona(function (p) { p.inv[b.dataset.cual + ':hecho'] = { v: true, t: Date.now() }; }); await ir('inicio'); return toast('Inventario guardado'); }
      if (act === 'imprimir') return imprimir(b.dataset.que, Number(b.dataset.n || 0));
      if (act === 'imprimir-ya') return window.print();
      if (act === 'pareja-crear' || act === 'pareja-unir') { st.formPareja = act === 'pareja-crear' ? 'crear' : 'unir'; render(); var t = document.getElementById('tpareja'); if (t) { t.scrollIntoView({ block: 'center' }); var i0b = t.querySelector('input'); if (i0b) i0b.focus(); } return; }
      if (act === 'pareja-cancelar') { st.formPareja = null; return render(); }
      var errp = document.getElementById('errp');
      if (act === 'pareja-crear-ok') {
        var pc = document.getElementById('pp1').value, pc2 = document.getElementById('pp2').value;
        if (!pinValido(pc)) { errp.textContent = 'El PIN de pareja debe tener al menos 6 letras o números.'; return; }
        if (pc !== pc2) { errp.textContent = 'Los dos PIN no coinciden.'; return; }
        pantallaCargando('Creando su espacio de pareja…');
        await P.crearPareja(pc); st.persona = P.persona(); st.formPareja = null; await abrirParejaSegura(); return ir(st.vista === 'mas' ? 'mas' : 'inicio');
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
        st.persona = P.persona(); await abrirParejaSegura(); st.aviso = ''; await ir('inicio'); return toast('¡Unidos! Ya caminan juntos.');
      }
      if (act === 'pareja-pin-ok') {
        var np = document.getElementById('pp1').value; if (!np) return;
        try { await P.cambiarPinPareja(np); } catch (x) { if (x.code !== 'pin-incorrecto') throw x; }
        st.persona = P.persona(); await abrirParejaSegura();
        if (!st.pareja) { render(); var e2 = document.getElementById('errp'); if (e2) e2.textContent = 'Ese PIN no abre su espacio de pareja.'; return; }
        return ir('inicio');
      }
    } catch (x) {
      console.error(x);
      err = err || document.getElementById('errp');
      if (err) err.textContent = 'Algo no funcionó. Revisa tu conexión e intenta de nuevo.'; else { st.aviso = 'Algo no funcionó. Revisa tu conexión e intenta de nuevo.'; if (st.persona) render(); }
    }
  });
  $app.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'pin') { var b = $app.querySelector('[data-act="abrir"]'); if (b) b.click(); } });

  async function abrirParejaSegura() {
    st.pareja = null; st.miembros = 0;
    if (!st.persona.pareja) return;
    try { var r = await P.abrirPareja(); st.pareja = r.datos; st.miembros = r.miembros; }
    catch (e) { if (e.code !== 'pin-incorrecto') console.error(e); return; }
    compartirAvance();
    P.escucharPareja(function (datos, miembros) {
      st.pareja = datos; var antes = st.miembros; st.miembros = miembros;
      if (antes < 2 && miembros >= 2) compartirAvance();
      var a = document.activeElement, escribiendo = a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
      if (escribiendo) return;
      if (['inicio', 'camino', 'pacto', 'mas', 'jornada'].indexOf(st.vista) >= 0) conservando(render);
      else if (st.vista === 'cita') conservando(function () { pantallaCita(st.n); });
    });
  }

  async function despuesDeAbrir() {
    pantallaCargando();
    if (!st.base) st.base = await P.base();
    await abrirParejaSegura();
    for (var n = 1; n <= 20; n++) if (abierta(n) && !st.jor[n]) st.jor[n] = await P.jornada(n);
    var h = location.hash, m;
    if ((m = h.match(/^#dia-(\d+)$/)) && abierta(Number(m[1]))) return ir('jornada', m[1]);
    if ((m = h.match(/^#cita-(\d+)$/))) return ir('cita', m[1]);
    if (/^#(camino|pacto|mas)$/.test(h)) return ir(h.slice(1));
    return ir('inicio');
  }
  async function arrancar() {
    pantallaCargando();
    try { st.u = await P.sesion().listo(); } catch (x) { console.error(x); st.u = null; }
    st.acceso = null;
    if (st.u) { try { st.acceso = await P.tieneDerecho(); } catch (x) { st.acceso = null; } }
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

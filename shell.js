/* arch; site shell: pick the Mobile/Desktop artboard for this screen and centre it. */
(function () {
  var f = location.pathname.split('/').pop() || 'index.html';
  var wide = Math.max(screen.width, innerWidth) >= 900;
  var alt = wide ? f.replace('Mobile.dc.html', 'Desktop.dc.html') : f.replace('Desktop.dc.html', 'Mobile.dc.html');
  var exists = ['RecordDesktop.dc.html'].indexOf(alt) < 0;
  if (alt !== f && exists) { location.replace(alt + location.search + location.hash); return; }
  document.documentElement.style.background = '#000';
  var s = document.createElement('style');
  s.textContent = 'html,body{background:#000;margin:0}body>x-dc,body>*:first-child{margin:0 auto}body{display:flex;justify-content:center;min-height:100vh}' +
    /* Safari: masked ticket halves ignore the face's backface-visibility, so hide every piece's back and keep them in one 3D layer */
    '.face{transform-style:preserve-3d;-webkit-transform-style:preserve-3d}.face>*,.face>*>*{-webkit-backface-visibility:hidden;backface-visibility:hidden}';
  /* home ticket: the stage fills the window instead of a fixed 1280x960 frame, so the ring is never cut off */
  if (/^Ticket(Desktop|DesktopIn)\.dc\.html$/.test(f)) s.textContent += '.amb-home{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;margin:0!important}body{overflow:hidden}';
  document.head.appendChild(s);
})();

/* Desktop home ring: show each ticket's front or back from its real angle each frame,
   instead of trusting backface-visibility (Safari ignores it on the masked ticket halves). */
(function () {
  if (!/^Ticket(Desktop|DesktopIn)\.dc\.html$/.test(location.pathname.split('/').pop())) return;
  const angleOf = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m = t.match(/matrix3d\(([^)]+)\)/);
    if (!m) return 0;
    const v = m[1].split(',').map(Number);
    return Math.atan2(-v[2], v[0]); // rotateY: m11 = cos, m13 = -sin
  };
  const tick = () => {
    const ring = document.querySelector('.ring');
    if (ring) {
      const a = angleOf(ring);
      [...ring.children].forEach((slot, i) => {
        const faces = slot.querySelectorAll(':scope > .face');
        if (faces.length < 2) return;
        // a ticket at radius R faces a camera D away when cos(angle) > R / D (ring: translateZ(426px), stage: perspective 1800px)
        const front = Math.cos(a + (i * 2 * Math.PI) / ring.children.length) > 426 / 1800;
        faces[0].style.visibility = front ? 'visible' : 'hidden';
        faces[1].style.visibility = front ? 'hidden' : 'visible';
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();

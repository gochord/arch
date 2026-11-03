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
    '.face{transform-style:preserve-3d;-webkit-transform-style:preserve-3d}.face>*,.face>*>*{-webkit-backface-visibility:hidden;backface-visibility:hidden}' +
    /* Safari drops backface hiding on masked layers: the spinning copies skip the notch mask (too small to see) so their backs stay hidden */
    '.ring .notch4,.ring .notch4:first-of-type,.ring .notch4:last-of-type{-webkit-mask:none!important;mask:none!important}';
  /* home ticket: the stage fills the window instead of a fixed 1280x960 frame, so the ring is never cut off */
  if (/^Ticket(Desktop|DesktopIn)\.dc\.html$/.test(f)) s.textContent += '.amb-home{width:100vw!important;height:100vh!important;min-height:760px}body{overflow:hidden}';
  document.head.appendChild(s);
})();

/* arch; canvas behaviours — phase 1: home ticket, desktop nav pill, mobile menu wheel.
   Talks to the existing app only through go(), #accountBtn and showArchNotice(). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const signedIn = () => typeof archUser !== 'undefined' && !!archUser;
  const notice = (m) => (typeof showArchNotice === 'function' ? showArchNotice(m) : alert(m));
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- home ticket ---------- */
  const DESTS = [['recommend', '피드'], ['archive', '기록하기'], ['profile', '프로필'], ['curation', '큐레이션']];
  const CHECK = '<svg viewBox="0 0 44 40" aria-hidden="true"><path d="M6 21 L16 31 L39 6"/></svg>';
  const STORE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12.5H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';

  function buildTicket() {
    const home = $('#home');
    if (!home) return;
    const d = new Date();
    home.innerHTML = `
      <div class="tk" role="group" aria-label="arch; 티켓">
        <div class="tk-paper tk-upper">
          <span class="tk-kicker">ARCH YOUR VIEW</span>
          <p class="tk-lede">취향으로 발견하고, 그 자리에서 기록하세요.<br>지나온 장소와 순간을 모으는 공간 아카이빙.</p>
          <h1 class="tk-title">취향이<br>도착하는 곳,</h1>
          <div class="tk-mark"><b>arch;</b><span>37° 34′ N<br>126° 58′ E</span></div>
          <div class="tk-actions">
            <button type="button" class="tk-pill soft" data-go="about">ABOUT arch;<span aria-hidden="true">→</span></button>
            <button type="button" class="tk-pill solid" id="tkAccount" aria-haspopup="dialog"></button>
          </div>
        </div>
        <div class="tk-paper tk-stub">
          <div class="tk-tear" aria-hidden="true"></div>
          <div class="tk-meta">
            <div><small>DATE</small><strong>${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}</strong></div>
            <button type="button" class="tk-store" id="tkStore">${STORE}<small>스토어</small></button>
          </div>
          <span class="tk-dest-label" id="tkDestLabel">향하고 싶은 곳에 체크하세요.</span>
          <div class="tk-tiles" role="group" aria-labelledby="tkDestLabel">
            ${DESTS.map(([id, label], i) => `<button type="button" class="tk-tile" data-dest="${id}" aria-pressed="false"><span class="n">${pad(i + 1)}</span><span class="l">${label}</span></button>`).join('')}
          </div>
          <div class="tk-ticker" role="marquee" aria-label="arch; 소식"><span>TRAVEL BY FEELING · 취향이 도착하는 곳, arch; · 새 소식은 상단 종 아이콘에서 확인하세요 · </span></div>
          <div class="tk-foot"><b>@archyourview</b><span>공간의 감각을 선명히 담는 곳</span></div>
        </div>
      </div>
      <button id="homeAuthCTA" type="button" style="display:none!important" tabindex="-1" aria-hidden="true"></button>`;
    home.querySelector('[data-go="about"]').onclick = () => go('about');
    $('#tkStore').onclick = () => go('store');
    $('#tkAccount').onclick = () => $('#accountBtn')?.click();
    const upper = home.querySelector('.tk-upper'), stub = home.querySelector('.tk-stub');
    home.querySelectorAll('.tk-tile').forEach((tile) => {
      tile.onclick = () => {
        if (home.querySelector('.tk-tile[aria-pressed="true"]')) return;
        tile.setAttribute('aria-pressed', 'true');
        tile.insertAdjacentHTML('beforeend', CHECK);
        home.classList.add('tk-going');
        setTimeout(() => { upper.classList.add('jolt'); stub.classList.add('tear'); }, 520);
        setTimeout(() => {
          go(tile.dataset.dest);
          tile.setAttribute('aria-pressed', 'false');
          tile.querySelector('svg')?.remove();
          upper.classList.remove('jolt');
          stub.classList.remove('tear');
          home.classList.remove('tk-going');
          ring?.resume();
        }, 1550);
      };
    });
    const ring = setupRing(home);
    syncAccount();
  }

  /* desktop: eight tickets spin on a 3D ring; tap stops it and zooms the picked one in */
  function setupRing(home) {
    const tk = home.querySelector('.tk');
    const stage = document.createElement('div');
    stage.className = 'tk-ring-stage';
    stage.setAttribute('aria-label', '회전을 멈추고 티켓 고르기');
    stage.setAttribute('role', 'button');
    stage.tabIndex = 0;
    stage.innerHTML = '<div class="tk-ring-pos"><div class="tk-ring"></div></div>';
    const ringEl = stage.querySelector('.tk-ring');
    for (let i = 0; i < 8; i++) {
      const slot = document.createElement('div');
      slot.className = 'tk-slot';
      slot.style.transform = `rotateY(${i * 45}deg) translateZ(426px) scale(.58)`;
      const face = tk.cloneNode(true);
      face.removeAttribute('role');
      face.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      face.setAttribute('aria-hidden', 'true');
      face.inert = true;
      slot.append(face);
      slot.insertAdjacentHTML('beforeend', '<div class="tk-back" aria-hidden="true"><img src="assets/arch-logo.png" alt=""></div>');
      ringEl.append(slot);
    }
    home.prepend(stage);
    home.insertAdjacentHTML('beforeend', '<span class="tk-taphint" aria-hidden="true">TAP TO STOP · 눌러서 티켓 고르기</span><button type="button" class="tk-repick">← 다시 고르기</button>');
    const P = 48;
    let from = 0, start = performance.now(), ang = 0, mode = 'spin';
    const spin = () => {
      ringEl.style.transition = 'none';
      ringEl.style.transform = '';
      ringEl.style.animation = `tkSpin ${P}s linear ${-((from % 360) / 360) * P}s infinite`;
    };
    const stop = () => {
      if (mode !== 'spin') return;
      mode = 'stopping';
      ang = from + (performance.now() - start) / 1000 / P * 360;
      const target = Math.ceil(ang / 45 + 0.2) * 45;
      ringEl.style.animation = 'none';
      ringEl.style.transform = `rotateY(${-ang}deg)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ringEl.style.transition = 'transform 1.2s cubic-bezier(.12,.6,.2,1)';
        ringEl.style.transform = `rotateY(${-target}deg)`;
        ang = target;
      }));
      setTimeout(() => {
        mode = 'picked';
        const sel = Math.round(target / 45) % 8;
        ringEl.children[sel].style.opacity = '0';
        home.classList.add('tk-picked');
      }, 1250);
    };
    const resume = () => {
      if (mode === 'spin') return;
      mode = 'spin';
      from = ang;
      start = performance.now();
      [...ringEl.children].forEach((c) => (c.style.opacity = ''));
      home.classList.remove('tk-picked');
      spin();
    };
    stage.onclick = stop;
    stage.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); } };
    home.querySelector('.tk-repick').onclick = resume;
    spin();
    return { resume };
  }

  function syncAccount() {
    const b = $('#tkAccount');
    if (b) b.innerHTML = (signedIn() ? '내 계정' : '로그인/회원가입') + '<span aria-hidden="true">→</span>';
  }

  /* ---------- desktop nav: one neon pill that slides to the current tab ---------- */
  function setupNavPill() {
    const nav = $('.topnav');
    if (!nav) return;
    const pill = document.createElement('span');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    nav.prepend(pill);
    const place = () => {
      const cur = nav.querySelector('button.active');
      if (!cur) { pill.style.opacity = '0'; return; }
      pill.style.opacity = '1';
      pill.style.width = cur.offsetWidth + 'px';
      pill.style.transform = `translateX(${cur.offsetLeft}px)`;
    };
    new MutationObserver(place).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', place);
    document.fonts?.ready.then(place);
    place();
  }

  /* ---------- mobile menu wheel ---------- */
  const WHEEL = [['home', '홈'], ['recommend', '피드'], ['archive', '기록하기'], ['curation', '큐레이션'], ['store', '스토어'], ['profile', '프로필'], ['about', 'ABOUT']];
  function setupWheel() {
    const dk = document.createElement('div');
    dk.className = 'dk';
    const step = 26, span = step * (WHEEL.length - 1);
    dk.innerHTML = `
      <div class="dk-scrim"></div>
      <div class="dk-disc" aria-hidden="true"><b>MENU</b><small>탭해서 이동</small></div>
      <nav class="dk-arc" aria-label="메뉴">
        ${WHEEL.map(([id, label], i) => `<button type="button" class="dk-t" data-to="${id}" style="--deg:${-span / 2 + i * step}deg" tabindex="-1"><b>${label}</b><span><em>${pad(i + 1)}</em><em class="note"></em></span><i aria-hidden="true"></i></button>`).join('')}
      </nav>
      <button type="button" class="dk-btn" aria-label="메뉴 열기" aria-expanded="false"><span><i></i><i></i><i></i></span></button>`;
    document.body.appendChild(dk);
    const btn = dk.querySelector('.dk-btn');
    const tickets = [...dk.querySelectorAll('.dk-t')];
    const current = () => document.querySelector('main>.view.active')?.id || 'home';
    const setOpen = (open) => {
      dk.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      tickets.forEach((t) => {
        const here = t.dataset.to === current();
        t.classList.toggle('here', here);
        t.classList.remove('sel');
        t.tabIndex = open ? 0 : -1;
        t.querySelector('.note').textContent = here ? '지금 여기' : '';
      });
    };
    btn.onclick = () => setOpen(!dk.classList.contains('open'));
    dk.querySelector('.dk-scrim').onclick = () => setOpen(false);
    tickets.forEach((t) => {
      t.onclick = () => {
        tickets.forEach((o) => { o.classList.toggle('sel', o === t); o.classList.toggle('here', o === t); });
        setTimeout(() => { setOpen(false); go(t.dataset.to); }, 320);
      };
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }



  /* ---------- glass confirm used in place of the browser's confirm() ---------- */
  window.archConfirm = function (message, opts = {}) {
    return new Promise((resolve) => {
      const [title, ...rest] = String(message).split(/(?<=[?？])\s+/);
      const danger = /차단|삭제|탈퇴/.test(message);
      const m = document.createElement('div');
      m.className = 'ac-modal';
      m.innerHTML = '<div class="ac-card" role="alertdialog" aria-modal="true" aria-labelledby="acTitle"><h2 id="acTitle"></h2><p></p><div class="ac-row"><button type="button" class="ac-no">닫기</button><button type="button" class="ac-yes"></button></div></div>';
      m.querySelector('h2').textContent = title;
      m.querySelector('p').textContent = rest.join(' ');
      if (!rest.length) m.querySelector('p').remove();
      const yes = m.querySelector('.ac-yes');
      yes.textContent = opts.ok || (/차단/.test(message) ? '차단하기' : /삭제/.test(message) ? '삭제하기' : '확인');
      yes.classList.toggle('danger', danger);
      const done = (v) => { m.remove(); resolve(v); };
      yes.onclick = () => done(true);
      m.querySelector('.ac-no').onclick = () => done(false);
      m.onclick = (e) => { if (e.target === m) done(false); };
      document.body.appendChild(m);
      yes.focus();
    });
  };

  /* ---------- guest browsing bar on the feed ---------- */
  function setupGuestBar() {
    const head = $('#recommend .feed-header');
    if (!head) return;
    const bar = document.createElement('div');
    bar.className = 'guest-bar';
    bar.setAttribute('role', 'note');
    bar.innerHTML = '<span>로그인하지 않고 둘러보는 중이에요.</span><button type="button">로그인/회원가입</button>';
    bar.querySelector('button').onclick = () => $('#accountBtn')?.click();
    head.appendChild(bar);
    const sync = () => { bar.hidden = signedIn(); };
    sync();
    return sync;
  }

  function init() {
    buildTicket();
    setupNavPill();
    setupWheel();
    // keep the ticket's account button in step with sign-in state
    const syncGuest = setupGuestBar();
    const acc = $('#accountBtn');
    if (acc) new MutationObserver(() => { syncAccount(); syncGuest?.(); }).observe(acc, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

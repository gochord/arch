/* arch; canvas pages — store, about essay, curation playlists (phases 4–5). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const D = () => window.ARCH_DATA || {};

  /* ---------- store ---------- */
  function setupStore() {
    const el = $('#store');
    if (!el) return;
    let cat = '전체', region = '전체';
    const regions = ['영주', '고흥', '이천', '태안'];
    const render = () => {
      const goods = (D().GOODS || []).filter(([, c]) => cat === '전체' || (cat === '오리지널 굿즈' ? c === '오리지널' : c !== '오리지널' && (region === '전체' || c === region)));
      const chip = (label, on, attr) => `<button type="button" class="st-chip${on ? ' on' : ''}" ${attr}="${label}">${label}</button>`;
      el.innerHTML = `<div class="st-head"><span class="label">ARCH; STORE</span><h1>스토어</h1><p>지역의 이야기를 담은 굿즈로 공간을 더 생생히 기억하세요.</p></div>
        <div class="st-chips">${['전체', '오리지널 굿즈', '지역 굿즈'].map((c) => chip(c, c === cat, 'data-cat')).join('')}</div>
        ${cat === '지역 굿즈' ? `<div class="st-chips sub">${['전체', ...regions].map((r) => chip(r, r === region, 'data-region')).join('')}</div>` : ''}
        ${cat === '지역 굿즈' && region !== '전체' ? `<p class="st-intro">${esc((D().REGION_INTRO || {})[region] || '')}</p>` : ''}
        <div class="st-grid">${goods.map(([name, c, icon]) => `<button type="button" class="st-cell" data-goods="${esc(name)}"><span class="st-img"><img src="assets/goods/${icon}.svg" alt=""></span><b>${esc(name)}</b><small>${c === '오리지널' ? '오리지널 굿즈' : c + ' 지역 굿즈'}</small></button>`).join('')}</div>`;
      el.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { cat = b.dataset.cat; region = '전체'; render(); }));
      el.querySelectorAll('[data-region]').forEach((b) => (b.onclick = () => { region = b.dataset.region; render(); }));
      el.querySelectorAll('[data-goods]').forEach((b) => (b.onclick = () => openGoods(b.dataset.goods)));
    };
    render();
  }

  function openGoods(name) {
    const g = (D().GOODS || []).find((x) => x[0] === name);
    if (!g) return;
    const [, c, icon, desc] = g;
    const scents = name === '지역 향수'
      ? `<ul class="st-scents">${(D().SCENTS || []).map(([r, n, notes, d]) => `<li><div><span>${esc(r)}</span><b>${esc(n)}</b></div><p class="nt">${esc(notes)}</p><p>${esc(d)}</p></li>`).join('')}</ul>`
      : '';
    const m = document.createElement('div');
    m.className = 'ac-modal';
    m.innerHTML = `<div class="ac-card st-detail" role="dialog" aria-modal="true" aria-label="${esc(name)}"><button type="button" class="st-x" aria-label="닫기">×</button><span class="st-img big"><img src="assets/goods/${icon}.svg" alt=""></span><span class="label">${c === '오리지널' ? '오리지널 굿즈' : c + ' 지역 굿즈'}</span><h2>${esc(name)}</h2><p class="st-desc">${esc(desc)}</p>${scents}</div>`;
    const close = () => m.remove();
    m.querySelector('.st-x').onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };
    document.body.appendChild(m);
  }

  /* ---------- about essay ---------- */
  const QUOTES = [
    ['우리는 정말 자신이 원하는 곳으로 여행을 떠나는 걸까? 혹시 다른 누군가가 그곳을 원하기 때문에, 많은 이들이 그곳을 원하기 때문에. 우리 역시 그곳을 원하게 된 것은 아닐까? 우리는 한번쯤 당연히 자신의 것이라고 믿는 욕망의 출처를 고민해볼 필요가 있진 않은가.', 'René Girard'],
    ['취향은 지극히 개인적인 것처럼 보이지만, 그것이 평가받는 기준은 언제나 개인의 바깥에도 존재한다. 우리는 좋아하는 것을 선택한다고 생각하면서도, 때로는 남들에게 좋은 취향으로 인정받을 만한 것을 선택한다.', 'Pierre Bourdieu'],
    ['우리는 여행을 마치고 무엇을 가지고 돌아올까? 유명한 장소에서 찍은 사진, 누군가에게 보여주기 위해 이렇게 저렇게 꾸며낸 사진과 기록들. 그러나 누군가 우리에게 그곳에서 무엇을 느꼈는지 묻는다면, 우리는 얼마나 많은 이야기를 할 수 있을까?', 'Erich Fromm']
  ];
  const BODY = [
    '어디로 떠나고 싶을 때, 우리는 자연스럽게 SNS에서 수없이 마주했던 장소들을 떠올린다. 이미 많은 이들이 방문했고, 누군가에 의해 그 가치가 인정된 장소들. 그런데 잠시 멈추어 생각해보자.',
    '우리는 그곳이 정말 좋아서 가는 것일까, 아니면 그곳이 좋다고 여겨지기 때문에 가고 싶어진 것일까.',
    '물론 유행하는 장소를 찾아가는 것 그 자체로는 문제가 아닐 것이다. 다만 그러한 선택이 반복되는 동안, 우리는 자신의 취향이 향하는 곳을 충분히 돌아보고 있는가. 새로운 장소를 발견하기보다 이미 발견된 장소를 따라가고, 스스로의 취향을 확장하기보다 남들에게 인정받는 취향 안에 스스로를 가두고 있는 것은 아닐까.',
    "어쩌면 우리 모두는 어느 정도 흔히 '비주류'라고 불리는 취향을 가지고 있을지도 모른다. 남들에게 이야기하기에는 조금 낯선 취향, 아직 스스로도 제대로 발견하지 못한 취향, 혹은 언젠가 좋아했지만 어느새 잊어버린 취향까지. 그러나 우리는 자신의 취향조차 남들에게 있어 보여야 한다는 생각에, 그것을 충분히 들여다보기도 전에 유행을 따라가곤 한다.",
    '우리는 흔히 비주류라고 불리는 취향이 주류의 취향보다 특별하다고 이야기하려는 것이 아니다. 다만 이미 많은 사람들에게 인정받은 장소들 너머에도, 각자의 마음을 움직일 수 있는 수많은 장소와 경험들이 존재한다는 사실을 이야기하고 싶었다.'
  ];
  const BODY2 = [
    'Archive, 기록하고 보관한다는 의미에서 출발한 arch;는 동시에 서로 다른 공간을 연결하는 하나의 문이기도 하다. 익숙한 장소에서 낯선 장소로, 이미 알고 있던 취향에서 미처 발견하지 못했던 취향으로 나아가는 문. 그리고 그 문을 지나 마주한 장소에서의 감정과 생각을 자신만의 기록으로 남길 수 있는 공간.',
    '그러기 위해 우리는 누군가가 이미 좋다고 평가한 장소를 추천하는 데 그치지 않고, 각자가 자신의 취향에 따라 새로운 공간을 탐색할 수 있는 기회를 만들고자 한다. 직접 발굴한 장소들을 소개하고, 그곳에 직접 방문했을 때만 남길 수 있는 기록을 통해 그 순간의 감정과 생각을 자신만의 방식으로 간직할 수 있도록 하는 것. 그렇게 쌓인 기록들이 단순히 방문한 장소의 목록이 아니라, 자신이 무엇에 끌리고 어떤 순간에 마음이 움직였는지를 돌아볼 수 있는 하나의 아카이브가 되기를 바란다.'
  ];
  const CLOSE = ['남들이 좋다고 하는 곳에 끌려가는 것이 아닌, 내가 끌리는 곳으로 향하는 것.', '그 과정에서 미처 알지 못했던, 잊어왔던 나의 설렘이 향하는 곳을 알게 되는 것.', '그 경험을 자신만의 기록으로 남기는 것.'];

  function setupAbout() {
    const el = $('#about');
    if (!el) return;
    const ps = (list) => list.map((p) => `<p>${p}</p>`).join('');
    el.innerHTML = `<div class="ab-hero"><span class="label">ABOUT arch;</span><h1>취향이<br>도착하는 곳,<br>arch;</h1></div>
      <article class="ab-essay">
        <div class="ab-quotes">${QUOTES.map(([t, a]) => `<figure class="ab-q"><blockquote>${t}</blockquote><figcaption>Inspired by ${a}</figcaption></figure>`).join('')}</div>
        <p class="ab-star" aria-hidden="true">✳︎</p>
        <div class="ab-body"><p class="ab-lead">그렇다면 오늘날 우리의 여행은 어떠한가.</p>${ps(BODY)}<p class="ab-pivot">arch;는 바로 이러한 문제의식에서 출발했다.</p>${ps(BODY2)}</div>
        <p class="ab-star" aria-hidden="true">✳︎</p>
        <div class="ab-close">${ps(CLOSE)}<p class="ab-final">취향이 도착하는 곳, arch;</p></div>
      </article>`;
  }

  /* ---------- curation: playlist block on the 영주·이천·고흥·태안 issues ---------- */
  function setupPlaylists() {
    const title = $('#detailTitle'), area = $('#curationDetail .recommend-area');
    if (!title || !area) return;
    const box = document.createElement('section');
    box.className = 'pl-box';
    box.hidden = true;
    area.before(box);
    const sync = () => {
      const t = title.textContent || '';
      const key = Object.keys(D().PLAYLISTS || {}).find((k) => t.includes(k));
      if (!key) { box.hidden = true; box.innerHTML = ''; return; }
      const [list, tracks] = D().PLAYLISTS[key];
      box.hidden = false;
      box.innerHTML = `<div class="pl-hd"><div><span class="label">PLAYLIST · ${tracks.length}곡</span><h2>${key} 플레이리스트</h2></div><a class="pl-go" href="https://www.youtube.com/playlist?list=${list}" target="_blank" rel="noopener noreferrer">전체 재생 ↗</a></div>
        <ol class="pl-list">${tracks.map(([n, a, v], i) => `<li><a href="https://www.youtube.com/watch?v=${v}&list=${list}" target="_blank" rel="noopener noreferrer"><span class="n">${pad(i + 1)}</span><span class="m"><b>${esc(n)}</b><small>${esc(a)}</small></span><span class="p" aria-hidden="true">▶</span></a></li>`).join('')}</ol>`;
    };
    new MutationObserver(sync).observe(title, { childList: true, characterData: true, subtree: true });
    sync();
  }

  function init() { setupStore(); setupAbout(); setupPlaylists(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

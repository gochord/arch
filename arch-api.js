/* arch; data layer for the canvas pages: one Supabase client, the signed-in user, and the calls the screens need.
   Ported from legacy.html (same project, same auth storage keys, so existing sessions carry over). */
(function () {
  const SUPABASE_URL = 'https://mifptmkljrkwsuwrxtwd.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_E0VRTUKR1-DJBzQ1lztF6A_0EzwM5GF';
  const AUTO = 'arch-auto-login';
  if (localStorage.getItem(AUTO) === null) localStorage.setItem(AUTO, 'true');
  const store = () => (localStorage.getItem(AUTO) === 'true' ? localStorage : sessionStorage);
  const storage = {
    getItem: (k) => store().getItem(k),
    setItem: (k, v) => store().setItem(k, v),
    removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); }
  };
  const sb = window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage }
  });

  const listeners = new Set();
  const api = {
    sb,
    user: null,
    profile: null,
    ready: false,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); },
    handle() { return api.profile?.username ? '@' + api.profile.username : '@아이디'; },

    async loadProfile() {
      if (!api.user) { api.profile = null; return; }
      const { data } = await sb.from('profiles').select('id,nickname,username,avatar_url,status_message,interests,is_private,onboarding_completed').eq('id', api.user.id).maybeSingle();
      api.profile = data || null;
    },

    async signIn(login, password, auto = true) {
      localStorage.setItem(AUTO, String(auto));
      const v = login.trim();
      if (/^@?[a-z][a-z0-9._]{2,19}$/i.test(v) && !v.includes('@', 1)) {
        const r = await sb.functions.invoke('username-login', { body: { username: v.replace(/^@/, ''), password } });
        if (r.error || !r.data?.access_token) throw new Error(r.data?.error || '아이디 또는 비밀번호를 확인해 주세요.');
        const s = await sb.auth.setSession({ access_token: r.data.access_token, refresh_token: r.data.refresh_token });
        if (s.error) throw s.error;
        return s.data;
      }
      const r = await sb.auth.signInWithPassword({ email: v, password });
      if (r.error) throw new Error('아이디, 이메일 또는 비밀번호를 확인해 주세요.');
      return r.data;
    },
    async signUp(email, password) {
      const r = await sb.auth.signUp({ email: email.trim(), password });
      if (r.error) throw r.error;
      return r.data; // no session → email confirmation pending
    },
    async saveSetup({ name, username, interests }) {
      if (!api.user) throw new Error('로그인이 필요해요.');
      const { error } = await sb.from('profiles').update({ nickname: name, username, interests, onboarding_completed: true }).eq('id', api.user.id);
      if (error) throw error;
      await api.loadProfile();
      api.emit();
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
      if (error) throw error;
    },
    async kakao() {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: location.href.split('#')[0] } });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); },

    /* feed: newest visible posts with author + like counts */
    async feed(limit = 60) {
      const { data: rows, error } = await sb.from('posts')
        .select('id,user_id,photo_url,caption,place_name,place_address,created_at,visibility')
        .eq('is_hidden', false).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const postIds = rows.map((r) => r.id);
      const [profiles, likes, follows] = await Promise.all([
        ids.length ? sb.from('profiles').select('id,nickname,username,avatar_url,is_private').in('id', ids) : { data: [] },
        postIds.length ? sb.from('post_likes').select('post_id,user_id').in('post_id', postIds) : { data: [] },
        api.user ? sb.from('follows').select('following_id').eq('follower_id', api.user.id) : { data: [] }
      ]);
      const byId = new Map((profiles.data || []).map((p) => [p.id, p]));
      const following = new Set((follows.data || []).map((f) => f.following_id));
      return rows.map((r) => {
        const p = byId.get(r.user_id) || {};
        const lk = (likes.data || []).filter((l) => l.post_id === r.id);
        return {
          id: r.id, userId: r.user_id, mine: r.user_id === api.user?.id,
          name: p.nickname || 'arch; 여행자', handle: p.username || '', avatar: p.avatar_url || '',
          photo: r.photo_url || '', caption: r.caption || '', place: r.place_name || '', address: r.place_address || '',
          createdAt: r.created_at, time: api.relTime(r.created_at),
          likes: lk.length, liked: !!api.user && lk.some((l) => l.user_id === api.user.id),
          following: following.has(r.user_id), priv: !!p.is_private
        };
      });
    },
    async toggleLike(postId, liked) {
      if (!api.user) throw new Error('login');
      const q = liked
        ? sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', api.user.id)
        : sb.from('post_likes').insert({ post_id: postId, user_id: api.user.id });
      const { error } = await q;
      if (error) throw error;
    },
    async toggleFollow(userId, following) {
      if (!api.user) throw new Error('login');
      const q = following
        ? sb.from('follows').delete().eq('follower_id', api.user.id).eq('following_id', userId)
        : sb.from('follows').insert({ follower_id: api.user.id, following_id: userId });
      const { error } = await q;
      if (error) throw error;
    },

    relTime(iso) {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 60) return '방금';
      if (s < 3600) return Math.floor(s / 60) + '분 전';
      if (s < 86400) return Math.floor(s / 3600) + '시간 전';
      if (s < 604800) return Math.floor(s / 86400) + '일 전';
      const d = new Date(iso);
      return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    }
  };
  window.archApi = api;
  window.archSignedIn = () => !!api.user;

  if (!sb) { api.ready = true; return; }
  const apply = async (session) => {
    api.user = session?.user || null;
    await api.loadProfile();
    api.ready = true;
    api.emit();
  };
  sb.auth.getSession().then(({ data }) => apply(data.session));
  sb.auth.onAuthStateChange((_e, session) => { if ((session?.user?.id || null) !== (api.user?.id || null)) apply(session); });
})();

/* comments */
(function (api) {
  api.comments = async (postId) => {
    const { data, error } = await api.sb.from('post_comments').select('id,user_id,body,created_at').eq('post_id', postId).order('created_at', { ascending: true }).limit(200);
    if (error) throw error;
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: ps } = ids.length ? await api.sb.from('profiles').select('id,nickname,username').in('id', ids) : { data: [] };
    const by = new Map((ps || []).map((p) => [p.id, p]));
    return data.map((c) => ({ id: c.id, name: c.user_id === api.user?.id ? '나' : (by.get(c.user_id)?.nickname || '여행자'), handle: by.get(c.user_id)?.username || '', text: c.body, mineId: c.user_id === api.user?.id }));
  };
  api.addComment = async (postId, body) => {
    const { error } = await api.sb.from('post_comments').insert({ post_id: postId, user_id: api.user.id, body });
    if (error) throw error;
  };
  api.deleteComment = async (id) => {
    const { error } = await api.sb.from('post_comments').delete().eq('id', id).eq('user_id', api.user.id);
    if (error) throw error;
  };
})(window.archApi);

/* photos, location, records, profiles, magazines, settings */
(function (api) {
  const sb = api.sb;
  const PUB = '/storage/v1/object/public/record-images/';
  const cache = new Map();
  api.photoUrl = async (value) => {
    if (!value) return '';
    let path = null;
    try { const u = new URL(value, location.href); if (u.pathname.startsWith(PUB)) path = decodeURIComponent(u.pathname.slice(PUB.length)); } catch (e) {}
    if (!path) return value;
    const c = cache.get(path);
    if (c && c.until > Date.now()) return c.url;
    const r = await sb.storage.from('record-images').createSignedUrl(path, 3600);
    if (r.error) return '';
    cache.set(path, { url: r.data.signedUrl, until: Date.now() + 3000000 });
    return r.data.signedUrl;
  };
  const baseFeed = api.feed;
  api.feed = async (limit) => {
    const rows = await baseFeed(limit);
    await Promise.all(rows.map(async (r) => { r.photo = await api.photoUrl(r.photo); }));
    return rows;
  };

  api.locate = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 브라우저는 위치를 지원하지 않아요.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error('위치 권한을 허용해야 기록할 수 있어요.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
  api.nearbyPlaces = async (loc) => {
    const r = await sb.functions.invoke('kakao-place-search', { body: { mode: 'nearby', x: loc.longitude, y: loc.latitude, radius: 700 } });
    const err = r.error?.message || r.data?.error;
    if (err) throw new Error(err);
    return r.data?.places || [];
  };
  api.searchPlaces = async (query, loc) => {
    const r = await sb.functions.invoke('kakao-place-search', { body: { mode: 'keyword', query, x: loc?.longitude, y: loc?.latitude } });
    const err = r.error?.message || r.data?.error;
    if (err) throw new Error(err);
    return r.data?.places || [];
  };
  api.placeName = (p) => {
    const area = (p.road_address_name || p.address_name || '').split(' ').slice(0, 2).join(' ');
    return area ? area + ' · ' + p.place_name : p.place_name;
  };
  api.publishRecord = async ({ blob, caption, visibility, place, coords }) => {
    if (!api.user) throw new Error('로그인이 필요해요.');
    const path = `${api.user.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const up = await sb.storage.from('record-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    const { data: pub } = sb.storage.from('record-images').getPublicUrl(path);
    const { error } = await sb.from('posts').insert({
      user_id: api.user.id, photo_url: pub.publicUrl, caption, visibility: visibility || 'public',
      latitude: coords.latitude, longitude: coords.longitude, place_name: api.placeName(place),
      kakao_place_id: String(place.id || ''), place_url: place.place_url || '',
      place_address: place.road_address_name || place.address_name || '',
      place_category: place.category_name || place.category_group_name || '', place_phone: place.phone || ''
    });
    if (error) throw error;
  };
  api.toJpeg = (dataUrlOrBlob, max = 1600) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 처리하지 못했어요.'))), 'image/jpeg', 0.86);
    };
    img.onerror = () => reject(new Error('사진을 불러오지 못했어요.'));
    img.src = typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : URL.createObjectURL(dataUrlOrBlob);
  });

  api.profileById = async (id) => {
    const { data } = await sb.from('profiles').select('id,nickname,username,avatar_url,status_message,interests,is_private').eq('id', id).maybeSingle();
    return data;
  };
  api.userPosts = async (userId) => {
    const { data, error } = await sb.from('posts').select('id,photo_url,caption,place_name,place_address,created_at,visibility,latitude,longitude').eq('user_id', userId).eq('is_hidden', false).order('created_at', { ascending: false }).limit(60);
    if (error) return [];
    await Promise.all(data.map(async (r) => { r.photo = await api.photoUrl(r.photo_url); }));
    return data;
  };
  api.followCounts = async (userId) => {
    const [a, b] = await Promise.all([
      sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
      sb.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);
    return { followers: a.count || 0, following: b.count || 0 };
  };
  api.isFollowing = async (userId) => {
    if (!api.user) return false;
    const { data } = await sb.from('follows').select('following_id').eq('follower_id', api.user.id).eq('following_id', userId).maybeSingle();
    return !!data;
  };
  api.updateProfile = async (patch) => {
    const { error } = await sb.from('profiles').update(patch).eq('id', api.user.id);
    if (error) throw error;
    await api.loadProfile(); api.emit();
  };
  api.uploadAvatar = async (blob) => {
    const path = `${api.user.id}/avatars/${Date.now()}-${crypto.randomUUID()}.jpg`;
    const up = await sb.storage.from('record-images').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const { data } = sb.storage.from('record-images').getPublicUrl(path);
    await api.updateProfile({ avatar_url: data.publicUrl });
  };
  api.deletePost = async (id) => {
    const { error } = await sb.from('posts').delete().eq('id', id).eq('user_id', api.user.id);
    if (error) throw error;
  };

  api.magazines = async () => {
    const { data, error } = await sb.from('magazines').select('id,title,summary,cover_url,published_at,created_at,magazine_slides(id,image_url,title,body,position)').eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false }).limit(30);
    if (error) return [];
    return data.map((m) => ({ ...m, slides: (m.magazine_slides || []).sort((a, b) => a.position - b.position) }));
  };

  api.notifPrefs = async () => {
    if (!api.user) return null;
    const { data } = await sb.from('notification_preferences').select('notices,follows,likes,comments,support').eq('user_id', api.user.id).maybeSingle();
    return data || { notices: true, follows: true, likes: true, comments: true, support: true };
  };
  api.saveNotifPrefs = async (next) => {
    const { error } = await sb.from('notification_preferences').upsert({ user_id: api.user.id, ...next, updated_at: new Date().toISOString() });
    if (error) throw error;
  };
  api.setPrivate = (on) => api.updateProfile({ is_private: !!on });
  api.deleteAccount = async () => {
    const r = await sb.functions.invoke('delete-account', { body: { confirmation: '탈퇴' } });
    if (r.error || r.data?.error) throw new Error(r.data?.error || '탈퇴하지 못했어요.');
    await sb.auth.signOut();
  };
  api.support = async (category, body) => {
    const { error } = await sb.from('support_requests').insert({ user_id: api.user.id, type: category, message: body });
    if (error) throw error;
  };
})(window.archApi);

/* people + collections for profile pages */
(function (api) {
  const sb = api.sb;
  api.people = async (userId) => {
    const [a, b] = await Promise.all([
      sb.from('follows').select('follower_id').eq('following_id', userId),
      sb.from('follows').select('following_id').eq('follower_id', userId)
    ]);
    const fIds = (a.data || []).map((r) => r.follower_id), gIds = (b.data || []).map((r) => r.following_id);
    const all = [...new Set(fIds.concat(gIds))];
    const { data } = all.length ? await sb.from('profiles').select('id,nickname,username,is_private').in('id', all) : { data: [] };
    const by = new Map((data || []).map((p) => [p.id, { id: p.id, name: p.nickname || '여행자', handle: p.username || '', priv: !!p.is_private }]));
    return { followers: fIds.map((id) => by.get(id)).filter(Boolean), following: gIds.map((id) => by.get(id)).filter(Boolean) };
  };
  api.collections = async (userId) => {
    const { data, error } = await sb.from('collections').select('id,title,description,visibility,cover_url,created_at,collection_items(id,post_id)').eq('user_id', userId).order('created_at', { ascending: false });
    return error ? [] : data;
  };
})(window.archApi);

/* notifications, saves, collections, blocks, reports, search, export */
(function (api) {
  const sb = api.sb;
  const need = () => { if (!api.user) throw new Error('로그인이 필요해요.'); return api.user.id; };

  // notifications (written by database triggers on likes, comments, follows, support replies)
  api.notifs = [];
  api.loadNotifs = async () => {
    if (!api.user) { api.notifs = []; return api.notifs; }
    const { data } = await sb.from('user_notifications').select('id,type,body,related_post_id,read_at,created_at,actor_id').eq('user_id', api.user.id).order('created_at', { ascending: false }).limit(40);
    const rows = data || [];
    const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
    const pids = [...new Set(rows.map((r) => r.related_post_id).filter(Boolean))];
    const [{ data: ps }, { data: posts }] = await Promise.all([
      ids.length ? sb.from('profiles').select('id,nickname,username').in('id', ids) : { data: [] },
      pids.length ? sb.from('posts').select('id,place_name').in('id', pids) : { data: [] }
    ]);
    const by = new Map((ps || []).map((p) => [p.id, p])), pl = new Map((posts || []).map((p) => [p.id, p.place_name]));
    const day = 86400000;
    api.notifs = rows.map((r) => {
      const p = by.get(r.actor_id) || {};
      const age = Date.now() - new Date(r.created_at);
      return { id: r.id, type: r.type, who: p.nickname || (r.type === 'support' ? 'arch;' : '여행자'), handle: p.username || '', userId: r.actor_id, postId: r.related_post_id,
        place: pl.get(r.related_post_id) || '', text: r.type === 'comment' || r.type === 'support' ? r.body : '', time: api.relTime(r.created_at),
        group: age < day ? '오늘' : age < 7 * day ? '이번 주' : '이전', read: !!r.read_at, color: '#C8FF42', rec: 0 };
    });
    api.emit();
    return api.notifs;
  };
  api.markNotifs = async (ids) => {
    if (!api.user || !ids.length) return;
    await sb.from('user_notifications').update({ read_at: new Date().toISOString() }).in('id', ids).eq('user_id', api.user.id);
    api.notifs.forEach((n) => { if (ids.includes(n.id)) n.read = true; });
  };

  // saved posts, places and curations (public.user_saves)
  api.isSaveBox = () => false;
  api.saves = async (kind) => {
    if (!api.user) return [];
    const { data } = await sb.from('user_saves').select('key,data,created_at').eq('user_id', api.user.id).eq('kind', kind).order('created_at', { ascending: false });
    return (data || []).map((r) => ({ post_id: kind === 'post' ? r.key : null, place_id: r.key, title: r.data.title || null, place_name: r.data.place || null, place_address: r.data.address || null, latitude: r.data.lat ?? null, longitude: r.data.lng ?? null, created_at: r.created_at }));
  };
  api.save = async (kind, key, info = {}) => {
    const data = {};
    ['title', 'place', 'address', 'lat', 'lng'].forEach((k) => { if (info[k] !== undefined && info[k] !== null) data[k] = info[k]; });
    const { error } = await sb.from('user_saves').insert({ user_id: need(), kind, key: String(key), data });
    if (error && error.code !== '23505') throw error;
  };
  api.unsave = async (kind, key) => {
    const { error } = await sb.from('user_saves').delete().eq('user_id', need()).eq('kind', kind).eq('key', String(key));
    if (error) throw error;
  };

  // follow requests for private accounts
  api.followState = async (userId) => {
    if (!api.user) return false;
    const [f, r] = await Promise.all([
      sb.from('follows').select('following_id').eq('follower_id', api.user.id).eq('following_id', userId).maybeSingle(),
      sb.from('follow_requests').select('target_id').eq('requester_id', api.user.id).eq('target_id', userId).maybeSingle()
    ]);
    return f.data ? true : r.data ? 'requested' : false;
  };
  api.requestFollow = async (userId) => {
    const { error } = await sb.from('follow_requests').insert({ requester_id: need(), target_id: userId });
    if (error && error.code !== '23505') throw error;
  };
  api.cancelRequest = async (userId) => {
    const { error } = await sb.from('follow_requests').delete().eq('requester_id', need()).eq('target_id', userId);
    if (error) throw error;
  };
  api.acceptRequest = async (userId) => {
    need();
    const { error } = await sb.rpc('arch_accept_follow_request', { requester: userId });
    if (error) throw error;
  };
  api.declineRequest = async (userId) => {
    const { error } = await sb.from('follow_requests').delete().eq('requester_id', userId).eq('target_id', need());
    if (error) throw error;
  };
  // one call for every follow button: public accounts follow at once, private ones get a request
  api.setFollow = async (userId, current, isPrivate) => {
    if (current === true) return api.toggleFollow(userId, true).then(() => false);
    if (current === 'requested') return api.cancelRequest(userId).then(() => false);
    if (isPrivate) return api.requestFollow(userId).then(() => 'requested');
    return api.toggleFollow(userId, false).then(() => true);
  };

  // collection cover image
  api.uploadCover = async (collectionId, blob) => {
    const path = `${need()}/covers/${collectionId}-${Date.now()}.jpg`;
    const up = await sb.storage.from('record-images').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const { data } = sb.storage.from('record-images').getPublicUrl(path);
    const { error } = await sb.from('collections').update({ cover_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', collectionId).eq('user_id', api.user.id);
    if (error) throw error;
    return api.photoUrl(data.publicUrl);
  };
  api.removeCover = async (collectionId) => {
    const { error } = await sb.from('collections').update({ cover_url: null }).eq('id', collectionId).eq('user_id', need());
    if (error) throw error;
  };

  // collections the user makes by hand
  api.createCollection = async ({ title, desc, vis }) => {
    const { data, error } = await sb.from('collections').insert({ user_id: need(), title: title.trim().slice(0, 40), description: (desc || '').slice(0, 180) || null, visibility: vis || 'public' }).select('id').single();
    if (error) throw error;
    return data.id;
  };
  api.updateCollection = async (id, { title, desc, vis }) => {
    const patch = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = title.trim().slice(0, 40);
    if (desc !== undefined) patch.description = (desc || '').slice(0, 180) || null;
    if (vis !== undefined) patch.visibility = vis;
    const { error } = await sb.from('collections').update(patch).eq('id', id).eq('user_id', need());
    if (error) throw error;
  };
  api.deleteCollection = async (id) => {
    const { error } = await sb.from('collections').delete().eq('id', id).eq('user_id', need());
    if (error) throw error;
  };
  api.setCollectionPosts = async (id, postIds) => {
    need();
    const { data } = await sb.from('collection_items').select('id,post_id').eq('collection_id', id).eq('item_type', 'post');
    const have = new Map((data || []).map((r) => [r.post_id, r.id]));
    const drop = [...have].filter(([pid]) => !postIds.includes(pid)).map(([, rid]) => rid);
    const add = postIds.filter((pid) => !have.has(pid)).map((pid, i) => ({ collection_id: id, item_type: 'post', post_id: pid, position: i }));
    if (drop.length) { const r = await sb.from('collection_items').delete().in('id', drop); if (r.error) throw r.error; }
    if (add.length) { const r = await sb.from('collection_items').insert(add); if (r.error) throw r.error; }
  };

  // posts
  api.updatePost = async (id, caption) => {
    const { error } = await sb.from('posts').update({ caption: caption.slice(0, 60) }).eq('id', id).eq('user_id', need());
    if (error) throw error;
  };

  // blocks
  api.blocks = async () => {
    if (!api.user) return [];
    const { data } = await sb.from('user_blocks').select('blocked_id,created_at').eq('blocker_id', api.user.id);
    const ids = (data || []).map((r) => r.blocked_id);
    const { data: ps } = ids.length ? await sb.from('profiles').select('id,nickname,username').in('id', ids) : { data: [] };
    return (ps || []).map((p) => ({ id: p.id, name: p.nickname || '여행자', handle: p.username || '' }));
  };
  api.block = async (userId) => {
    const { error } = await sb.from('user_blocks').insert({ blocker_id: need(), blocked_id: userId });
    if (error && error.code !== '23505') throw error;
    await sb.from('follows').delete().eq('follower_id', api.user.id).eq('following_id', userId);
  };
  api.unblock = async (userId) => {
    const { error } = await sb.from('user_blocks').delete().eq('blocker_id', need()).eq('blocked_id', userId);
    if (error) throw error;
  };

  // reports
  api.report = async (post, reason, details) => {
    const { error } = await sb.from('reports').insert({ reporter_id: need(), target_post_id: post.id, reason, details: details || null, target_snapshot: { caption: post.caption || '', place: post.place || '', author: post.handle || '' } });
    if (error) throw error;
  };
  api.myReports = async () => {
    if (!api.user) return [];
    const { data } = await sb.from('reports').select('id,reason,status,created_at,target_snapshot').eq('reporter_id', api.user.id).order('created_at', { ascending: false });
    return data || [];
  };

  // search
  api.search = async (q) => {
    const t = q.trim().replace(/[%,()]/g, ' ');
    if (!t) return { posts: [], people: [] };
    const like = '%' + t + '%';
    const [posts, people] = await Promise.all([
      sb.from('posts').select('id,user_id,caption,place_name,created_at').eq('is_hidden', false).or(`caption.ilike.${like},place_name.ilike.${like},place_address.ilike.${like}`).order('created_at', { ascending: false }).limit(30),
      sb.from('profiles').select('id,nickname,username,is_private').or(`nickname.ilike.${like},username.ilike.${like}`).limit(20)
    ]);
    return { posts: posts.data || [], people: people.data || [] };
  };
  api.usernameTaken = async (name) => {
    const n = String(name || '').replace(/^@/, '').toLowerCase();
    if (!n) return false;
    const { data } = await sb.from('profiles').select('id').eq('username', n).maybeSingle();
    return !!data && data.id !== api.user?.id;
  };

  // export: the signed-in user's own records and collections
  api.exportData = async ({ posts = true, colls = true, fmt = 'json' } = {}) => {
    const uid = need();
    const out = {};
    if (posts) out.records = (await sb.from('posts').select('id,caption,place_name,place_address,latitude,longitude,visibility,created_at').eq('user_id', uid).order('created_at')).data || [];
    if (colls) out.collections = ((await sb.from('collections').select('id,title,description,visibility,created_at,collection_items(item_type,post_id,place_name,place_address)').eq('user_id', uid)).data || []).filter((c) => !api.isSaveBox(c));
    let text, type;
    if (fmt === 'csv') {
      const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const lines = [['종류', '제목/글', '장소', '주소', '공개 범위', '날짜'].map(esc).join(',')];
      (out.records || []).forEach((r) => lines.push(['기록', r.caption, r.place_name, r.place_address, r.visibility, r.created_at].map(esc).join(',')));
      (out.collections || []).forEach((c) => lines.push(['컬렉션', c.title, '', '', c.visibility, c.created_at].map(esc).join(',')));
      text = '﻿' + lines.join('\n'); type = 'text/csv';
    } else { text = JSON.stringify(out, null, 2); type = 'application/json'; }
    return URL.createObjectURL(new Blob([text], { type }));
  };

  api.onChange(() => { if (api.user && !api.__notifFor) { api.__notifFor = api.user.id; api.loadNotifs(); } if (!api.user) api.__notifFor = null; });
})(window.archApi);

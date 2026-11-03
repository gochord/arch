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
      const { data } = await sb.from('profiles').select('id,nickname,username,avatar_url,bio,interests,is_private,onboarding_completed').eq('id', api.user.id).maybeSingle();
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
        ids.length ? sb.from('profiles').select('id,nickname,username,avatar_url').in('id', ids) : { data: [] },
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
          following: following.has(r.user_id)
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

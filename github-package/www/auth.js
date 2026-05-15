(function () {
  function client() {
    return window.EngeramaSupabase?.client || null;
  }

  function emailFromLogin(login) {
    const value = String(login || '').trim();
    return value.includes('@') ? value : value.toLowerCase() + '@engerama.local';
  }

  function orgId() {
    return String(window.ENGERAMA_CONFIG?.orgId || '00000000-0000-4000-8000-000000000001');
  }

  async function currentSession() {
    const sb = client();
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function currentUser() {
    const session = await currentSession();
    return session?.user || null;
  }

  async function signIn(login, password) {
    const sb = client();
    if (!sb) throw new Error('Supabase indisponivel');
    const email = emailFromLogin(login);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = data.user;
    const { data: profile } = await sb
      .from('profiles')
      .select('username,role,phone,all_projects,project_ids,modules')
      .eq('id', user.id)
      .maybeSingle()
      .catch(() => ({ data: null }));
    const username = user?.user_metadata?.username || String(login || '').trim();
    return {
      id: user.id,
      email: user.email,
      username: profile?.username || username,
      role: profile?.role || user?.user_metadata?.role || 'viewer',
      phone: profile?.phone || user?.user_metadata?.phone || '',
      active: user?.user_metadata?.active !== false,
      allProjects: profile?.all_projects === true || user?.user_metadata?.allProjects === true,
      projectIds: Array.isArray(profile?.project_ids) ? profile.project_ids : (Array.isArray(user?.user_metadata?.projectIds) ? user.user_metadata.projectIds : []),
      modules: Array.isArray(profile?.modules) ? profile.modules : (Array.isArray(user?.user_metadata?.modules) ? user.user_metadata.modules : ['insumos']),
      _supabaseAuthenticated: true
    };
  }

  async function signOut() {
    const sb = client();
    if (!sb) return;
    await sb.auth.signOut();
  }

  async function ensureProfile(profile) {
    const sb = client();
    const user = await currentUser();
    if (!sb || !user) return null;
    const payload = {
      id: user.id,
      org_id: orgId(),
      username: profile.username || user.email,
      role: profile.role || 'viewer',
      phone: profile.phone || '',
      all_projects: profile.allProjects === true,
      project_ids: Array.isArray(profile.projectIds) ? profile.projectIds : [],
      modules: Array.isArray(profile.modules) ? profile.modules : ['insumos'],
      updated_at: new Date().toISOString()
    };
    const { data, error } = await sb.from('profiles').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return data;
  }

  window.EngeramaAuth = {
    emailFromLogin,
    currentSession,
    currentUser,
    signIn,
    signOut,
    ensureProfile
  };
})();

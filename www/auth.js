(function () {
  function client() {
    return window.EngeramaSupabase?.client || null;
  }
  function orgId() {
    return String(window.ENGERAMA_CONFIG?.orgId || '00000000-0000-4000-8000-000000000001');
  }
  function emailFromLogin(login) {
    const value = String(login || '').trim();
    return value.includes('@') ? value : value.toLowerCase() + '@engerama.local';
  }
  function resetRedirectUrl() {
    const href = window.location.href.split('#')[0].split('?')[0];
    return href || window.location.origin || undefined;
  }
  async function currentSession() {
    const sb = client();
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }
  async function currentUser() {
    const sb = client();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }
  function mapUsuario(row) {
    const role = row.perfil || 'visualizador';
    const defaultModules = role === 'admin'
      ? ['obras', 'relatorio', 'insumos', 'usuarios']
      : role === 'compras'
        ? ['insumos']
        : role === 'financeiro'
          ? ['relatorio']
          : role === 'obra'
            ? ['obras', 'insumos']
            : [];
    return {
      id: row.id,
      empresaId: row.empresa_id,
      username: row.username || row.email,
      email: row.email,
      role,
      phone: row.telefone || '',
      active: row.ativo !== false,
      allProjects: row.todas_obras === true,
      projectIds: Array.isArray(row.obras_permitidas) ? row.obras_permitidas : [],
      modules: Array.isArray(row.modulos) ? row.modulos : defaultModules,
      _supabaseAuthenticated: true
    };
  }
  async function setupFirstAdmin(authUser, login) {
    const sb = client();
    const email = authUser?.email || emailFromLogin(login);
    const username = String(login || email || 'admin').includes('@')
      ? String(email || 'admin').split('@')[0]
      : String(login || 'admin').trim();
    const nome = authUser?.user_metadata?.name || authUser?.user_metadata?.nome || username || 'Administrador';
    const telefone = authUser?.user_metadata?.phone || authUser?.user_metadata?.telefone || null;
    const { data, error } = await sb.rpc('setup_first_admin', {
      p_username: username,
      p_nome: nome,
      p_email: email,
      p_telefone: telefone
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }
  async function ensureCurrentUsuario(authUser, login) {
    const sb = client();
    const email = authUser?.email || emailFromLogin(login);
    const username = String(login || email || '').includes('@')
      ? String(email || '').trim()
      : String(login || email || '').trim();
    const nome = authUser?.user_metadata?.name || authUser?.user_metadata?.nome || username || email;
    const telefone = authUser?.user_metadata?.phone || authUser?.user_metadata?.telefone || null;
    const { data, error } = await sb.rpc('ensure_current_usuario', {
      p_username: username || email,
      p_nome: nome || username || email,
      p_telefone: telefone
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }
  async function fetchUsuario(authUser) {
    const sb = client();
    if (!sb || !authUser) return null;
    const { data, error } = await sb
      .from('usuarios')
      .select('*')
      .eq('id', authUser.id)
      .eq('empresa_id', orgId())
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
  async function profileFromAuthUser(authUser, login, createFirstAdmin = true) {
    let usuario = await fetchUsuario(authUser);
    if (!usuario && createFirstAdmin) {
      try {
        usuario = await ensureCurrentUsuario(authUser, login);
      } catch(ensureError) {
        try {
          usuario = await setupFirstAdmin(authUser, login);
        } catch(adminError) {
          throw ensureError;
        }
      }
    }
    if (!usuario) throw new Error('Usuario autenticado sem permissao nesta empresa.');
    if (usuario.ativo === false) throw new Error('Usuario inativo.');
    window.EngeramaAuth._lastUserId = authUser.id;
    return mapUsuario(usuario);
  }
  async function signIn(login, password) {
    const sb = client();
    if (!sb) throw new Error('Supabase indisponivel');
    const email = emailFromLogin(login);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return profileFromAuthUser(data.user, login, true);
  }
  async function signUp(login, password, metadata = {}) {
    const sb = client();
    if (!sb) throw new Error('Supabase indisponivel');
    const previousSession = await currentSession().catch(() => null);
    const previousUserId = previousSession?.user?.id || null;
    const email = emailFromLogin(login);
    const username = String(metadata.username || login || email).includes('@')
      ? String(email).split('@')[0]
      : String(metadata.username || login || '').trim();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          nome: metadata.nome || metadata.name || username,
          telefone: metadata.telefone || metadata.phone || ''
        },
        emailRedirectTo: resetRedirectUrl()
      }
    });
    if (error) throw error;
    const afterUser = await currentUser().catch(() => null);
    if (previousSession?.access_token && afterUser?.id && afterUser.id !== previousUserId) {
      await sb.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token
      }).catch(() => null);
    }
    let profile = null;
    if (!previousUserId && data.user && data.session) {
      profile = await profileFromAuthUser(data.user, login, true);
    }
    return {
      user: data.user || null,
      session: data.session || null,
      profile,
      emailConfirmationRequired: !!data.user && !data.session
    };
  }
  async function restoreSession() {
    const user = await currentUser();
    if (!user) return null;
    return profileFromAuthUser(user, user.email, false);
  }
  async function resetPassword(login) {
    const sb = client();
    if (!sb) throw new Error('Supabase indisponivel');
    const email = emailFromLogin(login);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl()
    });
    if (error) throw error;
    return true;
  }
  async function updatePassword(newPassword) {
    const sb = client();
    if (!sb) throw new Error('Supabase indisponivel');
    const { data, error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data.user || null;
  }
  async function signOut() {
    const sb = client();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }
  function onAuthStateChange(callback) {
    const sb = client();
    if (!sb || typeof callback !== 'function') return () => {};
    const { data } = sb.auth.onAuthStateChange((event, session) => callback(event, session));
    return () => data?.subscription?.unsubscribe?.();
  }
  async function ensureProfile() {
    return null;
  }
  window.EngeramaAuth = {
    emailFromLogin,
    currentSession,
    currentUser,
    signUp,
    signIn,
    restoreSession,
    resetPassword,
    updatePassword,
    signOut,
    onAuthStateChange,
    ensureProfile,
    _lastUserId: null
  };
})();

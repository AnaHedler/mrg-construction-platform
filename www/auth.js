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
  function mapUsuario(row) {
    return {
      id: row.id,
      empresaId: row.empresa_id,
      username: row.username || row.email,
      email: row.email,
      role: row.perfil || 'visualizador',
      phone: row.telefone || '',
      active: row.ativo !== false,
      allProjects: row.todas_obras === true,
      projectIds: Array.isArray(row.obras_permitidas) ? row.obras_permitidas : [],
      modules: Array.isArray(row.modulos) ? row.modulos : ['insumos'],
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
  async function signIn(login, password) {
    const sb = client();
    if (!sb) throw new Error('Supabase indisponivel');
    const email = emailFromLogin(login);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    let usuario = await fetchUsuario(data.user);
    if (!usuario) {
      usuario = await setupFirstAdmin(data.user, login);
    }
    if (!usuario) throw new Error('Usuario autenticado sem permissao nesta empresa.');
    if (usuario.ativo === false) throw new Error('Usuario inativo.');
    window.EngeramaAuth._lastUserId = data.user.id;
    return mapUsuario(usuario);
  }
  async function restoreSession() {
    const session = await currentSession();
    const user = session?.user;
    if (!user) return null;
    const usuario = await fetchUsuario(user);
    if (!usuario) return null;
    if (usuario.ativo === false) throw new Error('Usuario inativo.');
    window.EngeramaAuth._lastUserId = user.id;
    return mapUsuario(usuario);
  }
  async function signOut() {
    const sb = client();
    if (!sb) return;
    await sb.auth.signOut();
  }
  async function ensureProfile() {
    return null;
  }
  window.EngeramaAuth = {
    emailFromLogin,
    currentSession,
    currentUser,
    signIn,
    restoreSession,
    signOut,
    ensureProfile,
    _lastUserId: null
  };
})();

(function () {
  const config = window.ENGERAMA_CONFIG || {};
  const url = String(config.supabaseUrl || '').trim();
  const anonKey = String(config.supabaseAnonKey || '').trim();

  function disabled(reason) {
    window.EngeramaSupabase = {
      enabled: false,
      reason,
      client: null
    };
  }

  if (!url || !anonKey) {
    disabled('Supabase nao configurado.');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    disabled('Biblioteca Supabase indisponivel. App seguira com localStorage.');
    return;
  }

  const client = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'engerama_supabase_session'
    }
  });

  window.EngeramaSupabase = {
    enabled: true,
    reason: '',
    client
  };
})();

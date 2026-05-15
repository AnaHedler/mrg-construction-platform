(function () {
  const TABLE = 'app_records';
  const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

  function orgId() {
    return String(window.ENGERAMA_CONFIG?.orgId || DEFAULT_ORG_ID);
  }

  function sb() {
    return window.EngeramaSupabase?.client || null;
  }

  function isEnabled() {
    return !!(window.EngeramaSupabase?.enabled && sb());
  }

  async function user() {
    return window.EngeramaAuth?.currentUser ? window.EngeramaAuth.currentUser() : null;
  }

  async function isSignedIn() {
    return !!(await user());
  }

  function collectionKey(collection, item) {
    if (collection === 'projects') return item.id;
    if (collection === 'users') return item.username;
    if (collection === 'insumoOrders') return item.id;
    if (collection === 'insumoUnits') return item;
    return item.id || item.key || item.username;
  }

  function rowsFromState(state, ownerId, companyOrgId) {
    const rows = [];
    ['projects', 'users', 'insumoOrders'].forEach(collection => {
      const items = Array.isArray(state?.[collection]) ? state[collection] : [];
      items.forEach(item => {
        const recordKey = collectionKey(collection, item);
        if (!recordKey) return;
        const data = collection === 'users'
          ? sanitizeUserForCloud(item)
          : { ...item, updatedAt: item.updatedAt || new Date().toISOString() };
        rows.push({
          owner_id: ownerId,
          org_id: companyOrgId,
          collection,
          record_key: String(recordKey),
          data,
          updated_at: data.updatedAt || new Date().toISOString()
        });
      });
    });
    const units = Array.isArray(state?.insumoUnits) ? state.insumoUnits : [];
    units.forEach(unit => {
      if (!unit) return;
      rows.push({
        owner_id: ownerId,
        org_id: companyOrgId,
        collection: 'insumoUnits',
        record_key: String(unit),
        data: { value: String(unit), updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString()
      });
    });
    return rows;
  }

  function sanitizeUserForCloud(item) {
    const copy = { ...item };
    delete copy.password;
    copy.updatedAt = copy.updatedAt || new Date().toISOString();
    return copy;
  }

  function stateFromRows(rows) {
    const state = { projects: [], users: [], insumoOrders: [], insumoUnits: [] };
    (rows || []).forEach(row => {
      const data = row.data || {};
      if (row.collection === 'projects') state.projects.push(data);
      if (row.collection === 'users') state.users.push(data);
      if (row.collection === 'insumoOrders') state.insumoOrders.push(data);
      if (row.collection === 'insumoUnits') state.insumoUnits.push(data.value || row.record_key);
    });
    return state;
  }

  async function fetchState() {
    const client = sb();
    const authUser = await user();
    if (!client || !authUser) throw new Error('Sem sessao Supabase');
    const { data, error } = await client
      .from(TABLE)
      .select('collection,record_key,data,updated_at')
      .eq('org_id', orgId())
      .order('updated_at', { ascending: true });
    if (error) throw error;
    return stateFromRows(data);
  }

  async function syncState(state) {
    const client = sb();
    const authUser = await user();
    if (!client || !authUser) throw new Error('Sem sessao Supabase');
    const rows = rowsFromState(state, authUser.id, orgId());
    if (rows.length) {
      const { error } = await client
        .from(TABLE)
        .upsert(rows, { onConflict: 'org_id,collection,record_key' });
      if (error) throw error;
    }
    return fetchState();
  }

  window.EngeramaAPI = {
    isEnabled,
    isSignedIn,
    fetchState,
    syncState
  };
})();

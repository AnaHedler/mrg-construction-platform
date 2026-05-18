(function () {
  const DEFAULT_EMPRESA_ID = '00000000-0000-4000-8000-000000000001';

  function sb() {
    return window.EngeramaSupabase?.client || null;
  }
  function isEnabled() {
    return !!(window.EngeramaSupabase?.enabled && sb());
  }
  async function authUser() {
    return window.EngeramaAuth?.currentUser ? window.EngeramaAuth.currentUser() : null;
  }
  async function isSignedIn() {
    return !!(await authUser());
  }
  function empresaId(profile) {
    return String(profile?.empresa_id || window.ENGERAMA_CONFIG?.orgId || DEFAULT_EMPRESA_ID);
  }
  function isWriter(profile) {
    return ['admin', 'compras', 'financeiro', 'obra'].includes(String(profile?.perfil || profile?.role || ''));
  }
  function canWriteObras(profile) {
    return ['admin', 'financeiro'].includes(String(profile?.perfil || profile?.role || ''));
  }
  function canWriteUsers(profile) {
    return String(profile?.perfil || profile?.role || '') === 'admin';
  }
  function canReadFinance(profile) {
    return ['admin', 'financeiro'].includes(String(profile?.perfil || profile?.role || ''));
  }
  function roleToDb(role) {
    const value = String(role || 'visualizador').toLowerCase();
    return value === 'viewer' ? 'visualizador' : value;
  }
  function defaultModulesForRole(role) {
    const value = roleToDb(role);
    if (value === 'admin') return ['obras', 'relatorio', 'insumos', 'usuarios'];
    if (value === 'compras') return ['insumos'];
    if (value === 'financeiro') return ['relatorio'];
    if (value === 'obra') return ['obras', 'insumos'];
    return [];
  }
  function statusToDb(status) {
    if (status === 'em_rota') return 'em_rota';
    if (status === 'concluido') return 'concluido';
    if (status === 'cancelado') return 'cancelado';
    return 'pendente';
  }
  function userFromRow(row, obraUuidToExternal = new Map()) {
    return {
      id: row.id,
      username: row.username || row.email,
      email: row.email,
      phone: row.telefone || '',
      role: row.perfil || 'visualizador',
      active: row.ativo !== false,
      allProjects: row.todas_obras === true,
      projectIds: Array.isArray(row.obras_permitidas)
        ? row.obras_permitidas.map(id => obraUuidToExternal.get(String(id)) || id)
        : [],
      modules: Array.isArray(row.modulos) ? row.modulos : defaultModulesForRole(row.perfil),
      _supabaseAuthenticated: row.id === window.EngeramaAuth?._lastUserId
    };
  }
  function obraFromRow(row, includeFinance = false) {
    const dados = row.dados || {};
    const project = {
      ...dados,
      id: row.codigo_externo || row.id,
      supabaseId: row.id,
      nome: row.nome,
      codigo: row.codigo || dados.codigo || row.codigo_externo,
      status: row.status || dados.status || 'ativo',
      endereco: row.endereco || dados.endereco || '',
      cidade: row.cidade || dados.cidade || '',
      estado: row.estado || dados.estado || '',
      orcamento: Number(row.orcamento_total ?? dados.orcamento ?? 0),
      inicio: row.inicio || dados.inicio || '',
      termino: row.termino || dados.termino || '',
      descricao: row.descricao || dados.descricao || ''
    };
    if (!includeFinance) {
      project.orcamento = 0;
      project.medicoes = [];
      project.curva = [];
    }
    return project;
  }
  function obraToRow(project, companyId) {
    const data = { ...project };
    delete data.supabaseId;
    return {
      empresa_id: companyId,
      codigo_externo: String(project.id || project.codigo || crypto.randomUUID()),
      codigo: project.codigo || project.id || '',
      nome: project.nome || 'Obra sem nome',
      status: project.status || 'ativo',
      endereco: project.endereco || '',
      cidade: project.cidade || '',
      estado: project.estado || '',
      orcamento_total: Number(project.orcamento || 0),
      inicio: project.inicio || null,
      termino: project.termino || null,
      descricao: project.descricao || '',
      dados: data
    };
  }
  function pedidoFromRows(row, obraByUuid, items, compra, history) {
    const dados = row.dados || {};
    const obra = obraByUuid.get(row.obra_id);
    const mappedItems = items.map(item => ({
      material: item.material,
      quantidade: Number(item.quantidade || 0),
      unidade: item.unidade || 'peça',
      observacao: item.observacao || '',
      anexos: item.anexos || []
    }));
    return {
      ...dados,
      id: row.codigo_externo || row.id,
      supabaseId: row.id,
      obraId: obra?.codigo_externo || row.obra_id,
      numeroPedido: row.numero || dados.numeroPedido || row.codigo_externo,
      status: row.status || dados.status || 'pendente',
      observacao: row.observacao || dados.observacao || '',
      neededBy: row.precisa_em || dados.neededBy || '',
      attachments: row.anexos || dados.attachments || [],
      requestedBy: row.solicitado_por_nome || dados.requestedBy || '',
      requestedAt: row.solicitado_em || dados.requestedAt || row.created_at,
      receivedBy: row.recebido_por_nome || dados.receivedBy || '',
      receivedAt: row.recebido_em || dados.receivedAt || '',
      items: mappedItems.length ? mappedItems : (Array.isArray(dados.items) ? dados.items : []),
      material: mappedItems[0]?.material || dados.material || '',
      quantidade: mappedItems[0]?.quantidade || dados.quantidade || '',
      unidade: mappedItems[0]?.unidade || dados.unidade || '',
      fornecedor: compra?.fornecedor_nome || dados.fornecedor || '',
      boughtBy: compra?.comprador_nome || dados.boughtBy || '',
      boughtAt: compra?.created_at || dados.boughtAt || '',
      dataCompra: compra?.data_compra || dados.dataCompra || '',
      purchaseComment: compra?.comentario || dados.purchaseComment || '',
      purchaseAttachments: compra?.anexos || dados.purchaseAttachments || [],
      nfe: compra?.nfe_anexo || dados.nfe || null,
      supplierQuotes: dados.supplierQuotes || compra?.dados?.supplierQuotes || [],
      history: history.length ? history.map(item => ({
        action: item.acao,
        user: item.usuario_nome || '',
        at: item.created_at,
        detail: item.detalhes || ''
      })) : (Array.isArray(dados.history) ? dados.history : [])
    };
  }
  function pedidoToRow(order, companyId, obraUuid, userProfile) {
    const data = { ...order };
    delete data.supabaseId;
    return {
      empresa_id: companyId,
      obra_id: obraUuid,
      codigo_externo: String(order.id || order.numeroPedido || crypto.randomUUID()),
      numero: String(order.numeroPedido || order.id || ''),
      status: statusToDb(order.status),
      solicitado_por: userProfile?.id || null,
      solicitado_por_nome: order.requestedBy || userProfile?.username || userProfile?.nome || '',
      recebido_por_nome: order.receivedBy || '',
      observacao: order.observacao || '',
      precisa_em: order.neededBy || null,
      anexos: Array.isArray(order.attachments) ? order.attachments : [],
      dados: data,
      solicitado_em: order.requestedAt || order.createdAt || new Date().toISOString(),
      recebido_em: order.receivedAt || null
    };
  }
  function auditPayload(companyId, profile, tableName, recordId, action, detail, before = null, after = null) {
    return {
      empresa_id: companyId,
      usuario_id: profile?.id || null,
      usuario_nome: profile?.username || profile?.nome || '',
      tabela: tableName,
      registro_id: recordId || null,
      acao: action || 'alteracao',
      antes: before,
      depois: after,
      detalhes: detail || '',
      created_at: new Date().toISOString()
    };
  }
  function notificationPayload(companyId, order, pedidoId, action, detail) {
    const isPurchase = String(action || '').toLowerCase().includes('compra');
    const isReceive = String(action || '').toLowerCase().includes('receb');
    return {
      empresa_id: companyId,
      usuario_id: null,
      pedido_id: pedidoId || null,
      tipo: isPurchase ? 'compra' : (isReceive ? 'recebimento' : 'pedido'),
      titulo: isPurchase ? 'Compra registrada' : (isReceive ? 'Pedido recebido' : 'Novo pedido de material'),
      mensagem: 'Pedido ' + (order.numeroPedido || order.id || '') + ': ' + (detail || action || ''),
      dados: {
        pedido: order.numeroPedido || order.id || '',
        status: order.status || '',
        obraId: order.obraId || '',
        itens: Array.isArray(order.items) ? order.items : []
      }
    };
  }
  async function writeAuditAndNotifications(client, companyId, profile, order, pedidoId) {
    if (!Array.isArray(order.history) || !order.history.length) return;
    const unsynced = order.history.filter(item => !item.remoteAuditId && !item.auditSyncedAt);
    if (!unsynced.length) return;
    const audits = unsynced.map(item => auditPayload(
      companyId,
      profile,
      'pedidos',
      pedidoId,
      item.action,
      item.detail,
      null,
      { status: order.status || '', pedido: order.numeroPedido || order.id || '' }
    ));
    const { data: insertedAudits, error: auditError } = await client
      .from('auditoria')
      .insert(audits)
      .select('id,acao,created_at');
    if (auditError) throw auditError;
    unsynced.forEach((item, index) => {
      item.remoteAuditId = insertedAudits?.[index]?.id || null;
      item.auditSyncedAt = new Date().toISOString();
    });
    const notifyItems = unsynced.filter(item => /solicit|compra|receb/i.test(String(item.action || '')));
    if (notifyItems.length) {
      const notifications = notifyItems.map(item => notificationPayload(companyId, order, pedidoId, item.action, item.detail));
      const { error: notificationError } = await client.from('notificacoes').insert(notifications);
      if (notificationError) throw notificationError;
    }
    await client
      .from('pedidos')
      .update({ dados: { ...order, history: order.history }, updated_at: new Date().toISOString() })
      .eq('id', pedidoId);
  }
  async function profile() {
    const client = sb();
    const user = await authUser();
    if (!client || !user) throw new Error('Sem sessao Supabase');
    window.EngeramaAuth._lastUserId = user.id;
    const { data, error } = await client
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .eq('empresa_id', window.ENGERAMA_CONFIG?.orgId || DEFAULT_EMPRESA_ID)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Usuario autenticado sem cadastro em usuarios.');
    if (data.ativo === false) throw new Error('Usuario inativo.');
    return data;
  }
  async function fetchState() {
    const client = sb();
    const currentProfile = await profile();
    const companyId = empresaId(currentProfile);
    const usuariosQuery = canWriteUsers(currentProfile)
      ? client.from('usuarios').select('*').eq('empresa_id', companyId).order('username')
      : client.from('usuarios').select('*').eq('empresa_id', companyId).eq('id', currentProfile.id);
    const [usuariosRes, obrasRes, pedidosRes, itensRes, comprasRes, auditoriaRes, notificacoesRes] = await Promise.all([
      usuariosQuery,
      client.from('obras').select('*').eq('empresa_id', companyId).order('nome'),
      client.from('pedidos').select('*').eq('empresa_id', companyId).order('updated_at', { ascending: true }),
      client.from('itens_pedido').select('*').eq('empresa_id', companyId).order('ordem'),
      client.from('compras').select('*').eq('empresa_id', companyId),
      client.from('auditoria').select('*').eq('empresa_id', companyId).order('created_at', { ascending: true }).limit(800),
      client.from('notificacoes').select('*').eq('empresa_id', companyId).order('created_at', { ascending: false }).limit(100)
    ]);
    [usuariosRes, obrasRes, pedidosRes, itensRes, comprasRes, auditoriaRes, notificacoesRes].forEach(res => {
      if (res.error) throw res.error;
    });
    const obras = (obrasRes.data || []).map(row => obraFromRow(row, canReadFinance(currentProfile)));
    const obraByUuid = new Map((obrasRes.data || []).map(row => [row.id, row]));
    const obraUuidToExternal = new Map((obrasRes.data || []).map(row => [String(row.id), row.codigo_externo || row.id]));
    const itensByPedido = new Map();
    (itensRes.data || []).forEach(item => {
      if (!itensByPedido.has(item.pedido_id)) itensByPedido.set(item.pedido_id, []);
      itensByPedido.get(item.pedido_id).push(item);
    });
    const compraByPedido = new Map((comprasRes.data || []).map(row => [row.pedido_id, row]));
    const auditByPedido = new Map();
    (auditoriaRes.data || []).forEach(item => {
      if (!item.registro_id) return;
      const key = String(item.registro_id);
      if (!auditByPedido.has(key)) auditByPedido.set(key, []);
      auditByPedido.get(key).push(item);
    });
    return {
      profile: userFromRow(currentProfile, obraUuidToExternal),
      projects: obras,
      users: (usuariosRes.data || []).map(user => userFromRow(user, obraUuidToExternal)),
      insumoOrders: (pedidosRes.data || []).map(row => pedidoFromRows(
        row,
        obraByUuid,
        itensByPedido.get(row.id) || [],
        compraByPedido.get(row.id),
        auditByPedido.get(String(row.id)) || []
      )),
      insumoUnits: ['metro linear','metro','m²','quilo','peça','litro'],
      notificacoes: notificacoesRes.data || []
    };
  }
  async function syncState(state) {
    const client = sb();
    const currentProfile = await profile();
    const companyId = empresaId(currentProfile);
    const obraMap = new Map();
    if (canWriteObras(currentProfile) && Array.isArray(state?.projects) && state.projects.length) {
      const rows = state.projects.map(project => obraToRow(project, companyId));
      const { data, error } = await client
        .from('obras')
        .upsert(rows, { onConflict: 'empresa_id,codigo_externo' })
        .select('id,codigo_externo');
      if (error) throw error;
      (data || []).forEach(row => obraMap.set(row.codigo_externo, row.id));
    } else {
      const { data } = await client.from('obras').select('id,codigo_externo').eq('empresa_id', companyId);
      (data || []).forEach(row => obraMap.set(row.codigo_externo, row.id));
    }
    if (canWriteUsers(currentProfile) && Array.isArray(state?.users)) {
      const userRows = state.users
        .filter(user => user.id && user.email)
        .map(user => ({
          id: user.id,
          empresa_id: companyId,
          username: user.username || user.email,
          nome: user.username || user.email,
          email: user.email,
          telefone: user.phone || '',
          perfil: roleToDb(user.role),
          ativo: user.active !== false,
          todas_obras: user.allProjects === true,
          obras_permitidas: Array.isArray(user.projectIds) ? user.projectIds.map(id => obraMap.get(id) || id).filter(Boolean) : [],
          modulos: Array.isArray(user.modules) ? user.modules : ['insumos']
        }));
      if (userRows.length) {
        const { error } = await client.from('usuarios').upsert(userRows, { onConflict: 'id' });
        if (error) throw error;
      }
    }
    if (isWriter(currentProfile) && Array.isArray(state?.insumoOrders)) {
      for (const order of state.insumoOrders) {
        const obraUuid = obraMap.get(order.obraId) || order.obraSupabaseId;
        if (!obraUuid) continue;
        const { data: pedido, error } = await client
          .from('pedidos')
          .upsert(pedidoToRow(order, companyId, obraUuid, currentProfile), { onConflict: 'empresa_id,codigo_externo' })
          .select('id')
          .single();
        if (error) throw error;
        const pedidoId = pedido.id;
        const items = Array.isArray(order.items) && order.items.length
          ? order.items
          : [{ material: order.material || 'Material', quantidade: order.quantidade || 1, unidade: order.unidade || 'peça' }];
        await client.from('itens_pedido').delete().eq('pedido_id', pedidoId);
        const itemRows = items.map((item, index) => ({
          empresa_id: companyId,
          pedido_id: pedidoId,
          material: item.material || 'Material',
          quantidade: Number(item.quantidade || 1),
          unidade: item.unidade || 'peça',
          observacao: item.observacao || '',
          anexos: item.anexos || [],
          ordem: index + 1,
          dados: item
        }));
        if (itemRows.length) {
          const { error: itemError } = await client.from('itens_pedido').insert(itemRows);
          if (itemError) throw itemError;
        }
        if (order.fornecedor || order.boughtBy || order.dataCompra || order.purchaseComment || order.nfe) {
          const { error: compraError } = await client.from('compras').upsert({
            empresa_id: companyId,
            pedido_id: pedidoId,
            comprador_id: currentProfile.id,
            comprador_nome: order.boughtBy || currentProfile.username || currentProfile.nome || '',
            fornecedor_nome: order.fornecedor || 'Fornecedor não informado',
            data_compra: order.dataCompra || new Date().toISOString().slice(0, 10),
            comentario: order.purchaseComment || '',
            anexos: Array.isArray(order.purchaseAttachments) ? order.purchaseAttachments : [],
            nfe_anexo: order.nfe || null,
            dados: { supplierQuotes: order.supplierQuotes || [] }
          }, { onConflict: 'pedido_id' });
          if (compraError) throw compraError;
        }
        await writeAuditAndNotifications(client, companyId, currentProfile, order, pedidoId);
      }
    }
    return fetchState();
  }
  function subscribeState(onChange) {
    const client = sb();
    if (!client) return () => {};
    const channel = client
      .channel('engerama-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obras' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auditoria' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, onChange)
      .subscribe();
    return () => client.removeChannel(channel);
  }
  async function deleteUsuario(userId) {
    const client = sb();
    const currentProfile = await profile();
    if (!canWriteUsers(currentProfile)) {
      throw new Error('Apenas administradores podem gerenciar usuarios.');
    }
    const { error } = await client.from('usuarios').delete().eq('id', userId);
    if (error) throw error;
    return fetchState();
  }
  async function upsertUsuarioPorEmail(user) {
    const client = sb();
    const currentProfile = await profile();
    if (!canWriteUsers(currentProfile)) {
      throw new Error('Apenas administradores podem gerenciar usuarios.');
    }
    const companyId = empresaId(currentProfile);
    const { data: obrasData, error: obrasError } = await client
      .from('obras')
      .select('id,codigo_externo')
      .eq('empresa_id', companyId);
    if (obrasError) throw obrasError;
    const obraMap = new Map((obrasData || []).map(row => [row.codigo_externo, row.id]));
    const permitted = Array.isArray(user.projectIds)
      ? user.projectIds.map(id => obraMap.get(id) || id).filter(Boolean)
      : [];
    const { error } = await client.rpc('admin_upsert_usuario_por_email', {
      p_email: user.email || user.username,
      p_username: user.username || user.email,
      p_nome: user.nome || user.username || user.email,
      p_telefone: user.phone || '',
      p_perfil: roleToDb(user.role),
      p_ativo: user.active !== false,
      p_todas_obras: user.allProjects === true,
      p_obras_permitidas: permitted,
      p_modulos: Array.isArray(user.modules) ? user.modules : defaultModulesForRole(user.role)
    });
    if (error) throw error;
    return fetchState();
  }
  async function deletePedido(orderId) {
    const client = sb();
    const currentProfile = await profile();
    const companyId = empresaId(currentProfile);
    const { error } = await client
      .from('pedidos')
      .delete()
      .eq('empresa_id', companyId)
      .eq('codigo_externo', String(orderId));
    if (error) throw error;
    return fetchState();
  }
  async function deleteTodosPedidos() {
    const client = sb();
    const currentProfile = await profile();
    if (String(currentProfile.perfil || currentProfile.role || '') !== 'admin') {
      throw new Error('Apenas administradores podem apagar todos os pedidos.');
    }
    const companyId = empresaId(currentProfile);
    const { error } = await client
      .from('pedidos')
      .delete()
      .eq('empresa_id', companyId);
    if (error) throw error;
    return fetchState();
  }
  window.EngeramaAPI = {
    isEnabled,
    isSignedIn,
    fetchState,
    syncState,
    subscribeState,
    deleteUsuario,
    upsertUsuarioPorEmail,
    deletePedido,
    deleteTodosPedidos
  };
})();

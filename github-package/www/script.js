
// ══ CONSTANTS ════════════════════════════════════════════════════════════
const LS_PROJECTS = 'engerama_projects_v3';
const LS_USERS = 'engerama_users_v2';
const LS_USERS_BACKUP = 'engerama_users_v2_backup';
const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DEFAULT_USERS = [
];
const APP_CONFIG = window.ENGERAMA_CONFIG || {};
function hashLocalPassword(password) {
  const input = 'engerama-local-v2|' + String(password || '');
  let h1 = 0x811c9dc5;
  let h2 = 0x45d9f3b;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x27d4eb2d) >>> 0;
  }
  return 'local-v2:' + h1.toString(36).padStart(7, '0') + h2.toString(36).padStart(7, '0');
}
function stripSensitiveUserFields(user) {
  const copy = { ...(user || {}) };
  if (!copy.passwordHash && copy.password) copy.passwordHash = hashLocalPassword(copy.password);
  delete copy.password;
  delete copy._supabaseAuthenticated;
  return copy;
}
function sanitizeUsersForStorage(users) {
  return (Array.isArray(users) ? users : []).map(stripSensitiveUserFields);
}
function userPasswordMatches(user, password) {
  if (!user) return false;
  if (user._supabaseAuthenticated) return true;
  return !!user.passwordHash && user.passwordHash === hashLocalPassword(password);
}
const LS_SYNC_PENDING = 'engerama_sync_pending_v1';
const LS_LAST_SYNC = 'engerama_last_sync_v1';
const ENGERAMA_CLIENT_ID = (() => {
  try {
    let id = localStorage.getItem('engerama_client_id');
    if (!id) {
      id = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
      localStorage.setItem('engerama_client_id', id);
    }
    return id;
  } catch(e) {
    return 'client_' + Date.now().toString(36);
  }
})();
let syncApplyingRemote = false;
let cloudSyncTimer = null;
let syncInFlight = false;

function loadPersistedJson(key, fallbackKey, fallbackValue, allowEmptyArray = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && (saved.length || allowEmptyArray)) return saved;
      if (saved && !Array.isArray(saved)) return saved;
    }
  } catch(e) {}
  try {
    const backupRaw = localStorage.getItem(fallbackKey);
    if (backupRaw !== null) {
      const backup = JSON.parse(backupRaw);
      if (Array.isArray(backup) && (backup.length || allowEmptyArray)) return backup;
      if (backup && !Array.isArray(backup)) return backup;
    }
  } catch(e) {}
  return fallbackValue;
}
function savePersistedJson(key, backupKey, value, label, silent = false) {
  try {
    const previous = localStorage.getItem(key);
    if (previous !== null && backupKey) {
      try { localStorage.setItem(backupKey, previous); } catch(e) {}
    }
    localStorage.setItem(key, JSON.stringify(value));
    if (!syncApplyingRemote && typeof scheduleCloudSync === 'function') scheduleCloudSync();
    return true;
  } catch(e) {
    if (!silent && typeof showToast === 'function') {
      showToast('Nao foi possivel salvar ' + label + '. Verifique espaco do navegador/anexos muito grandes.', 'error');
    }
    return false;
  }
}

// ══ DEFAULT DATA (Hospital SJP) ══════════════════════════════════════════
const DEFAULT_CURVA = [
  {l:"Out/24",p:0,r:null,c:0.157},
  {l:"Nov/24",p:0.615,r:0.615,c:0.385},
  {l:"Dez/24",p:2.425,r:2.425,c:1.780},
  {l:"Jan/25",p:4.512,r:4.512,c:3.747},
  {l:"Fev/25",p:7.507,r:7.507,c:6.659},
  {l:"Mar/25",p:11.191,r:11.191,c:9.997},
  {l:"Abr/25",p:14.709,r:14.747,c:14.040},
  {l:"Mai/25",p:18.351,r:18.394,c:17.299},
  {l:"Jun/25",p:22.003,r:22.116,c:21.993},
  {l:"Jul/25",p:25.647,r:25.808,c:25.533},
  {l:"Ago/25",p:29.309,r:30.818,c:28.495},
  {l:"Set/25",p:32.988,r:35.971,c:32.189},
  {l:"Out/25",p:36.948,r:41.057,c:37.044},
  {l:"Nov/25",p:40.965,r:44.806,c:41.044},
  {l:"Dez/25",p:44.933,r:47.031,c:47.223},
  {l:"Jan/26",p:48.897,r:50.029,c:51.295},
  {l:"Fev/26",p:52.978,r:54.622,c:56.221},
  {l:"Mar/26",p:57.209,r:59.413,c:61.622},
  {l:"Abr/26",p:61.434,r:null,c:null},
  {l:"Mai/26",p:65.924,r:null,c:null},
  {l:"Jun/26",p:70.819,r:null,c:null},
  {l:"Jul/26",p:75.876,r:null,c:null},
  {l:"Ago/26",p:80.945,r:null,c:null},
  {l:"Set/26",p:85.898,r:null,c:null},
  {l:"Out/26",p:90.763,r:null,c:null},
  {l:"Nov/26",p:95.564,r:null,c:null},
  {l:"Dez/26",p:100.112,r:null,c:null},
  {l:"Jan/27",p:104.432,r:null,c:null},
  {l:"Fev/27",p:108.394,r:null,c:null},
  {l:"Mar/27",p:112.351,r:null,c:null},
  {l:"Abr/27",p:116.201,r:null,c:null},
  {l:"Mai/27",p:120.051,r:null,c:null},
  {l:"Jun/27",p:123.864,r:null,c:null},
  {l:"Jul/27",p:127.643,r:null,c:null},
  {l:"Ago/27",p:131.422,r:null,c:null},
  {l:"Set/27",p:134.827,r:null,c:null},
  {l:"Out/27",p:138.087,r:null,c:null},
  {l:"Nov/27",p:141.206,r:null,c:null},
  {l:"Dez/27",p:144.327,r:null,c:null},
  {l:"Jan/28",p:146.727,r:null,c:null},
  {l:"Fev/28",p:148.915,r:null,c:null},
  {l:"Mar/28",p:151.174,r:null,c:null},
  {l:"Abr/28",p:151.993,r:null,c:null},
  {l:"Mai/28",p:152.812,r:null,c:null},
  {l:"Jun/28",p:153.488,r:null,c:null},
  {l:"Jul/28",p:154.142,r:null,c:null},
  {l:"Ago/28",p:154.711,r:null,c:null},
  {l:"Set/28",p:154.990,r:null,c:null},
];

const DEFAULT_MEDICOES = [
  {n:1,mes:"Out 2024",receita:0,gasto:156892.78},
  {n:2,mes:"Nov 2024",receita:615161.51,gasto:227667.34},
  {n:3,mes:"Dez 2024",receita:1809480.44,gasto:1395670.96},
  {n:4,mes:"Jan 2025",receita:2087094.60,gasto:1967063.25},
  {n:5,mes:"Fev 2025",receita:2995246.40,gasto:2911938.92},
  {n:6,mes:"Mar 2025",receita:3684088.17,gasto:3337577.18},
  {n:7,mes:"Abr 2025",receita:3555551.70,gasto:4043094.52},
  {n:8,mes:"Mai 2025",receita:3647821.86,gasto:3259527.94},
  {n:9,mes:"Jun 2025",receita:3721240.56,gasto:4693434.90},
  {n:10,mes:"Jul 2025",receita:3692236.08,gasto:3540073.20},
  {n:11,mes:"Ago 2025",receita:5010164.46,gasto:2962517.92},
  {n:12,mes:"Set 2025",receita:5153338.37,gasto:3693903.24},
  {n:13,mes:"Out 2025",receita:5085352.85,gasto:4854248.64},
  {n:14,mes:"Nov 2025",receita:3749701.48,gasto:4000052.36},
  {n:15,mes:"Dez 2025",receita:2224174.07,gasto:6179331.56},
  {n:16,mes:"Jan 2026",receita:2998771.88,gasto:4071851.81},
  {n:17,mes:"Fev 2026",receita:4592589.98,gasto:4925825.32},
  {n:18,mes:"Mar 2026",receita:4791063.07,gasto:5401816.03},
  {n:19,mes:"Abr 2026",receita:null,gasto:1924314.17,current:true},
];

const DEFAULT_PROJECT = {
  id: 'sjp-001',
  nome: 'Hospital São José dos Pinhais',
  codigo: 'SJP-001',
  status: 'ativo',
  orcamento: 154990000,
  inicio: '2024-10-01',
  termino: '2028-09-30',
  descricao: 'Construção do Hospital de São José dos Pinhais — obra principal Engerama',
  medicoes: JSON.parse(JSON.stringify(DEFAULT_MEDICOES)),
  curva: JSON.parse(JSON.stringify(DEFAULT_CURVA)),
};

// ══ STATE ════════════════════════════════════════════════════════════════
let PROJECTS = loadProjects();
let USERS = loadUsers();
let currentProjectId = null;
let currentUser = '';
let curvaChart = null;
let currentPeriod = 48;
let editingProjectId = null;
let deletedProjectUndo = null;
let activeView = 'obras';
let viewHistory = [];
let suppressViewHistory = false;

function backendBaseUrl() {
  return String(APP_CONFIG.apiBaseUrl || '').trim().replace(/\/+$/, '');
}
function backendEnabled() {
  return !!(window.EngeramaAPI?.isEnabled?.() || backendBaseUrl());
}
async function backendRequest(path, options = {}) {
  const base = backendBaseUrl();
  if (!base) throw new Error('Backend nao configurado');
  const res = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Falha no backend');
  return data;
}
function currentCloudSnapshot() {
  return {
    projects: PROJECTS,
    users: sanitizeUsersForStorage(USERS),
    insumoOrders: typeof INSUMO_ORDERS !== 'undefined' ? INSUMO_ORDERS : [],
    insumoUnits: typeof INSUMO_UNITS !== 'undefined' ? INSUMO_UNITS : [],
    updatedAt: new Date().toISOString()
  };
}
function mergeByKey(localItems, remoteItems, keyName) {
  const map = new Map();
  [...(Array.isArray(localItems) ? localItems : []), ...(Array.isArray(remoteItems) ? remoteItems : [])].forEach(item => {
    const key = item?.[keyName];
    if (!key) return;
    const prev = map.get(key);
    const prevTime = Date.parse(prev?.updatedAt || prev?.createdAt || prev?.requestedAt || 0) || 0;
    const itemTime = Date.parse(item?.updatedAt || item?.createdAt || item?.requestedAt || 0) || 0;
    if (!prev || itemTime >= prevTime) map.set(key, item);
  });
  return Array.from(map.values());
}
function mergeUsersByUsername(localUsers, remoteUsers) {
  const byName = new Map();
  (Array.isArray(localUsers) ? localUsers : []).forEach(user => {
    if (user?.username) byName.set(String(user.username).toLowerCase(), user);
  });
  (Array.isArray(remoteUsers) ? remoteUsers : []).forEach(user => {
    if (!user?.username) return;
    const key = String(user.username).toLowerCase();
    const local = byName.get(key) || {};
    byName.set(key, {
      ...local,
      ...user,
      passwordHash: local.passwordHash || user.passwordHash || (local.password ? hashLocalPassword(local.password) : '') || (user.password ? hashLocalPassword(user.password) : ''),
      updatedAt: user.updatedAt || local.updatedAt || new Date().toISOString()
    });
  });
  return Array.from(byName.values());
}
function applyCloudSnapshot(snapshot, renderNow = false) {
  if (!snapshot || typeof snapshot !== 'object') return;
  syncApplyingRemote = true;
  try {
    if (Array.isArray(snapshot.projects)) PROJECTS = mergeByKey(PROJECTS, snapshot.projects, 'id');
    if (Array.isArray(snapshot.users)) USERS = normalizeUsers(mergeUsersByUsername(USERS, snapshot.users));
    if (Array.isArray(snapshot.insumoOrders) && typeof INSUMO_ORDERS !== 'undefined') {
      INSUMO_ORDERS = mergeByKey(INSUMO_ORDERS, snapshot.insumoOrders, 'id');
    }
    if (Array.isArray(snapshot.insumoUnits) && typeof INSUMO_UNITS !== 'undefined') {
      INSUMO_UNITS = Array.from(new Set([...INSUMO_UNITS, ...snapshot.insumoUnits])).filter(Boolean);
    }
    try { localStorage.setItem(LS_PROJECTS, JSON.stringify(PROJECTS)); } catch(e) {}
    try { localStorage.setItem(LS_USERS, JSON.stringify(USERS)); } catch(e) {}
    if (typeof LS_INSUMOS !== 'undefined') {
      try { localStorage.setItem(LS_INSUMOS, JSON.stringify(INSUMO_ORDERS)); } catch(e) {}
    }
    if (typeof LS_INSUMO_UNITS !== 'undefined') {
      try { localStorage.setItem(LS_INSUMO_UNITS, JSON.stringify(INSUMO_UNITS)); } catch(e) {}
    }
  } finally {
    syncApplyingRemote = false;
  }
  if (renderNow) refreshCurrentView();
}
function refreshCurrentView() {
  if (!document.body.classList.contains('chat-enabled')) return;
  applyNavPermissions();
  if (activeView === 'obras') renderDashboard();
  if (activeView === 'relatorio') renderRelatorio();
  if (activeView === 'insumos') renderInsumos();
  if (activeView === 'usuarios') renderUsers();
  if (activeView === 'detail') renderDetail();
}
function isNetworkOnline() {
  return navigator.onLine !== false;
}
function markCloudSyncPending(reason = 'alteracao') {
  try {
    localStorage.setItem(LS_SYNC_PENDING, JSON.stringify({
      pending: true,
      reason,
      at: new Date().toISOString()
    }));
  } catch(e) {}
}
function clearCloudSyncPending() {
  try { localStorage.removeItem(LS_SYNC_PENDING); } catch(e) {}
  try { localStorage.setItem(LS_LAST_SYNC, new Date().toISOString()); } catch(e) {}
}
function hasCloudSyncPending() {
  try { return !!localStorage.getItem(LS_SYNC_PENDING); } catch(e) { return false; }
}
function scheduleCloudSync(reason = 'alteracao') {
  if (syncApplyingRemote || !backendEnabled()) return;
  markCloudSyncPending(reason);
  if (!isNetworkOnline()) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(pushCloudSync, 700);
}
async function pushCloudSync() {
  if (!backendEnabled() || !isNetworkOnline() || syncInFlight) return;
  syncInFlight = true;
  try {
    if (window.EngeramaAPI?.isEnabled?.() && await window.EngeramaAPI.isSignedIn()) {
      const state = await window.EngeramaAPI.syncState(currentCloudSnapshot());
      applyCloudSnapshot(state, true);
      clearCloudSyncPending();
      return;
    }
    if (!backendBaseUrl()) return;
    const data = await backendRequest('/api/sync', {
      method: 'POST',
      body: JSON.stringify({clientId: ENGERAMA_CLIENT_ID, state: currentCloudSnapshot()})
    });
    applyCloudSnapshot(data.state || data.snapshot, true);
    clearCloudSyncPending();
  } catch(e) {
    console.warn('Sincronizacao online indisponivel:', e.message);
  } finally {
    syncInFlight = false;
  }
}
async function pullCloudSync(renderNow = true) {
  if (!backendEnabled() || !isNetworkOnline()) return;
  try {
    if (window.EngeramaAPI?.isEnabled?.() && await window.EngeramaAPI.isSignedIn()) {
      const state = await window.EngeramaAPI.fetchState();
      applyCloudSnapshot(state, renderNow);
      return;
    }
    if (!backendBaseUrl()) return;
    const data = await backendRequest('/api/state');
    applyCloudSnapshot(data.state || data.snapshot, renderNow);
  } catch(e) {
    console.warn('Nao foi possivel baixar dados online:', e.message);
  }
}
async function syncWhenPossible(reason = 'auto') {
  if (!backendEnabled() || !isNetworkOnline()) return;
  if (hasCloudSyncPending()) await pushCloudSync();
  await pullCloudSync(true);
}
async function loginWithBackend(username, password) {
  if (!backendEnabled()) return null;
  if (window.EngeramaSupabase?.enabled && window.EngeramaAuth?.signIn) {
    const user = await window.EngeramaAuth.signIn(username, password);
    USERS = normalizeUsers(mergeUsersByUsername(USERS, [{
      username: user.username,
      phone: user.phone,
      role: user.role,
      active: user.active,
      allProjects: user.allProjects,
      projectIds: user.projectIds,
      modules: user.modules,
      updatedAt: new Date().toISOString(),
      _supabaseAuthenticated: true
    }]));
    saveUsers();
    await window.EngeramaAuth.ensureProfile(user).catch(() => null);
    await pullCloudSync(false);
    return {...user, _supabaseAuthenticated: true};
  }
  const data = await backendRequest('/api/login', {
    method: 'POST',
    body: JSON.stringify({username, password, clientId: ENGERAMA_CLIENT_ID})
  });
  applyCloudSnapshot(data.state || data.snapshot, false);
  return data.user || null;
}

// ══ STORAGE ══════════════════════════════════════════════════════════════
function loadProjects() {
  try {
    const d = localStorage.getItem(LS_PROJECTS);
    if (d) return JSON.parse(d);
  } catch(e) {}
  return [JSON.parse(JSON.stringify(DEFAULT_PROJECT))];
}
function saveProjects() {
  try {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(PROJECTS));
    if (!syncApplyingRemote) scheduleCloudSync();
  } catch(e) {}
}
function normalizeUsers(users) {
  const allIds = PROJECTS.map(project => project.id);
  return users.map(user => {
    const admin = user.role === 'admin' || String(user.username || '').toLowerCase() === 'admin';
    const savedModules = Array.isArray(user.modules) ? user.modules : ['obras','relatorio','insumos'];
    const modules = admin ? ['obras','relatorio','insumos','usuarios'] : savedModules.filter(module => ['obras','relatorio','insumos'].includes(module));
    const savedProjectIds = Array.isArray(user.projectIds) ? user.projectIds.filter(id => allIds.includes(id)) : [];
    const allProjects = admin ? true : user.allProjects === true || !savedProjectIds.length;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      passwordHash: user.passwordHash || (user.password ? hashLocalPassword(user.password) : ''),
      phone: user.phone || user.celular || '',
      role: admin ? 'admin' : (user.role || 'viewer'),
      active: user.active !== false,
      allProjects,
      projectIds: admin || allProjects ? [] : savedProjectIds,
      modules: modules.length ? modules : ['insumos'],
    };
  });
}
function loadUsers() {
  const fallback = JSON.parse(JSON.stringify(DEFAULT_USERS));
  const normalized = normalizeUsers(loadPersistedJson(LS_USERS, LS_USERS_BACKUP, fallback, true));
  try { localStorage.setItem(LS_USERS, JSON.stringify(sanitizeUsersForStorage(normalized))); } catch(e) {}
  try { localStorage.removeItem(LS_USERS_BACKUP); } catch(e) {}
  return normalized;
}
function saveUsers() {
  USERS = normalizeUsers(sanitizeUsersForStorage(USERS));
  return savePersistedJson(LS_USERS, LS_USERS_BACKUP, USERS, 'usuarios');
}
function findUser(username) { return USERS.find(u => u.username.toLowerCase() === String(username).toLowerCase()); }
function normalizePhoneForWhatsApp(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) digits = '55' + digits;
  return digits;
}
function currentUserData() { return findUser(currentUser); }
function isAdmin() { return currentUserData()?.role === 'admin'; }
function userHasModule(module) {
  const user = currentUserData();
  if (!user) return false;
  if (module === 'usuarios') return isAdmin();
  if (user.role === 'admin') return true;
  const modules = Array.isArray(user.modules) ? user.modules : ['obras','relatorio','insumos'];
  return modules.includes(module);
}
function firstAllowedView() {
  if (userHasModule('obras')) return 'obras';
  if (userHasModule('insumos')) return 'insumos';
  if (userHasModule('relatorio')) return 'relatorio';
  if (isAdmin()) return 'obras';
  return 'insumos';
}
function applyNavPermissions() {
  const permissions = {
    obras: userHasModule('obras'),
    relatorio: userHasModule('relatorio'),
    insumos: userHasModule('insumos'),
    usuarios: isAdmin()
  };
  Object.entries(permissions).forEach(([id, allowed]) => {
    const nav = document.getElementById('nav-' + id);
    if (nav) nav.style.display = allowed ? 'flex' : 'none';
  });
  document.querySelectorAll('[onclick="openModalObra()"]').forEach(button => {
    button.style.display = isAdmin() ? '' : 'none';
  });
}
function visibleProjects() {
  const user = currentUserData();
  if (!user || user.role === 'admin' || user.allProjects) return PROJECTS;
  const allowed = new Set(user.projectIds || []);
  if (!allowed.size) return PROJECTS;
  return PROJECTS.filter(project => allowed.has(project.id));
}
function getProject(id) { return visibleProjects().find(p => p.id === id); }
function currentProject() { return getProject(currentProjectId) || visibleProjects()[0]; }

// ══ AUTH ═════════════════════════════════════════════════════════════════
async function doLogin() {
  const u = document.getElementById('inp-user').value.trim();
  const p = document.getElementById('inp-pass').value;
  const err = document.getElementById('login-err');
  let user = null;
  if (backendEnabled()) {
    try {
      user = await loginWithBackend(u, p);
    } catch(e) {
      showToast('Backend indisponivel. Tentando login local.', 'warn');
    }
  }
  user = user ? findUser(user.username || u) || user : findUser(u);
  if (user && userPasswordMatches(user, p) && user.active !== false) {
    err.style.display = 'none';
    currentUser = user.username;
    document.getElementById('topbar-user').textContent = user.username;
    document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('pt-BR');
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('page-app').classList.add('active');
    document.body.classList.add('chat-enabled');
    resetQuickChat();
    applyNavPermissions();
    showView(firstAllowedView());
    pullCloudSync(true);
  } else {
    err.style.display = 'block';
  }
}
function doLogout() {
  window.EngeramaAuth?.signOut?.().catch(() => null);
  document.getElementById('page-app').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  document.body.classList.remove('chat-enabled');
  viewHistory = [];
  activeView = 'obras';
  closeMobileMenu();
  toggleQuickChat(false);
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
}
document.getElementById('inp-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('inp-user').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

// ══ ROUTING ══════════════════════════════════════════════════════════════
function showView(v) {
  closeMobileMenu();
  if (v !== 'detail' && v !== 'usuarios' && !userHasModule(v)) v = firstAllowedView();
  if (v === 'usuarios' && !isAdmin()) v = firstAllowedView();
  if (v === 'detail' && !userHasModule('obras')) v = firstAllowedView();
  if (!suppressViewHistory && activeView && activeView !== v) {
    viewHistory.push(activeView);
    if (viewHistory.length > 12) viewHistory.shift();
  }
  activeView = v;
  // Hide all regular views
  ['obras','relatorio','insumos','usuarios'].forEach(id => {
    const el = document.getElementById('view-' + id);
    el.classList.remove('vactive');
    el.style.display = 'none';
  });
  const det = document.getElementById('view-detail');
  det.classList.remove('vactive');
  det.style.display = 'none';

  // Nav highlight
  ['obras','relatorio','insumos','usuarios'].forEach(id => {
    document.getElementById('nav-' + id)?.classList.remove('active');
  });

  const topbar = document.getElementById('topbar');

  if (v === 'detail') {
    det.style.display = 'block';
    det.classList.add('vactive');
    document.getElementById('nav-obras')?.classList.add('active');
    topbar.style.display = 'none';
    renderDetail();
  } else {
    topbar.style.display = 'flex';
    document.getElementById('nav-' + v)?.classList.add('active');
    const paths = {obras:'Obras / Projetos', relatorio:'Relatório', insumos:'Insumos / Pedidos', usuarios:'Usuários'};
    document.getElementById('topbar-path').textContent = paths[v] || v;
    const el = document.getElementById('view-' + v);
    el.style.display = 'block';
    el.classList.add('vactive');
    if (v === 'obras') renderDashboard();
    if (v === 'relatorio') renderRelatorio();
    if (v === 'insumos') renderInsumos();
    if (v === 'usuarios') renderUsers();
  }
  document.getElementById('main-content').scrollTop = 0;
  updateBackButton();
}

function updateBackButton() {
  const btn = document.getElementById('topbar-back-btn');
  if (!btn) return;
  btn.style.display = document.getElementById('page-app')?.classList.contains('active') ? 'inline-flex' : 'none';
  btn.disabled = !viewHistory.length && activeView === firstAllowedView();
}

function goBackApp() {
  closeMobileMenu();
  if (activeView === 'detail') {
    suppressViewHistory = true;
    showView('obras');
    suppressViewHistory = false;
    return;
  }
  const previous = viewHistory.pop();
  suppressViewHistory = true;
  showView(previous || firstAllowedView());
  suppressViewHistory = false;
}

function toggleMobileMenu(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', open);
}
function closeMobileMenu() {
  document.body.classList.remove('menu-open');
}

function openProject(id) {
  if (!getProject(id)) {
    showToast('Você não tem acesso a esta obra.', 'error');
    return;
  }
  currentProjectId = id;
  showView('detail');
}

// ══ FORMAT UTILS ═════════════════════════════════════════════════════════
function fmt(v) {
  if (v === null || v === undefined) return '—';
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtMi(v) {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return 'R$ ' + (abs/1e9).toFixed(2) + ' bi';
  if (abs >= 1e6) return 'R$ ' + (abs/1e6).toFixed(2) + ' mi';
  return fmt(v);
}
function fmtShort(v) {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e6) return 'R$ ' + (abs/1e6).toFixed(1) + ' mi';
  return fmt(v);
}
function fmtSigned(v, showPlus=false) {
  if (v === null || v === undefined) return '—';
  return (v < 0 ? '-' : (showPlus ? '+' : '')) + fmt(v);
}
function fmtMiSigned(v, showPlus=false) {
  if (v === null || v === undefined) return '—';
  return (v < 0 ? '-' : (showPlus ? '+' : '')) + fmtMi(v);
}
function fmtShortSigned(v, showPlus=false) {
  if (v === null || v === undefined) return '—';
  return (v < 0 ? '-' : (showPlus ? '+' : '')) + fmtShort(v);
}
// Percentage: if >100%, show only excess (+X.XX%), else show X.XX%
function fmtPct(v, showSign=false) {
  if (v === null || v === undefined) return '—';
  if (v > 100) {
    const excess = v - 100;
    return '+' + excess.toFixed(2) + '%';
  }
  return (showSign && v > 0 ? '+' : '') + v.toFixed(2) + '%';
}
function fmtPctDelta(v) {
  if (v === null || v === undefined) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function dateFmt(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function genId() {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
}

// ══ COMPUTE STATS FOR A PROJECT ═══════════════════════════════════════════
function computeStats(proj) {
  const meds = proj.medicoes || [];
  const curva = proj.curva || [];
  const orc = proj.orcamento || 0;

  const completas = meds.filter(m => m.receita !== null && !m.current);
  const totalReceita = completas.reduce((a,m) => a + (m.receita||0), 0);
  const totalGasto = meds.reduce((a,m) => a + (m.gasto||0), 0);
  const resultado = totalReceita - totalGasto;
  const resultadoPct = totalReceita > 0 ? (resultado / totalReceita * 100) : 0;

  // Last curva entry with real data
  let lastRIdx = -1;
  curva.forEach((c,i) => { if (c.r !== null) lastRIdx = i; });
  const prevAcum = lastRIdx >= 0 ? (curva[lastRIdx].p || 0) * 1e6 : 0;
  const pvr = prevAcum > 0 ? (totalReceita / prevAcum * 100) : 0;
  const pvrDelta = totalReceita - prevAcum;

  const mesesPos = completas.filter(m => m.receita >= m.gasto).length;
  const mesesNeg = completas.filter(m => m.receita < m.gasto).length;
  const totalMeses = completas.length;

  const orcPct = orc > 0 ? (totalGasto / orc * 100) : 0;
  const execPct = orc > 0 ? (totalReceita / orc * 100) : 0;
  const prevExecPct = orc > 0 ? (prevAcum / orc * 100) : 0;
  const custoPct = prevAcum > 0 ? (totalGasto / prevAcum * 100) : 0;

  const ultMed = completas.length > 0 ? completas[completas.length-1] : null;

  return {
    totalReceita, totalGasto, resultado, resultadoPct,
    prevAcum, pvr, pvrDelta,
    mesesPos, mesesNeg, totalMeses,
    orcPct, execPct, prevExecPct, custoPct,
    ultMed, completas, lastRIdx, orc
  };
}

// ══ DASHBOARD ════════════════════════════════════════════════════════════
function renderDashboard() {
  const projects = visibleProjects();
  const total = projects.length;
  const ativos = projects.filter(p=>p.status==='ativo').length;
  const pausados = projects.filter(p=>p.status==='pausado').length;
  const concluidos = projects.filter(p=>p.status==='concluido').length;
  const orcTotal = projects.reduce((a,p)=>a+(p.orcamento||0),0);
  document.getElementById('dash-total').textContent = total;
  document.getElementById('dash-ativos').textContent = ativos;
  document.getElementById('dash-pausados').textContent = pausados;
  document.getElementById('dash-concluidos').textContent = concluidos;
  document.getElementById('dash-orc-total').textContent = fmtShort(orcTotal);
  document.getElementById('obras-count-label').textContent = total + ' projeto' + (total!==1?'s':'') + ' ' + (total!==1?'disponíveis':'disponível');

  const grid = document.getElementById('proj-grid');
  grid.innerHTML = '';

  if (total === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="es-icon">🏗️</div>
      <p>Nenhum projeto cadastrado ainda.</p>
      <small>Clique em <b>Nova Obra</b> para adicionar o primeiro projeto.</small>
    </div>`;
    return;
  }

  projects.forEach(proj => {
    const s = computeStats(proj);
    const badgeClass = proj.status === 'ativo' ? 'badge-ativo' : proj.status === 'pausado' ? 'badge-pausado' : 'badge-concluido';
    const badgeTxt = proj.status === 'ativo' ? 'Ativo' : proj.status === 'pausado' ? 'Pausado' : 'Concluído';
    const pvrW = Math.min(s.pvr, 100);
    const pvrBarClass = s.pvr >= 100 ? 'fill-green' : 'fill-red';
    const orcW = Math.min(s.orcPct, 100);

    const card = document.createElement('div');
    card.className = 'proj-card';
    card.onclick = () => openProject(proj.id);
    card.innerHTML = `
      ${isAdmin() ? `<div class="proj-card-actions"><button class="proj-icon-btn" title="Editar" onclick="event.stopPropagation();editProject('${proj.id}')">✎</button><button class="proj-icon-btn" title="Apagar" onclick="event.stopPropagation();deleteProject('${proj.id}')">×</button></div>` : ''}
      <div class="proj-card-top">
        <div class="proj-icon">🏗️</div>
        <div class="proj-info">
          <h3>${proj.nome}</h3>
          <div class="proj-code">${proj.codigo}</div>
          <div class="proj-date">📅 ${dateFmt(proj.inicio)} → ${dateFmt(proj.termino)}</div>
        </div>
        <span class="badge ${badgeClass}">${badgeTxt}</span>
        <span style="color:#888;font-size:18px;margin-left:4px;">›</span>
      </div>
      <div class="fin-label">FINANCEIRO</div>
      <div class="fin-grid">
        <div class="fin-cell"><div class="fl">Receita</div><div class="fv green">${fmtShort(s.totalReceita)}</div></div>
        <div class="fin-cell"><div class="fl">Gasto</div><div class="fv red">${fmtShort(s.totalGasto)}</div></div>
        <div class="fin-cell"><div class="fl">Resultado</div>
          <div class="fv ${s.resultado>=0?'green':'red'}">${fmtShortSigned(s.resultado, true)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:11px;color:#aaa;">Previsto × Realizado</span>
        <span style="font-size:13px;font-weight:700;color:${s.pvr>=100?'#4caf50':'#f44336'}">${fmtPct(s.pvr)}</span>
      </div>
      <div class="prog-bar-bg" style="height:16px;margin-bottom:10px;">
        <div class="prog-bar-fill ${pvrBarClass}" style="width:${pvrW}%">${fmtPct(s.pvr)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:4px;">
        <span>Orçamento utilizado</span>
        <span style="color:#e0e0e0;font-weight:600;">${s.orcPct.toFixed(1)}%</span>
      </div>
      <div class="prog-bar-bg" style="height:10px;">
        <div class="prog-bar-fill fill-blue" style="width:${orcW}%"></div>
      </div>
      ${s.ultMed ? `<div style="font-size:11px;color:#555;margin-top:8px;">Última med.: <b style="color:#e0e0e0">Med ${String(s.ultMed.n).padStart(2,'0')} — ${s.ultMed.mes}</b></div>` : ''}
    `;
    grid.appendChild(card);
  });
}

// ══ DETAIL VIEW ══════════════════════════════════════════════════════════
function renderDetail() {
  const proj = currentProject();
  if (!proj) { showView('obras'); return; }
  const s = computeStats(proj);
  const badgeClass = proj.status === 'ativo' ? 'badge-ativo' : proj.status === 'pausado' ? 'badge-pausado' : 'badge-concluido';
  const badgeTxt = proj.status === 'ativo' ? 'Ativo' : proj.status === 'pausado' ? 'Pausado' : 'Concluído';

  document.getElementById('d-title').innerHTML = `${proj.nome} <span class="badge ${badgeClass}" style="font-size:11px;">${badgeTxt}</span> <span style="color:#888;font-size:12px;font-weight:400;">${proj.codigo}</span>`;
  document.getElementById('d-sub').textContent = (proj.descricao||'') + ' · ' + dateFmt(proj.inicio) + ' → ' + dateFmt(proj.termino);

  // Build body
  const body = document.getElementById('detail-body');
  const orcPctTxt = fmtPct(s.orcPct);
  const pvrPctTxt = fmtPct(s.pvr);
  const custoPctTxt = fmtPct(s.custoPct);
  const execPctTxt = s.execPct.toFixed(2) + '%';
  const prevExecPctTxt = s.prevExecPct.toFixed(2) + '%';

  const pvrColor = s.pvr >= 100 ? '#4caf50' : '#f44336';
  const custoColor = s.custoPct <= 100 ? '#4caf50' : '#f44336';
  const orcColor = s.orcPct <= 100 ? '#4caf50' : '#f44336';

  const pvrDeltaDiff = s.pvr - 100;
  const custoDiff = s.custoPct - 100;
  const execDiff = s.execPct - s.prevExecPct;
  const pvrBarW = Math.min(Math.min(s.pvr,100), 100);
  const custoBarW = Math.min(Math.min(s.custoPct,100), 100);
  const execBarW = Math.min(s.execPct, 100);
  const orcBarW = Math.min(s.orcPct, 100);
  const pvrBarCls = s.pvr >= 100 ? 'fill-green' : 'fill-red';
  const custoBarCls = s.custoPct <= 100 ? 'fill-green' : 'fill-red';

  body.innerHTML = `
  <!-- ORC TOTAL -->
  <div class="orc-total-card">
    <div class="orc-total-header">
      <span>🏦 Orçamento Total: <span class="orc-val">${fmt(proj.orcamento)}</span></span>
      <span class="orc-pct" style="color:${orcColor}">${orcPctTxt} utilizado</span>
    </div>
    <div class="prog-bar-bg" style="height:16px;">
      <div class="prog-bar-fill fill-blue" style="width:${orcBarW}%;font-size:10px;">${s.orcPct.toFixed(1)}%</div>
    </div>
    <div class="orc-note">${fmt(s.totalGasto)} gastos de ${fmt(proj.orcamento)} · Restam ${fmt(proj.orcamento - s.totalGasto)}</div>
  </div>

  <!-- SEÇÃO FINANCEIRO -->
  <div class="section-hdr"><span>💰 FINANCEIRO — VALORES</span></div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kc-label">📈 RECEITA TOTAL (REAL)</div>
      <div class="kc-val green">${fmt(s.totalReceita)}</div>
      <div class="kc-sub">${s.completas.length} medições realizadas</div>
    </div>
    <div class="kpi-card">
      <div class="kc-label">📉 GASTO TOTAL (REAL)</div>
      <div class="kc-val red">${fmt(s.totalGasto)}</div>
      <div class="kc-sub">${proj.medicoes.length} meses registrados</div>
    </div>
    <div class="kpi-card">
      <div class="kc-label">⚖️ RESULTADO (RECEITA − GASTO)</div>
      <div class="kc-val ${s.resultado>=0?'green':'red'}">${fmtSigned(s.resultado, true)}</div>
      <div class="kc-sub" style="color:${s.resultado>=0?'#4caf50':'#f44336'}">${s.resultado>=0?'✅ Saldo positivo':'⚠️ Saldo negativo'} · ${fmtPctDelta(s.resultadoPct)}</div>
    </div>
  </div>
  <div class="kpi-grid" style="margin-top:10px;">
    <div class="kpi-card">
      <div class="kc-label">📅 CRONOGRAMA PREVISTO (ACUM.)</div>
      <div class="kc-val amber">${fmt(s.prevAcum)}</div>
      <div class="kc-sub">Acumulado previsto até período atual</div>
    </div>
    <div class="kpi-card">
      <div class="kc-label">✅ CRONOGRAMA REALIZADO (ACUM.)</div>
      <div class="kc-val green">${fmt(s.totalReceita)}</div>
      <div class="kc-sub">Acumulado realizado</div>
    </div>
    <div class="kpi-card">
      <div class="kc-label">📊 PREVISTO × REALIZADO (Δ)</div>
      <div class="kc-val ${s.pvrDelta>=0?'green':'red'}">${s.pvrDelta>=0?'+':''}${fmt(s.pvrDelta)}</div>
      <div class="kc-sub" style="color:${pvrColor}">${pvrPctTxt} · ${s.pvr>=100?'Acima do previsto':'Abaixo do previsto'}</div>
    </div>
  </div>

  <!-- SEÇÃO PROGRESSO -->
  <div class="section-hdr"><span>📊 PROGRESSO — EVOLUÇÃO %</span></div>
  <div class="prog-kpi-row">
    <div class="prog-kpi" style="border-color:rgba(76,175,80,.3);">
      <div class="pk-label">✅ REALIZADO / PREVISTO</div>
      <div class="pk-val" style="color:${pvrColor}">${fmtPct(s.pvr)}</div>
      <div class="pk-sub">Receita vs previsto acumulado</div>
    </div>
    <div class="prog-kpi" style="border-color:rgba(76,175,80,.2);">
      <div class="pk-label">✅ MESES POSITIVOS</div>
      <div class="pk-val" style="color:#4caf50">${s.mesesPos}<span style="font-size:16px;color:#666"> / ${s.totalMeses}</span></div>
      <div class="pk-sub">Receita &gt; Gasto</div>
    </div>
    <div class="prog-kpi" style="border-color:rgba(244,67,54,.2);">
      <div class="pk-label">⚠️ MESES NEGATIVOS</div>
      <div class="pk-val" style="color:#f44336">${s.mesesNeg}<span style="font-size:16px;color:#666"> / ${s.totalMeses}</span></div>
      <div class="pk-sub">Gasto &gt; Receita</div>
    </div>
  </div>

  <!-- GRÁFICO 1: FINANCEIRO -->
  <div class="section-hdr"><span>📈 GRÁFICOS DE EFICIÊNCIA</span></div>
  <div class="eff-block">
    <div class="eff-section-label">GRÁFICO 1 — FINANCEIRO</div>
    <div class="eff-row">
      <div class="eff-row-header">
        <span class="ert">Previsto × Realizado (Receita)</span>
        <span class="erv ${s.pvr>=100?'green':'red'}">${pvrPctTxt}</span>
      </div>
      <div class="prog-bar-bg">
        <div class="prog-bar-fill ${pvrBarCls}" style="width:${pvrBarW}%">${fmtPct(s.pvr)}</div>
      </div>
      <div class="eff-note">${fmt(s.totalReceita)} realizados de ${fmt(s.prevAcum)} previstos</div>
      <div class="eff-3col">
        <div class="eff-3cell"><div class="e3l">Previsto</div><div class="e3v">${fmtMi(s.prevAcum)}</div></div>
        <div class="eff-3cell"><div class="e3l">Realizado</div><div class="e3v">${fmtMi(s.totalReceita)}</div></div>
        <div class="eff-3cell"><div class="e3l">Resultado</div>
          <div class="e3v ${s.pvrDelta>=0?'pos':'neg'}">${fmtMiSigned(s.pvrDelta, true)} · ${fmtPctDelta(pvrDeltaDiff)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- GRÁFICO 2: EFICIÊNCIA DE CUSTO -->
  <div class="eff-block">
    <div class="eff-section-label">GRÁFICO 2 — EFICIÊNCIA DE CUSTO</div>
    <div class="eff-row">
      <div class="eff-row-header">
        <span class="ert">Eficiência de Custo (Gasto / Previsto)</span>
        <span class="erv ${s.custoPct<=100?'green':'red'}">${custoPctTxt}</span>
      </div>
      <div class="prog-bar-bg">
        <div class="prog-bar-fill ${custoBarCls}" style="width:${custoBarW}%">${s.custoPct.toFixed(1)}%</div>
      </div>
      <div class="eff-note">${fmt(s.totalGasto)} gastos vs ${fmt(s.prevAcum)} previstos · ${s.custoPct>100?'⚠️ Acima do orçamento':'✅ Abaixo do orçamento'}</div>
      <div class="eff-3col">
        <div class="eff-3cell"><div class="e3l">Previsto</div><div class="e3v">${fmtMi(s.prevAcum)}</div></div>
        <div class="eff-3cell"><div class="e3l">Realizado</div><div class="e3v">${fmtMi(s.totalGasto)}</div></div>
        <div class="eff-3cell warn"><div class="e3l">Resultado</div>
          <div class="e3v ${(s.totalGasto-s.prevAcum)<=0?'pos':'neg'}">${fmtMiSigned(s.totalGasto-s.prevAcum, true)} · ${fmtPctDelta(custoDiff)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- GRÁFICO 3: PROGRESSO DA OBRA -->
  <div class="eff-block">
    <div class="eff-section-label">GRÁFICO 3 — PROGRESSO DA OBRA</div>
    <div class="eff-row">
      <div class="eff-row-header">
        <span class="ert">Obra Executada (Receita / Orçamento)</span>
        <span class="erv blue">${execPctTxt}</span>
      </div>
      <div class="prog-bar-bg">
        <div class="prog-bar-fill fill-blue" style="width:${execBarW}%">${s.execPct.toFixed(1)}%</div>
      </div>
      <div class="eff-note">${fmt(s.totalReceita)} medidos de ${fmt(proj.orcamento)} contratados</div>
      <div class="eff-3col">
        <div class="eff-3cell"><div class="e3l">Previsto</div><div class="e3v">${prevExecPctTxt}</div></div>
        <div class="eff-3cell"><div class="e3l">Realizado</div><div class="e3v">${execPctTxt}</div></div>
        <div class="eff-3cell"><div class="e3l">Resultado</div>
          <div class="e3v ${execDiff>=0?'pos':'neg'}">${execDiff>=0?'+':''}${execDiff.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  </div>

  <!-- CURVA S -->
  <div class="curva-card">
    <div class="curva-header">
      <div>
        <h3>📉 CURVA S — ACUMULADO</h3>
        <p>Evolução acumulada de receita, gasto e previsto</p>
      </div>
      <div class="period-btns">
        <button class="period-btn" id="pbtn12" onclick="setPeriod(12)">12m</button>
        <button class="period-btn" id="pbtn36" onclick="setPeriod(36)">36m</button>
        <button class="period-btn active" id="pbtn48" onclick="setPeriod(48)">48m</button>
      </div>
    </div>
    <canvas id="curvaChart" height="140"></canvas>
    <div class="curva-legend">
      <div class="cl-item"><div class="cl-dot cl-amber-dash"></div>Previsto Acum.</div>
      <div class="cl-item"><div class="cl-dot cl-green"></div>Receita Acum.</div>
      <div class="cl-item"><div class="cl-dot cl-red"></div>Gasto Acum.</div>
    </div>
  </div>

  <!-- TABELA MEDIÇÕES -->
  <div class="table-card" style="margin-top:16px;">
    <div class="table-card-header">
      <h3>📋 Tabela de Medições</h3>
      <span style="font-size:11px;color:#666;">${proj.medicoes.length} registro(s)</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="med-table">
        <thead>
          <tr>
            <th style="text-align:left">MÊS</th>
            <th>RECEITA</th>
            <th>GASTO REAL</th>
            <th>DIFERENÇA</th>
            <th>STATUS</th>
            <th>% DESEMPENHO</th>
            <th>AÇÕES</th>
          </tr>
        </thead>
        <tbody id="med-tbody"></tbody>
      </table>
    </div>
  </div>
  `;

  buildMedTable();
  currentPeriod = 48;
  setTimeout(() => renderCurvaChart(48), 50);
}

// ══ TABELA DE MEDIÇÕES ════════════════════════════════════════════════════
function buildMedTable() {
  const proj = currentProject();
  if (!proj) return;
  const tbody = document.getElementById('med-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const baseMensal = proj.orcamento > 0
    ? proj.orcamento / Math.max(getProjectMonths(proj), 1)
    : 3500000;

  proj.medicoes.forEach((m, idx) => {
    const diff = (m.receita !== null && m.gasto !== null) ? m.receita - m.gasto : null;
    const pos = diff !== null ? diff >= 0 : null;
    const pct = m.receita !== null ? (m.receita / baseMensal * 100) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="med-num">Med ${String(m.n).padStart(2,'0')}</div><div class="med-date">${m.mes}</div></td>
      <td class="${m.receita!==null&&m.receita>0?'val-green':''}">
        ${m.receita!==null ? fmt(m.receita) : '<span style="color:#f0c000;font-size:11px;">Em andamento</span>'}
      </td>
      <td>${fmt(m.gasto)}</td>
      <td class="${diff!==null?(pos?'val-green':'val-red'):''}">
        ${diff!==null ? (pos?'+':'')+fmt(diff) : '—'}
      </td>
      <td>
        ${m.current
          ? '<span class="status-pill status-cur">Atual</span>'
          : pos===null ? '—'
          : pos
            ? '<span class="status-pill status-pos">Positivo</span>'
            : '<span class="status-pill status-neg">Negativo</span>'}
      </td>
      <td class="${pct!==null&&pct>=100?'val-green':''}">
        ${pct!==null ? pct.toFixed(1)+'%' : '—'}
      </td>
      <td style="white-space:nowrap;">
        <button class="edit-btn" title="Editar" onclick="editRow(${idx})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="del-btn" title="Excluir" onclick="delRow(${idx})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function editRow(idx) {
  const proj = currentProject();
  const m = proj.medicoes[idx];
  const rows = document.getElementById('med-tbody').rows;
  const tds = rows[idx].cells;
  tds[1].innerHTML = `<input class="editing-input" id="edit-rec-${idx}" type="number" value="${m.receita!==null?m.receita:''}" placeholder="0">`;
  tds[2].innerHTML = `<input class="editing-input" id="edit-gasto-${idx}" type="number" value="${m.gasto!==null?m.gasto:''}" placeholder="0">`;
  tds[6].innerHTML = `<button class="btn-action primary" style="padding:4px 10px;font-size:11px;" onclick="saveRow(${idx})">✔ Salvar</button>`;
}

function saveRow(idx) {
  const proj = currentProject();
  const recVal = document.getElementById('edit-rec-' + idx)?.value;
  const gastoVal = document.getElementById('edit-gasto-' + idx)?.value;
  if (recVal !== undefined && recVal !== '') proj.medicoes[idx].receita = parseFloat(recVal);
  else proj.medicoes[idx].receita = null;
  if (gastoVal !== undefined && gastoVal !== '') proj.medicoes[idx].gasto = parseFloat(gastoVal) || 0;
  recalcCurva(proj);
  saveProjects();
  showToast('Medição atualizada!', 'success');
  renderDetail();
}

function delRow(idx) {
  const proj = currentProject();
  if (!confirm('Excluir Med ' + proj.medicoes[idx].n + ' — ' + proj.medicoes[idx].mes + '?')) return;
  proj.medicoes.splice(idx, 1);
  proj.medicoes.forEach((m,i) => m.n = i+1);
  recalcCurva(proj);
  saveProjects();
  showToast('Medição excluída.', 'error');
  renderDetail();
}

// ══ NOVO MÊS ══════════════════════════════════════════════════════════════
function openModalMes() {
  document.getElementById('modal-novo-mes').classList.add('open');
  document.getElementById('nm-mes').value = '';
  document.getElementById('nm-receita').value = '0';
  document.getElementById('nm-gasto').value = '0';
  document.getElementById('nm-previsto').value = '';
  document.getElementById('modal-mes-err').style.display = 'none';
}
function closeModalMes() { document.getElementById('modal-novo-mes').classList.remove('open'); }
document.getElementById('modal-novo-mes').addEventListener('click', function(e){ if(e.target===this) closeModalMes(); });

function addNovoMes() {
  const mesVal = document.getElementById('nm-mes').value;
  const errEl = document.getElementById('modal-mes-err');
  if (!mesVal) { errEl.style.display='block'; errEl.textContent='Por favor, preencha o mês.'; return; }

  const proj = currentProject();
  const receita = parseFloat(document.getElementById('nm-receita').value) || 0;
  const gasto = parseFloat(document.getElementById('nm-gasto').value) || 0;
  const previsto = parseFloat(document.getElementById('nm-previsto').value) || null;
  const [y, m] = mesVal.split('-');
  const mesLabel = MESES_PT[parseInt(m)-1] + ' ' + y;
  const curvaLabel = MESES_PT[parseInt(m)-1] + '/' + y.slice(2);
  const isAndamento = receita === 0;

  proj.medicoes.forEach(med => med.current = false);

  proj.medicoes.push({
    n: proj.medicoes.length + 1,
    mes: mesLabel,
    receita: isAndamento ? null : receita,
    gasto,
    current: isAndamento,
  });

  // Update curva
  const ci = proj.curva.findIndex(c => c.l === curvaLabel);
  const accR = proj.medicoes.filter(x=>x.receita!==null).reduce((a,x)=>a+(x.receita||0),0);
  const accC = proj.medicoes.reduce((a,x)=>a+(x.gasto||0),0);
  if (ci >= 0) {
    proj.curva[ci].r = isAndamento ? null : parseFloat((accR/1e6).toFixed(3));
    proj.curva[ci].c = parseFloat((accC/1e6).toFixed(3));
    if (previsto !== null) proj.curva[ci].p = previsto;
  } else {
    proj.curva.push({
      l: curvaLabel,
      p: previsto,
      r: isAndamento ? null : parseFloat((accR/1e6).toFixed(3)),
      c: parseFloat((accC/1e6).toFixed(3)),
    });
  }

  saveProjects();
  closeModalMes();
  showToast('Medição adicionada!', 'success');
  renderDetail();
}

// ══ NOVA OBRA ═════════════════════════════════════════════════════════════
function openModalObra() {
  editingProjectId = null;
  document.getElementById('modal-nova-obra').classList.add('open');
  document.getElementById('modal-obra-title').textContent = '➕ Nova Obra / Projeto';
  document.getElementById('no-nome').value = '';
  document.getElementById('no-codigo').value = '';
  document.getElementById('no-status').value = 'ativo';
  document.getElementById('no-orcamento').value = '';
  document.getElementById('no-inicio').value = '';
  document.getElementById('no-termino').value = '';
  document.getElementById('no-descricao').value = '';
  document.getElementById('modal-obra-err').style.display = 'none';
}
function closeModalObra() { document.getElementById('modal-nova-obra').classList.remove('open'); }
document.getElementById('modal-nova-obra').addEventListener('click', function(e){ if(e.target===this) closeModalObra(); });

function editProject(id) {
  const proj = PROJECTS.find(p => p.id === id);
  if (!proj || !isAdmin()) return;
  editingProjectId = id;
  document.getElementById('modal-nova-obra').classList.add('open');
  document.getElementById('modal-obra-title').textContent = 'Editar Obra / Projeto';
  document.getElementById('no-nome').value = proj.nome || '';
  document.getElementById('no-codigo').value = proj.codigo || '';
  document.getElementById('no-status').value = proj.status || 'ativo';
  document.getElementById('no-orcamento').value = proj.orcamento || '';
  document.getElementById('no-inicio').value = proj.inicio || '';
  document.getElementById('no-termino').value = proj.termino || '';
  document.getElementById('no-descricao').value = proj.descricao || '';
  document.getElementById('modal-obra-err').style.display = 'none';
}

function deleteProject(id) {
  if (!isAdmin()) return;
  const idx = PROJECTS.findIndex(p => p.id === id);
  if (idx < 0) return;
  const removed = JSON.parse(JSON.stringify(PROJECTS[idx]));
  const usersSnapshot = JSON.parse(JSON.stringify(USERS));
  if (!confirm('Apagar a obra "' + removed.nome + '"? Você pode desfazer por 9 segundos.')) return;
  clearTimeout(deletedProjectUndo?.timer);
  PROJECTS.splice(idx, 1);
  USERS.forEach(user => { user.projectIds = (user.projectIds || []).filter(projectId => projectId !== id); });
  deletedProjectUndo = {
    removed,
    idx,
    usersSnapshot,
    timer: setTimeout(() => {
      deletedProjectUndo = null;
    }, 9000)
  };
  saveProjects(); saveUsers(); renderDashboard(); renderRelatorio();
  showToast('Obra apagada. Você pode desfazer por 9 segundos.', 'undo');
}

function undoDeleteProject() {
  if (!deletedProjectUndo) return;
  clearTimeout(deletedProjectUndo.timer);
  PROJECTS.splice(Math.min(deletedProjectUndo.idx, PROJECTS.length), 0, deletedProjectUndo.removed);
  USERS = deletedProjectUndo.usersSnapshot || USERS;
  deletedProjectUndo = null;
  saveProjects(); saveUsers(); renderDashboard(); renderRelatorio();
  showToast('Obra restaurada.', 'success');
}

function saveNovaObra() {
  const nome = document.getElementById('no-nome').value.trim();
  const codigo = document.getElementById('no-codigo').value.trim();
  const status = document.getElementById('no-status').value;
  const orcamento = parseFloat(document.getElementById('no-orcamento').value) || 0;
  const inicio = document.getElementById('no-inicio').value;
  const termino = document.getElementById('no-termino').value;
  const descricao = document.getElementById('no-descricao').value.trim();

  const errEl = document.getElementById('modal-obra-err');
  if (!nome || !codigo || !orcamento || !inicio || !termino) {
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  if (editingProjectId) {
    const proj = PROJECTS.find(p => p.id === editingProjectId);
    Object.assign(proj, {nome, codigo, status, orcamento, inicio, termino, descricao});
    saveProjects();
    closeModalObra();
    showToast('Projeto atualizado com sucesso!', 'success');
    renderDashboard();
    if (document.getElementById('view-insumos')) renderInsumos();
    return;
  }

  const newProj = {
    id: 'proj-' + Date.now(),
    nome, codigo, status, orcamento, inicio, termino, descricao,
    medicoes: [],
    curva: []
  };
  PROJECTS.push(newProj);
  saveProjects();
  closeModalObra();
  showToast('Projeto "' + nome + '" criado com sucesso!', 'success');
  renderDashboard();
  if (document.getElementById('view-insumos')) renderInsumos();
}

function generateCurva(inicio, termino, orcTotal) {
  // Generate a standard S-curve from start to end
  const start = new Date(inicio);
  const end = new Date(termino);
  const totalMonths = (end.getFullYear()-start.getFullYear())*12 + (end.getMonth()-start.getMonth()) + 1;
  const curva = [];
  let accP = 0;
  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const label = MESES_PT[d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
    const t = (i+1) / totalMonths; // 0..1
    // S-curve: ease in-out cubic
    const s = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
    accP = parseFloat(((orcTotal/1e6) * s).toFixed(3));
    curva.push({l: label, p: accP, r: null, c: null});
  }
  return curva;
}

function getProjectMonths(proj) {
  if (!proj.inicio || !proj.termino) return 48;
  const s = new Date(proj.inicio);
  const e = new Date(proj.termino);
  return (e.getFullYear()-s.getFullYear())*12 + (e.getMonth()-s.getMonth()) + 1;
}

// ══ RECALC CURVA ══════════════════════════════════════════════════════════
function recalcCurva(proj) {
  let accR = 0, accC = 0;
  proj.medicoes.forEach(m => {
    if (m.receita !== null && !m.current) accR += m.receita;
    if (m.gasto !== null) accC += m.gasto;
    const lbl = m.mes.replace(' ', '/').replace(/(\w+)\/(\d{4})/, (_, mo, yr) => mo + '/' + yr.slice(2));
    const ci = proj.curva.findIndex(c => c.l === lbl);
    if (ci >= 0) {
      proj.curva[ci].r = (!m.current && m.receita !== null) ? parseFloat((accR/1e6).toFixed(3)) : null;
      proj.curva[ci].c = parseFloat((accC/1e6).toFixed(3));
    }
  });
}

// ══ CURVA S CHART ═════════════════════════════════════════════════════════
function setPeriod(n) {
  currentPeriod = n;
  ['pbtn12','pbtn36','pbtn48'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const active = document.getElementById('pbtn'+n);
  if (active) active.classList.add('active');
  renderCurvaChart(n);
}

function renderCurvaChart(n) {
  const proj = currentProject();
  if (!proj) return;
  const canvas = document.getElementById('curvaChart');
  if (!canvas) return;
  const curva = proj.curva;

  // Find last index with real data
  let lastRIdx = -1;
  curva.forEach((c,i) => { if (c.r !== null) lastRIdx = i; });

  let s_idx = 0, e_idx = curva.length - 1;
  if (n === 12) {
    s_idx = Math.max(0, lastRIdx - 11);
    e_idx = Math.min(lastRIdx + 12, curva.length - 1);
  } else if (n === 36) {
    e_idx = Math.min(35, curva.length - 1);
  } else {
    e_idx = Math.min(47, curva.length - 1);
  }

  const slice = curva.slice(s_idx, e_idx + 1);
  const localCur = lastRIdx - s_idx;
  const labels = slice.map(d => d.l);
  const prevData = slice.map(d => d.p);
  const realData = slice.map((d, i) => {
    if (i <= localCur && d.r !== null) return d.r;
    return null;
  });
  const custoData = slice.map((d, i) => {
    if (i <= localCur && d.c !== null) return d.c;
    return null;
  });

  const allVals = [...prevData, ...realData, ...custoData].filter(v => v != null);
  const yMax = allVals.length > 0 ? Math.ceil(Math.max(...allVals) * 1.12 / 10) * 10 : 160;

  if (curvaChart) { curvaChart.destroy(); curvaChart = null; }
  const ctx = canvas.getContext('2d');
  curvaChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Previsto Acum.',
          data: prevData,
          borderColor: '#f0c000',
          backgroundColor: 'rgba(240,192,0,0.05)',
          borderWidth: 2,
          borderDash: [7,4],
          pointRadius: n > 24 ? 1 : 3,
          pointBackgroundColor: '#f0c000',
          tension: 0.4,
          spanGaps: true,
          order: 3,
          fill: false,
        },
        {
          label: 'Receita Acum.',
          data: realData,
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76,175,80,0.10)',
          borderWidth: 2,
          pointRadius: n > 24 ? 1 : 3,
          pointBackgroundColor: '#4caf50',
          tension: 0.4,
          spanGaps: false,
          order: 1,
          fill: true,
        },
        {
          label: 'Gasto Acum.',
          data: custoData,
          borderColor: '#f44336',
          backgroundColor: 'rgba(244,67,54,0.05)',
          borderWidth: 2,
          pointRadius: n > 24 ? 1 : 3,
          pointBackgroundColor: '#f44336',
          tension: 0.4,
          spanGaps: false,
          order: 2,
          fill: false,
        },
      ]
    },
    options: {
      responsive: true,
      animation: {duration: 300},
      interaction: {mode: 'index', intersect: false},
      plugins: {
        legend: {display: false},
        tooltip: {
          backgroundColor: '#1a1d2e',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#ccc',
          padding: 10,
          callbacks: {
            label: ctx => {
              if (ctx.parsed.y == null) return null;
              return ` ${ctx.dataset.label}: R$ ${ctx.parsed.y.toFixed(3)} mi`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {color: '#111827'},
          ticks: {color: '#555', font: {size: n > 36 ? 8 : 9}, maxRotation: n > 24 ? 45 : 0}
        },
        y: {
          grid: {color: '#111827'},
          ticks: {color: '#555', font: {size: 9}, callback: v => `R$ ${v} mi`},
          min: 0,
          max: yMax
        }
      }
    },
    plugins: [{
      id: 'curLine',
      afterDraw(chart) {
        if (localCur < 0 || localCur >= slice.length) return;
        const ctx = chart.ctx, xS = chart.scales.x, yS = chart.scales.y;
        const x = xS.getPixelForValue(localCur);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x, yS.top); ctx.lineTo(x, yS.bottom);
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.setLineDash([4,4]); ctx.lineWidth = 1.2; ctx.stroke();
        const txt = 'ATUAL';
        ctx.font = 'bold 8px Segoe UI'; ctx.setLineDash([]);
        const tw = ctx.measureText(txt).width + 10, th = 14;
        const tx = x - tw/2, ty = yS.top - th - 2;
        ctx.fillStyle = 'rgba(240,192,0,.2)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tx,ty,tw,th,3); else ctx.rect(tx,ty,tw,th);
        ctx.fill();
        ctx.fillStyle = '#f0c000'; ctx.textAlign = 'center';
        ctx.fillText(txt, x, ty + th - 3);
        ctx.restore();
      }
    }]
  });
}

// ══ RELATÓRIO ═════════════════════════════════════════════════════════════
function renderRelatorio() {
  populateReportProjectSelect();
  const selected = document.getElementById('report-project-select')?.value || 'all';
  const projects = selected === 'all' ? visibleProjects() : visibleProjects().filter(project => project.id === selected);
  const el = document.getElementById('relatorio-content');
  el.innerHTML = buildReportHtml(projects);
}



function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function signedMoney(v) {
  if (v === null || v === undefined) return '—';
  return fmtSigned(v, false);
}
function reportMonthLabel(date = new Date()) {
  return date.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
}
function reportHealth(stats) {
  const margin = stats.totalReceita > 0 ? (stats.resultado / stats.totalReceita * 100) : 0;
  if (stats.resultado < 0 || margin < 0) return {label:'Crítico', cls:'', dot:''};
  if (margin < 8 || stats.pvr < 95) return {label:'Atenção', cls:'warn', dot:'warn'};
  return {label:'Saudável', cls:'ok', dot:'ok'};
}
function reportPeriod(proj, stats) {
  const start = proj.inicio ? proj.inicio.slice(0, 7) : '—';
  let end = proj.termino ? proj.termino.slice(0, 7) : '—';
  if (stats.ultMed && stats.ultMed.mes) end = stats.ultMed.mes;
  return {start, end};
}
function reportStatusText(m) {
  if (m.current) return 'Em andamento';
  if (m.receita === null) return '—';
  return (m.receita || 0) >= (m.gasto || 0) ? 'Positivo' : 'Negativo';
}
function curveSvg(proj) {
  const curve = (proj.curva || []).filter(item => item && item.l);
  if (!curve.length) {
    return '<div style="height:150px;border:1px dashed #bbb;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px;">Sem dados da Curva S</div>';
  }
  const values = [];
  curve.forEach(item => ['p','r','c'].forEach(key => { if (item[key] !== null && item[key] !== undefined && !Number.isNaN(Number(item[key]))) values.push(Number(item[key])); }));
  const max = Math.max(1, ...values) * 1.12;
  const W = 650, H = 170, L = 46, T = 12, PW = 580, PH = 112;
  const x = i => L + (curve.length === 1 ? 0 : (i / (curve.length - 1)) * PW);
  const y = v => T + PH - (Number(v || 0) / max) * PH;
  const points = key => curve.map((item, i) => item[key] === null || item[key] === undefined ? null : [x(i), y(item[key])]).filter(Boolean).map(p => p.join(',')).join(' ');
  const labelStep = Math.max(1, Math.ceil(curve.length / 7));
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const yy = T + (PH / 4) * i;
    const val = max * (1 - i / 4);
    grid += `<line x1="${L}" y1="${yy}" x2="${L+PW}" y2="${yy}" stroke="#d7d7d7" stroke-dasharray="2 3"/><text x="4" y="${yy+4}" font-size="8" fill="#888">R$ ${val.toFixed(0)} mi</text>`;
  }
  let labels = '';
  curve.forEach((item, i) => {
    if (i % labelStep === 0 || i === curve.length - 1) labels += `<text x="${x(i)}" y="${T+PH+22}" text-anchor="middle" font-size="8" fill="#888">${escHtml(item.l)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva S acumulada">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
    ${grid}
    <line x1="${L}" y1="${T+PH}" x2="${L+PW}" y2="${T+PH}" stroke="#777"/>
    <line x1="${L}" y1="${T}" x2="${L}" y2="${T+PH}" stroke="#777"/>
    <polyline points="${points('p')}" fill="none" stroke="#f0c000" stroke-width="2.2" stroke-dasharray="6 4"/>
    <polyline points="${points('r')}" fill="none" stroke="#27b35a" stroke-width="2.2"/>
    <polyline points="${points('c')}" fill="none" stroke="#e04444" stroke-width="2"/>
    ${labels}
    <g transform="translate(405 150)" font-size="9" fill="#555">
      <line x1="0" y1="-3" x2="20" y2="-3" stroke="#f0c000" stroke-width="2" stroke-dasharray="5 3"/><text x="26" y="0">Previsto</text>
      <line x1="88" y1="-3" x2="108" y2="-3" stroke="#27b35a" stroke-width="2"/><text x="114" y="0">Receita</text>
      <line x1="174" y1="-3" x2="194" y2="-3" stroke="#e04444" stroke-width="2"/><text x="200" y="0">Gasto</text>
    </g>
  </svg>`;
}

function buildReportHtml(projects) {
  if (!projects.length) return `<div class="executive-report-stack"><div class="executive-page" style="display:flex;align-items:center;justify-content:center;color:#777;">Nenhum projeto disponível</div></div>`;
  const today = reportMonthLabel();
  const pages = projects.map((proj, index) => {
    const s = computeStats(proj);
    const health = reportHealth(s);
    const margin = s.totalReceita > 0 ? (s.resultado / s.totalReceita * 100) : 0;
    const period = reportPeriod(proj, s);
    const meta = Math.max(0, Math.min(100, s.execPct || 0));
    const medRows = (proj.medicoes || []).slice(0, 18).map(m => {
      const diff = m.receita !== null ? (m.receita || 0) - (m.gasto || 0) : null;
      const cls = diff === null ? '' : diff >= 0 ? 'pos' : 'neg';
      return `<tr><td>${escHtml(m.mes || ('Med ' + m.n))}</td><td>${m.receita === null ? '—' : fmt(m.receita)}</td><td>${fmt(m.gasto || 0)}</td><td class="${cls}">${diff === null ? '—' : signedMoney(diff)}</td><td>${reportStatusText(m)}</td></tr>`;
    }).join('');
    return `<section class="executive-page">
      <div class="exec-topline">
        <div><b>Relatório Executivo</b>Pronto para exportar ou imprimir</div>
        <div>Página ${index + 1}/${projects.length}</div>
      </div>
      <div class="exec-page-head">
        <div class="exec-brand">
          <img src="img/img.png" alt="Engerama">
          <div><h1>ENGERAMA</h1><p>Engenharia e Empreendimentos Ltda.</p></div>
        </div>
        <div class="exec-report-title"><h2>Relatório Financeiro</h2><p>${escHtml(proj.codigo || '')} — ${today}</p></div>
      </div>
      <div class="exec-health">
        <div class="exec-health-left">
          <div class="exec-health-dot ${health.dot}"></div>
          <div><div class="exec-eyebrow">Saúde financeira do projeto</div><div class="exec-health-status ${health.cls}">${health.label}</div></div>
        </div>
        <div class="exec-period"><b>Período</b><br>${escHtml(period.start)} → ${escHtml(period.end)}</div>
      </div>
      <div class="exec-kpis">
        <div class="exec-kpi"><div class="exec-kpi-icon">$</div><div class="exec-kpi-label">Receita Total</div><div class="exec-kpi-value">${fmt(s.totalReceita)}</div></div>
        <div class="exec-kpi"><div class="exec-kpi-icon">↘</div><div class="exec-kpi-label">Gasto Total</div><div class="exec-kpi-value neg">${fmt(s.totalGasto)}</div></div>
        <div class="exec-kpi neg"><div class="exec-kpi-icon">⌁</div><div class="exec-kpi-label">Resultado</div><div class="exec-kpi-value ${s.resultado >= 0 ? '' : 'neg'}">${signedMoney(s.resultado)}</div></div>
        <div class="exec-kpi neg"><div class="exec-kpi-icon">%</div><div class="exec-kpi-label">Margem</div><div class="exec-kpi-value ${margin >= 0 ? 'neutral' : 'neg'}">${margin.toFixed(1)}%</div></div>
      </div>
      <div class="exec-progress">
        <div class="exec-progress-head"><span>Meta de Faturamento</span><b>${s.execPct.toFixed(1)}%</b></div>
        <div class="exec-progress-track"><div class="exec-progress-fill" style="width:${meta}%"></div></div>
        <div class="exec-progress-foot"><span>${fmtShort(s.totalReceita)} realizado</span><span>Meta: ${fmtShort(s.orc)}</span></div>
      </div>
      <div class="exec-section-title">Curva S — acumulado</div>
      <div class="exec-chart">${curveSvg(proj)}</div>
      <div class="exec-section-title">Histórico de medições</div>
      <table class="exec-med-table"><thead><tr><th>Mês</th><th>Receita</th><th>Gasto Real</th><th>Diferença</th><th>Status</th></tr></thead><tbody>${medRows || '<tr><td colspan="5">Sem medições cadastradas.</td></tr>'}</tbody></table>
      <div class="exec-footer"><span>${location.href}</span><span>${index + 1}/${projects.length}</span></div>
    </section>`;
  }).join('');
  return `<div class="executive-report-stack">${pages}</div>`;
}

function populateReportProjectSelect() {
  const select = document.getElementById('report-project-select');
  if (!select) return;
  const current = select.value || 'all';
  const projects = visibleProjects();
  select.innerHTML = `<option value="all">Todas as obras disponíveis</option>` + projects.map(project => `<option value="${project.id}">${project.nome}</option>`).join('');
  select.value = projects.some(project => project.id === current) ? current : 'all';
}

function openPrintPreview() {
  populateReportProjectSelect();
  const selected = document.getElementById('report-project-select')?.value || currentProjectId || 'all';
  const projects = selected === 'all' ? visibleProjects() : visibleProjects().filter(project => project.id === selected);
  document.getElementById('print-preview-content').innerHTML = buildReportHtml(projects);
  document.getElementById('modal-print-preview').classList.add('open');
}
function closePrintPreview(){ document.getElementById('modal-print-preview').classList.remove('open'); }
function ensurePrintOutput() {
  let out = document.getElementById('print-output');
  if (!out) {
    out = document.createElement('div');
    out.id = 'print-output';
    document.body.appendChild(out);
  }
  const preview = document.getElementById('print-preview-content');
  if (!preview || !preview.innerHTML.trim()) openPrintPreview();
  out.innerHTML = document.getElementById('print-preview-content')?.innerHTML || document.getElementById('relatorio-content')?.innerHTML || '';
  return out;
}
function confirmPrintRelatorio(){
  ensurePrintOutput();
  document.body.classList.add('printing-report');
  setTimeout(() => window.print(), 60);
}
async function exportReportPdf(){
  let cleanupPdfOutput = null;
  try {
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      showToast('Biblioteca de PDF ainda não carregou. Aguarde um instante e tente de novo.', 'error');
      return;
    }
    const out = ensurePrintOutput();
    out.classList.add('pdf-rendering');
    cleanupPdfOutput = () => out.classList.remove('pdf-rendering');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const pages = Array.from(out.querySelectorAll('.executive-page'));
    if (!pages.length) {
      showToast('Nada para exportar em PDF.', 'error');
      return;
    }
    showToast('Gerando PDF...', 'warn');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 900
      });
      const img = canvas.toDataURL('image/png');
      if (i > 0) pdf.addPage('a4', 'p');
      pdf.addImage(img, 'PNG', 0, 0, 210, 297);
    }
    const selected = document.getElementById('report-project-select')?.selectedOptions?.[0]?.textContent || 'Relatorio';
    const safeName = selected.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Relatorio';
    pdf.save(`Engerama_${safeName}.pdf`);
    showToast('PDF exportado com sucesso!', 'success');
  } catch (err) {
    showToast('Erro ao exportar PDF: ' + err.message, 'error');
  } finally {
    if (cleanupPdfOutput) cleanupPdfOutput();
  }
}
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-report');
});

function renderUsers() {
  if (!isAdmin()) {
    document.getElementById('view-usuarios').innerHTML = '<div class="view-wrap"><div class="user-card">Apenas administradores podem gerenciar usuarios.</div></div>';
    return;
  }
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const moduleLabels = {obras:'Obras', relatorio:'Relatorio', insumos:'Insumos'};
  tbody.innerHTML = USERS.map(user => {
    const userModules = user.modules || ['obras','relatorio','insumos'];
    const modules = user.role === 'admin' ? 'Todos' : userModules.map(module => moduleLabels[module]).filter(Boolean).join(', ') || 'Nenhum';
    const needsProjects = user.role !== 'admin' && userModules.includes('obras');
    const obras = user.role === 'admin' || user.allProjects ? 'Todas' : needsProjects ? ((user.projectIds || []).map(id => PROJECTS.find(p => p.id === id)?.nome).filter(Boolean).join(', ') || 'Nenhuma') : 'Nao se aplica';
    return `<tr><td style="text-align:left"><b>${escHtml(user.username)}</b><div class="insumo-meta">${escHtml(user.phone || 'Sem celular')}</div></td><td style="text-align:left">${user.role === 'admin' ? '<span style="color:#f0c000">Administrador</span>' : '<span style="color:#4fc3f7">Visualizador</span>'}</td><td>${escHtml(modules)}</td><td>${escHtml(obras)}</td><td><span class="status-pill ${user.active!==false?'status-pos':'status-neg'}">${user.active!==false?'Ativo':'Inativo'}</span></td><td><button class="btn-action" onclick="editUser('${escHtml(user.username)}')">Editar</button><button class="btn-action" onclick="deleteUser('${escHtml(user.username)}')">Apagar</button></td></tr>`;
  }).join('');
  renderUserProjectOptions(true);
}
function setUserProjectSelection(checked) {
  const allInput = document.getElementById('user-project-all');
  if (allInput) allInput.checked = false;
  document.querySelectorAll('#user-project-access input[type="checkbox"]').forEach(input => { input.checked = checked; });
  renderUserProjectOptions();
}
function renderUserProjectOptions(forceFromSaved = false) {
  const box = document.getElementById('user-project-access');
  const moduleBox = document.getElementById('user-module-access');
  if (!box) return;
  const role = document.getElementById('user-form-role')?.value || 'viewer';
  const original = document.getElementById('user-edit-original')?.value;
  const editing = original ? findUser(original) : null;
  const defaultModules = ['obras','relatorio','insumos'];
  const moduleLabel = document.getElementById('user-module-access-label');
  const projectLabel = document.getElementById('user-project-access-label');
  const allInput = document.getElementById('user-project-all');
  if (moduleLabel) moduleLabel.style.display = role === 'admin' ? 'none' : 'flex';
  if (role === 'admin') {
    if (projectLabel) projectLabel.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  if (moduleBox && forceFromSaved) {
    const savedModules = new Set(editing?.modules || defaultModules);
    moduleBox.querySelectorAll('input').forEach(input => { input.checked = savedModules.has(input.value); });
  }

  const modules = Array.from(document.querySelectorAll('#user-module-access input:checked')).map(input => input.value);
  const needsProjectSelection = modules.includes('obras');
  if (projectLabel) projectLabel.style.display = needsProjectSelection ? 'flex' : 'none';

  if (forceFromSaved && allInput) {
    allInput.checked = editing ? editing.allProjects !== false : true;
  }
  const allProjects = allInput ? allInput.checked : true;
  const currentSelected = new Set(Array.from(box.querySelectorAll('input:checked')).map(input => input.value));
  const savedProjectIds = editing?.projectIds?.length ? editing.projectIds : [];
  const selected = forceFromSaved || !box.children.length ? new Set(savedProjectIds) : currentSelected;
  box.innerHTML = PROJECTS.map(project => `<label class="user-project-option"><input type="checkbox" value="${project.id}" ${selected.has(project.id)?'checked':''}> ${escHtml(project.nome)}</label>`).join('');
  box.classList.toggle('disabled', allProjects);
  box.querySelectorAll('input').forEach(input => { input.disabled = allProjects; });
}
function resetUserForm() {
  ['user-edit-original','user-form-username','user-form-phone','user-form-password','user-form-admin-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('user-form-role').value = 'viewer';
  document.getElementById('user-form-active').value = 'true';
  document.getElementById('user-form-msg').textContent = '';
  document.querySelectorAll('#user-module-access input').forEach(input => { input.checked = true; });
  renderUserProjectOptions(true);
}
function editUser(username) {
  const user = findUser(username);
  if (!user) return;
  document.getElementById('user-edit-original').value = user.username;
  document.getElementById('user-form-username').value = user.username;
  document.getElementById('user-form-phone').value = user.phone || '';
  document.getElementById('user-form-role').value = user.role;
  document.getElementById('user-form-active').value = String(user.active !== false);
  document.getElementById('user-form-password').value = '';
  document.getElementById('user-form-admin-password').value = '';
  renderUserProjectOptions(true);
}
function adminPasswordMatches(password){return USERS.some(user=>user.role==='admin'&&user.active!==false&&userPasswordMatches(user, password));}
function saveUser(event) {
  event.preventDefault();
  const original = document.getElementById('user-edit-original').value;
  const existing = original ? findUser(original) : null;
  const username = document.getElementById('user-form-username').value.trim();
  const phone = document.getElementById('user-form-phone').value.trim();
  const role = document.getElementById('user-form-role').value;
  const active = document.getElementById('user-form-active').value === 'true';
  const newPassword = document.getElementById('user-form-password').value;
  const adminPassword = document.getElementById('user-form-admin-password').value;
  const msg = document.getElementById('user-form-msg');
  const projectIds = role === 'admin' ? [] : Array.from(document.querySelectorAll('#user-project-access input:checked')).map(input => input.value);
  const modules = role === 'admin' ? ['obras','relatorio','insumos','usuarios'] : Array.from(document.querySelectorAll('#user-module-access input:checked')).map(input => input.value);
  const needsProjectSelection = role !== 'admin' && modules.includes('obras');
  const allProjects = role === 'admin' || !needsProjectSelection || document.getElementById('user-project-all')?.checked !== false;
  if (!username) { msg.textContent = 'Informe o usuário.'; return; }
  if (findUser(username) && findUser(username) !== existing) { msg.textContent = 'Já existe um usuário com esse login.'; return; }
  if (role !== 'admin' && !normalizePhoneForWhatsApp(phone)) { msg.textContent = 'Informe o celular/WhatsApp do usuário.'; return; }
  if (role !== 'admin' && !modules.length) { msg.textContent = 'Escolha pelo menos uma tela para o visualizador.'; return; }
  if (needsProjectSelection && !allProjects && !projectIds.length) { msg.textContent = 'Selecione uma obra ou marque Todas as obras.'; return; }
  if ((!existing || newPassword) && !adminPasswordMatches(adminPassword)) { msg.textContent = 'Confirme a senha de administrador para criar ou trocar senha.'; return; }
  if (!existing && !newPassword) { msg.textContent = 'Informe uma senha para o novo usuário.'; return; }
  if (existing) {
    existing.username = existing.username.toLowerCase() === 'admin' ? existing.username : username;
    existing.role = existing.username.toLowerCase() === 'admin' ? 'admin' : role;
    existing.active = existing.username.toLowerCase() === 'admin' ? true : active;
    existing.phone = phone;
    existing.allProjects = existing.role === 'admin' ? true : allProjects;
    existing.projectIds = existing.role === 'admin' || allProjects ? [] : projectIds;
    existing.modules = existing.role === 'admin' ? ['obras','relatorio','insumos','usuarios'] : modules;
    if (newPassword) existing.passwordHash = hashLocalPassword(newPassword);
    existing.updatedAt = new Date().toISOString();
  } else {
    USERS.push({username, passwordHash:hashLocalPassword(newPassword), phone, role, active, allProjects, projectIds:allProjects ? [] : projectIds, modules, updatedAt:new Date().toISOString()});
  }
  if (!saveUsers()) return;
  renderUsers(); resetUserForm(); msg.textContent = 'Usuário salvo com sucesso.';
}
function deleteUser(username) {
  if (username === currentUser) { showToast('Você não pode apagar o usuário logado.', 'error'); return; }
  if (username.toLowerCase() === 'admin') { showToast('O admin principal não pode ser apagado.', 'error'); return; }
  const pass = prompt('Digite a senha de administrador para apagar este usuário:');
  if (!adminPasswordMatches(pass)) { showToast('Senha de administrador incorreta.', 'error'); return; }
  if (!confirm('Apagar o usuário "' + username + '"?')) return;
  const previousUsers = USERS.slice();
  USERS = USERS.filter(user => user.username !== username);
  if (!saveUsers()) {
    USERS = previousUsers;
    return;
  }
  renderUsers(); resetUserForm(); showToast('Usuário apagado.', 'success');
}

// ══ EXPORT EXCEL ══════════════════════════════════════════════════════════
function safeFilePart(value) {
  return String(value || 'Relatorio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'Relatorio';
}
function downloadWorkbook(wb, filename) {
  const data = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([data], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 500);
}
function exportExcel() {
  try {
    if (!window.XLSX) {
      showToast('Biblioteca do Excel não carregou. Verifique a internet e recarregue a página.', 'error');
      return;
    }
    const selectedReportId = document.getElementById('report-project-select')?.value;
    const reportProject = selectedReportId && selectedReportId !== 'all' ? visibleProjects().find(project => project.id === selectedReportId) : null;
    const proj = reportProject || currentProject();
    if (!proj) {
      showToast('Abra uma obra antes de exportar o Excel.', 'error');
      return;
    }
    const s = computeStats(proj);
    const baseMensal = proj.orcamento > 0 ? proj.orcamento / Math.max(getProjectMonths(proj),1) : 3500000;
    const wb = XLSX.utils.book_new();

    const info = [
      ['Campo','Valor'],
      ['Nome', proj.nome || ''],
      ['Código', proj.codigo || ''],
      ['Status', proj.status || ''],
      ['Orçamento', proj.orcamento || 0],
      ['Início', proj.inicio || ''],
      ['Término', proj.termino || ''],
      ['Descrição', proj.descricao || ''],
      ['Receita total', s.totalReceita],
      ['Gasto total', s.totalGasto],
      ['Resultado', s.resultado],
      ['Orçamento utilizado (%)', s.orcPct],
    ];
    const infoWs = XLSX.utils.aoa_to_sheet(info);
    infoWs['!cols'] = [{wch:24},{wch:46}];
    XLSX.utils.book_append_sheet(wb, infoWs, 'Info');

    const medicoes = [[
      'Nº','Mês','Receita (R$)','Gasto Real (R$)','Diferença (R$)','Status','% Desempenho'
    ]];
    (proj.medicoes || []).forEach(m => {
      const diff = (m.receita !== null && m.receita !== undefined && m.gasto !== null && m.gasto !== undefined) ? (m.receita || 0) - (m.gasto || 0) : null;
      const status = m.current ? 'Em andamento' : diff === null ? '-' : diff >= 0 ? 'Positivo' : 'Negativo';
      const pct = m.receita !== null && m.receita !== undefined ? (m.receita / baseMensal * 100) : null;
      medicoes.push([m.n || '', m.mes || '', m.receita ?? '', m.gasto ?? '', diff ?? '', status, pct ?? '']);
    });
    const medWs = XLSX.utils.aoa_to_sheet(medicoes);
    medWs['!cols'] = [{wch:6},{wch:16},{wch:18},{wch:18},{wch:18},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb, medWs, 'Medicoes');

    const curva = [['Mês','Previsto Acum. (mi)','Receita Acum. (mi)','Gasto Acum. (mi)']];
    (proj.curva || []).forEach(c => curva.push([c.l || '', c.p ?? '', c.r ?? '', c.c ?? '']));
    const curvaWs = XLSX.utils.aoa_to_sheet(curva);
    curvaWs['!cols'] = [{wch:14},{wch:20},{wch:20},{wch:20}];
    XLSX.utils.book_append_sheet(wb, curvaWs, 'Curva S');

    const resumo = [
      ['Indicador','Valor'],
      ['Receita Total', s.totalReceita],
      ['Gasto Total', s.totalGasto],
      ['Resultado', s.resultado],
      ['Previsto Acumulado', s.prevAcum],
      ['Previsto x Realizado (%)', s.pvr],
      ['Meses positivos', s.mesesPos],
      ['Meses negativos', s.mesesNeg],
    ];
    const resumoWs = XLSX.utils.aoa_to_sheet(resumo);
    resumoWs['!cols'] = [{wch:28},{wch:18}];
    XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');

    downloadWorkbook(wb, `Engerama_${safeFilePart(proj.codigo || proj.nome)}_CronogramaFinanceiro.xlsx`);
    showToast('Excel exportado com sucesso!', 'success');
  } catch (err) {
    showToast('Erro ao exportar Excel: ' + err.message, 'error');
  }
}

// ══ IMPORT EXCEL ══════════════════════════════════════════════════════════
function importExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      if (!window.XLSX) {
        showToast('Biblioteca do Excel não carregou. Recarregue a página e tente novamente.', 'error');
        return;
      }

      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, {type:'array', cellDates:true});
      const proj = currentProject();
      if (!proj) {
        showToast('Abra uma obra antes de importar o Excel.', 'error');
        return;
      }

      const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const num = value => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const cleaned = String(value).replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const excelDate = value => {
        if (!value) return null;
        if (value instanceof Date && !isNaN(value)) return value;
        if (typeof value === 'number') {
          const parsed = XLSX.SSF.parse_date_code(value);
          if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
        }
        const d = new Date(value);
        return isNaN(d) ? null : d;
      };
      const monthLabel = date => date ? `${MESES_PT[date.getMonth()]} ${date.getFullYear()}` : '';
      const curveLabel = date => date ? `${MESES_PT[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}` : '';
      const isoDate = date => date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` : '';

      const resumoName = wb.SheetNames.find(name => norm(name) === 'resumo' || norm(name).includes('resumo'));
      const resumoWs = resumoName ? wb.Sheets[resumoName] : null;
      if (!resumoWs) {
        showToast('Aba Resumo não encontrada. Importe uma planilha no padrão do cronograma.', 'error');
        return;
      }

      const rows = XLSX.utils.sheet_to_json(resumoWs, {header:1, defval:null, raw:true});
      const budget = num(resumoWs['E51']?.v) ?? num(resumoWs['F50']?.v);
      if (!budget || budget <= 0) {
        showToast('Orçamento não encontrado em Resumo!E51/F50.', 'error');
        return;
      }

      const novas = [];
      const novaCurva = [];
      const dates = [];
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] || [];
        const medTxt = String(row[0] || '').trim();
        if (!/^med\s*\d+/i.test(medTxt)) continue;
        const dt = excelDate(row[1]);
        if (!dt) continue;

        const n = parseInt((medTxt.match(/\d+/) || [novas.length + 1])[0], 10);
        const receita = num(row[2]);
        const realAcum = num(row[3]);
        const prevAcum = num(row[5]);
        const gasto = num(row[6]);
        const gastoAcum = num(row[7]);
        const temDados = receita !== null || realAcum !== null || prevAcum !== null || gasto !== null || gastoAcum !== null;
        if (!temDados) continue;

        dates.push(dt);
        novas.push({
          n,
          mes: monthLabel(dt),
          receita,
          gasto: gasto ?? 0,
          current: receita === null && gasto !== null,
        });
        novaCurva.push({
          l: curveLabel(dt),
          p: prevAcum !== null ? prevAcum / 1000000 : null,
          r: realAcum !== null ? realAcum / 1000000 : null,
          c: gasto !== null && gastoAcum !== null ? gastoAcum / 1000000 : null,
        });
      }

      if (!novas.length) {
        showToast('Nenhuma medição válida encontrada na aba Resumo.', 'error');
        return;
      }

      // Atualização completa: cada importação substitui os dados antigos pelos valores atuais da planilha.
      proj.orcamento = budget;
      proj.medicoes = novas;
      proj.curva = novaCurva;
      if (dates.length) {
        proj.inicio = isoDate(dates[0]);
        proj.termino = isoDate(dates[dates.length - 1]);
      }
      proj.descricao = 'Dados atualizados pela importação: ' + file.name;
      proj.updatedAt = new Date().toISOString();

      saveProjects();
      showToast(`${novas.length} medições importadas. Orçamento atualizado: ${fmt(proj.orcamento)}`, 'success');
      renderDashboard();
      renderDetail();
      renderRelatorio();
    } catch(err) {
      showToast('Erro ao importar: ' + err.message, 'error');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

// ══ MODELO EXCEL ══════════════════════════════════════════════════════════
function downloadModelo() {
  const ws_data = [
    ['Nº','Mês','Receita (R$)','Gasto Real (R$)','Diferença (R$)','Status','% Desempenho'],
    [1,'Out 2024',0,156892.78,'','Negativo','0.0%'],
    [2,'Nov 2024',615161.51,227667.34,'','Positivo','17.6%'],
    [3,'Dez 2024',1809480.44,1395670.96,'','Positivo','51.7%'],
    ['...','...','...','...','','',''],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{wch:5},{wch:15},{wch:18},{wch:18},{wch:18},{wch:15},{wch:15}];
  XLSX.utils.book_append_sheet(wb, ws, 'Medicoes');

  const cs_data = [
    ['Mês','Previsto Acum. (mi)','Receita Acum. (mi)','Gasto Acum. (mi)'],
    ['Out/24',0,null,0.157],
    ['Nov/24',0.615,0.615,0.385],
    ['Dez/24',2.425,2.425,1.780],
    ['...','...','...','...'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(cs_data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Curva S');

  XLSX.writeFile(wb, 'Modelo_Engerama.xlsx');
  showToast('Modelo Excel baixado!', 'success');
}



// Modulo de Insumos / Pedidos de Materiais
const LS_INSUMOS = 'engerama_insumos_pedidos_v1';
const LS_INSUMOS_BACKUP = 'engerama_insumos_pedidos_v1_backup';
const LS_INSUMO_UNITS = 'engerama_insumos_unidades_v1';
const COMPRAS_WHATSAPP = '5541992449307';
const DEFAULT_INSUMO_UNITS = ['metro linear','metro','m²','quilo','peça','litro'];
const INSUMO_ITEM_SUGGESTIONS = [
  {name:'Cimento CP-II 50 kg', unit:'peça', hint:'Saco individual'},
  {name:'Areia média', unit:'metro', hint:'Medir volume solicitado'},
  {name:'Brita 1', unit:'metro', hint:'Medir volume solicitado'},
  {name:'Vergalhão CA-50', unit:'metro linear', hint:'Barras por metro linear'},
  {name:'Tubo PVC', unit:'metro linear', hint:'Comprimento linear'},
  {name:'Conduíte corrugado', unit:'metro linear', hint:'Comprimento linear'},
  {name:'Argamassa ACIII', unit:'peça', hint:'Saco individual'},
  {name:'Tinta acrílica', unit:'litro', hint:'Quantidade em litros'},
  {name:'Parafuso', unit:'peça', hint:'Quantidade de itens'},
  {name:'Cabo elétrico', unit:'metro linear', hint:'Comprimento linear'},
  {name:'Manta asfáltica', unit:'m²', hint:'Área em metro quadrado'},
  {name:'Aço cortado e dobrado', unit:'quilo', hint:'Peso em quilos'}
];
let pendingPurchaseNfe = null;
let pendingInsumoFormItems = [];
let INSUMO_ORDERS = loadInsumoOrders();
let INSUMO_UNITS = loadInsumoUnits();

function loadInsumoOrders() {
  const saved = loadPersistedJson(LS_INSUMOS, LS_INSUMOS_BACKUP, [], true);
  return Array.isArray(saved) ? saved : [];
}
function compactAttachmentForStorage(file) {
  if (!file || !file.data) return file;
  if (String(file.data).length <= 950000) return file;
  return {
    ...file,
    data: '',
    stored: false,
    note: 'Anexo removido do armazenamento local por tamanho. Reanexe uma versao menor se precisar visualizar o arquivo.'
  };
}
function compactOrderForStorage(order) {
  return {
    ...order,
    attachments: (order.attachments || []).map(compactAttachmentForStorage),
    purchaseAttachments: (order.purchaseAttachments || []).map(compactAttachmentForStorage),
    nfe: order.nfe ? compactAttachmentForStorage(order.nfe) : order.nfe
  };
}
function saveInsumoOrders() {
  if (savePersistedJson(LS_INSUMOS, LS_INSUMOS_BACKUP, INSUMO_ORDERS, 'pedidos', true)) return true;
  const compactOrders = INSUMO_ORDERS.map(compactOrderForStorage);
  if (savePersistedJson(LS_INSUMOS, LS_INSUMOS_BACKUP, compactOrders, 'pedidos', true)) {
    INSUMO_ORDERS = compactOrders;
    showToast('Pedido salvo. Alguns anexos grandes ficaram apenas como referencia para nao travar o app.', 'warn');
    return true;
  }
  showToast('Nao foi possivel salvar pedidos. Reduza a quantidade/tamanho dos anexos.', 'error');
  return false;
}
function loadInsumoUnits() {
  return DEFAULT_INSUMO_UNITS.slice();
}
function saveInsumoUnits() {
  try { localStorage.setItem(LS_INSUMO_UNITS, JSON.stringify(INSUMO_UNITS)); } catch(e) {}
}
function insumoId() {
  return 'ins_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
}
function todayISO() {
  return new Date().toISOString().slice(0,10);
}
function dateTimeBR(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}
function dateTimeBRFull(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return String(value || '');
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}
function statusInsumoLabel(status) {
  return status === 'concluido' ? 'Concluido' : status === 'em_rota' ? 'Em rota' : 'Pendente';
}
function statusInsumoClass(status) {
  return status === 'concluido' ? 'concluido' : status === 'em_rota' ? 'em_rota' : 'pendente';
}
function neededByClass(value, status) {
  if (!value || status === 'concluido') return '';
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(value + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return '';
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays < 0) return 'urgent';
  if (diffDays <= 7) return 'soon';
  return '';
}
function visibleProjectIdsSet() {
  return new Set(visibleProjects().map(project => project.id));
}
function renderInsumoProjectOptions() {
  const projects = visibleProjects();
  const form = document.getElementById('insumo-form-obra');
  const filter = document.getElementById('insumo-filter-obra');
  if (!form || !filter) return;
  const previousForm = form.value;
  const previousFilter = filter.value || 'all';
  form.innerHTML = projects.map(project => '<option value="' + escHtml(project.id) + '">' + escHtml(project.nome) + '</option>').join('');
  filter.innerHTML = '<option value="all">Todas as obras</option>' + projects.map(project => '<option value="' + escHtml(project.id) + '">' + escHtml(project.nome) + '</option>').join('');
  if (projects.some(project => project.id === previousForm)) form.value = previousForm;
  if (projects.some(project => project.id === previousFilter) || previousFilter === 'all') filter.value = previousFilter;
}
function renderInsumoUnits() {
  const list = document.getElementById('insumo-unidades-list');
  const formSelect = document.getElementById('insumo-form-unidade');
  const purchaseSelect = document.getElementById('insumo-compra-unidade-edit');
  const editSelect = document.getElementById('insumo-edit-unidade');
  const options = INSUMO_UNITS.map(unit => '<option value="' + escHtml(unit) + '">' + escHtml(unit) + '</option>').join('');
  if (list) list.innerHTML = INSUMO_UNITS.map(unit => '<option value="' + escHtml(unit) + '"></option>').join('');
  if (formSelect) {
    const previous = formSelect.value;
    formSelect.innerHTML = '<option value="">Selecione</option>' + options;
    if (INSUMO_UNITS.includes(previous)) formSelect.value = previous;
  }
  if (purchaseSelect) {
    const previous = purchaseSelect.value;
    purchaseSelect.innerHTML = options;
    if (INSUMO_UNITS.includes(previous)) purchaseSelect.value = previous;
  }
  if (editSelect) {
    const previous = editSelect.value;
    editSelect.innerHTML = options;
    if (INSUMO_UNITS.includes(previous)) editSelect.value = previous;
  }
}
function normalizeInsumoText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function normalizeInsumoUnit(value) {
  const v = normalizeInsumoText(value).replace(/\s+/g,' ').trim();
  if (['m linear','metro linear','ml'].includes(v)) return 'metro linear';
  if (['m','metro','metros'].includes(v)) return 'metro';
  if (['m2','m²','metro quadrado','metros quadrados'].includes(v)) return 'm²';
  if (['kg','quilo','quilos'].includes(v)) return 'quilo';
  if (['pc','pç','peca','peça','un','und','unidade','unidades'].includes(v)) return 'peça';
  if (['l','lt','litro','litros'].includes(v)) return 'litro';
  return INSUMO_UNITS.includes(value) ? value : 'peça';
}
function materialThumbText(name) {
  return String(name || '?').trim().slice(0,2).toUpperCase();
}
function showMaterialSuggestions(value) {
  const box = document.getElementById('material-suggestions');
  if (!box) return;
  const q = normalizeInsumoText(value);
  const items = INSUMO_ITEM_SUGGESTIONS
    .filter(item => !q || normalizeInsumoText(item.name).includes(q))
    .slice(0,6);
  if (!items.length) {
    box.classList.remove('open');
    box.innerHTML = '';
    return;
  }
  box.innerHTML = items.map(item =>
    '<div class="material-suggestion" onclick="selectMaterialSuggestion(\'' + escJs(item.name) + '\',\'' + escJs(item.unit) + '\')">' +
      '<div class="material-thumb">' + escHtml(materialThumbText(item.name)) + '</div>' +
      '<div><b>' + escHtml(item.name) + '</b><span>' + escHtml(item.hint) + ' · ' + escHtml(item.unit) + '</span></div>' +
    '</div>'
  ).join('');
  box.classList.add('open');
}
function selectMaterialSuggestion(name, unit) {
  const input = document.getElementById('insumo-form-material');
  const unitInput = document.getElementById('insumo-form-unidade');
  if (input) input.value = name;
  if (unitInput) unitInput.value = unit;
  document.getElementById('material-suggestions')?.classList.remove('open');
}
function normalizeInsumoItems(order) {
  const raw = Array.isArray(order?.items) && order.items.length
    ? order.items
    : [{material: order?.material, quantidade: order?.quantidade, unidade: order?.unidade}];
  return raw
    .map(item => ({
      material: String(item?.material || '').trim(),
      quantidade: item?.quantidade ?? '',
      unidade: normalizeInsumoUnit(item?.unidade || '')
    }))
    .filter(item => item.material && String(item.quantidade || '').trim());
}
function syncPrimaryInsumoItem(order) {
  const items = normalizeInsumoItems(order);
  order.items = items;
  const first = items[0] || {material:'', quantidade:'', unidade:''};
  order.material = first.material;
  order.quantidade = first.quantidade;
  order.unidade = first.unidade;
  return items;
}
function formatInsumoItem(item) {
  return String(item.quantidade || '-') + ' ' + String(item.unidade || '') + ' - ' + String(item.material || '-');
}
function formatInsumoItemWhatsApp(item) {
  return String(item.material || '-') + ' — ' + String(item.quantidade || '-') + ' ' + String(item.unidade || '');
}
function insumoItemsTextWhatsApp(order) {
  const items = normalizeInsumoItems(order);
  return items.length ? items.map(formatInsumoItemWhatsApp).join('\n') : '-';
}
function nextInsumoPedidoNumber() {
  const max = INSUMO_ORDERS.reduce((highest, order) => {
    const n = Number(String(order.numeroPedido || '').replace(/\D/g, ''));
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return String(max + 1).padStart(3, '0');
}
function ensureInsumoPedidoNumbers() {
  let max = INSUMO_ORDERS.reduce((highest, order) => {
    const n = Number(String(order.numeroPedido || '').replace(/\D/g, ''));
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  let changed = false;
  INSUMO_ORDERS.forEach(order => {
    if (!String(order.numeroPedido || '').trim()) {
      max += 1;
      order.numeroPedido = String(max).padStart(3, '0');
      changed = true;
    }
  });
  if (changed) saveInsumoOrders();
}
function insumoItemsTitle(order) {
  const items = normalizeInsumoItems(order);
  if (items.length <= 1) return items[0]?.material || order?.material || '-';
  return items.length + ' itens no pedido';
}
function insumoItemsQtySummary(order) {
  const items = normalizeInsumoItems(order);
  if (items.length <= 1) return (items[0]?.quantidade || order?.quantidade || '-') + ' ' + (items[0]?.unidade || order?.unidade || '');
  return items.length + ' itens';
}
function insumoItemsText(order) {
  const items = normalizeInsumoItems(order);
  return items.length ? items.map((item, index) => (index + 1) + '. ' + formatInsumoItem(item)).join('\n') : '-';
}
function insumoItemsMiniHtml(order, limit = 3) {
  const items = normalizeInsumoItems(order);
  if (items.length <= 1) return '';
  const visible = items.slice(0, limit).map(item => '<div>' + escHtml(formatInsumoItem(item)) + '</div>').join('');
  const more = items.length > limit ? '<span>+' + (items.length - limit) + ' item(ns)</span>' : '';
  return '<div class="insumo-items-mini">' + visible + more + '</div>';
}
function renderInsumoFormItemsList() {
  const box = document.getElementById('insumo-form-itens-list');
  if (!box) return;
  if (!pendingInsumoFormItems.length) {
    box.innerHTML = '<div class="insumo-meta">Adicione mais itens aqui ou registre com apenas o material preenchido acima.</div>';
    return;
  }
  box.innerHTML = pendingInsumoFormItems.map((item, index) =>
    '<div class="insumo-item-chip"><div><b>' + escHtml(item.material) + '</b><span>' + escHtml(item.quantidade + ' ' + item.unidade) + '</span></div><button type="button" onclick="removeInsumoFormItem(' + index + ')" title="Remover item">x</button></div>'
  ).join('');
}
function readInsumoItemInputs() {
  const material = document.getElementById('insumo-form-material')?.value.trim() || '';
  const quantidade = document.getElementById('insumo-form-qtd')?.value || '';
  const unitRaw = document.getElementById('insumo-form-unidade')?.value.trim() || '';
  if (!material || !quantidade || !unitRaw) return null;
  const unidade = normalizeInsumoUnit(unitRaw);
  if (!INSUMO_UNITS.includes(unidade)) return null;
  return {material, quantidade, unidade};
}
function clearInsumoItemInputs() {
  const material = document.getElementById('insumo-form-material');
  const qtd = document.getElementById('insumo-form-qtd');
  const unit = document.getElementById('insumo-form-unidade');
  if (material) material.value = '';
  if (qtd) qtd.value = '';
  if (unit) unit.value = '';
  document.getElementById('material-suggestions')?.classList.remove('open');
}
function addInsumoItemFromForm() {
  const item = readInsumoItemInputs();
  if (!item) {
    showToast('Preencha material, quantidade e unidade para adicionar.', 'error');
    return;
  }
  pendingInsumoFormItems.push(item);
  clearInsumoItemInputs();
  renderInsumoFormItemsList();
}
function removeInsumoFormItem(index) {
  pendingInsumoFormItems.splice(index, 1);
  renderInsumoFormItemsList();
}
function escJs(value) {
  return String(value || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
const INSUMO_MAX_IMAGE_SIDE = 1000;
const INSUMO_IMAGE_QUALITY = 0.68;
const INSUMO_MAX_STORED_FILE_BYTES = 700 * 1024;

function dataUrlBytes(dataUrl) {
  const raw = String(dataUrl || '').split(',')[1] || '';
  return Math.round(raw.length * 0.75);
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function compressImageDataURL(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, INSUMO_MAX_IMAGE_SIDE / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', INSUMO_IMAGE_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
async function fileToAttachment(file) {
  const isImage = String(file.type || '').startsWith('image/');
  const base = {
    id: insumoId(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    originalSize: file.size || 0,
    uploadedBy: currentUser,
    uploadedAt: new Date().toISOString()
  };
  if (isImage) {
    const original = await readFileAsDataURL(file);
    const compressed = await compressImageDataURL(original);
    return {
      ...base,
      type: 'image/jpeg',
      name: String(file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg',
      size: dataUrlBytes(compressed),
      data: compressed,
      compressed: true
    };
  }
  if ((file.size || 0) > INSUMO_MAX_STORED_FILE_BYTES) {
    return {
      ...base,
      size: file.size || 0,
      data: '',
      stored: false,
      note: 'Arquivo grande demais para ficar salvo dentro do navegador. O pedido foi salvo com a referencia do anexo.'
    };
  }
  const data = await readFileAsDataURL(file);
  return {...base, size: file.size || dataUrlBytes(data), data, stored: true};
}
async function filesToAttachments(fileList) {
  const files = Array.from(fileList || []);
  const limited = files.slice(0,8);
  const attachments = await Promise.all(limited.map(fileToAttachment));
  if (attachments.some(file => file && file.stored === false)) {
    showToast('Alguns anexos eram grandes e foram salvos apenas como referencia.', 'warn');
  }
  return attachments;
}
function attachmentListHtml(attachments) {
  const files = Array.isArray(attachments) ? attachments : [];
  if (!files.length) return '<span class="insumo-meta">Nenhum anexo.</span>';
  const chips = '<div class="insumo-file-row">' + files.map(file =>
    '<a class="insumo-file-chip" href="' + escHtml(file.data || '#') + '" ' + (file.data ? 'download="' + escHtml(file.name || 'anexo') + '" target="_blank"' : 'title="' + escHtml(file.note || 'Arquivo salvo como referencia') + '"') + '>' +
      (String(file.type || '').startsWith('image/') ? 'Foto' : 'Anexo') + ': ' + escHtml(file.name || 'arquivo') +
      (!file.data ? ' (referencia)' : '') +
    '</a>'
  ).join('') + '</div>';
  const previews = files.filter(file => String(file.type || '').startsWith('image/') && file.data).map(file =>
    '<a href="' + escHtml(file.data) + '" target="_blank" download="' + escHtml(file.name || 'foto') + '">' +
      '<img src="' + escHtml(file.data) + '" alt="' + escHtml(file.name || 'foto') + '">' +
      '<span>' + escHtml(file.name || 'foto') + '</span>' +
    '</a>'
  ).join('');
  return chips + (previews ? '<div class="insumo-attachment-preview">' + previews + '</div>' : '');
}
function recordInsumoChange(order, action, detail) {
  order.history = Array.isArray(order.history) ? order.history : [];
  order.history.push({action, detail, user: currentUser, at: new Date().toISOString()});
}
function sendInsumoEmailNotice(order, type) {
  return false;
  if (type === 'solicitacao') {
    return sendComprasNewPedidoWhatsApp(order);
  }
  if (refreshNfeItemsFromText(order)) saveInsumoOrders();
  const project = PROJECTS.find(project => project.id === order.obraId);
  const pedido = order.numeroPedido || order.id;
  const subject = (type === 'compra' ? '[Engerama] Compra registrada' : '[Engerama] Nova solicitacao de material') + ' - ' + insumoItemsTitle(order);
  const requestFiles = Array.isArray(order.attachments) ? order.attachments : [];
  const purchaseFiles = Array.isArray(order.purchaseAttachments) ? order.purchaseAttachments : [];
  const photoFiles = [...requestFiles, ...purchaseFiles].filter(file => String(file.type || '').startsWith('image/'));
  const otherFiles = [...requestFiles, ...purchaseFiles, ...(order.nfe ? [order.nfe] : [])].filter(file => !String(file.type || '').startsWith('image/'));
  const fileLine = files => files.length ? files.map(file => '- ' + (file.name || 'arquivo') + ' (' + Math.round((file.size || 0) / 1024) + ' KB)').join('\n') : '- Nenhum';
  const body = [
    'ENGERAMA - GESTAO DE INSUMOS',
    type === 'compra' ? 'Compra registrada no sistema' : 'Nova solicitacao de material registrada',
    '------------------------------------------------------------',
    '',
    'RESUMO DO PEDIDO',
    'Pedido: ' + pedido,
    'Status: ' + statusInsumoLabel(order.status),
    'Obra: ' + (project?.nome || '-'),
    'Itens do pedido:',
    insumoItemsText(order),
    order.neededBy ? 'Necessario para: ' + dateTimeBR(order.neededBy) : '',
    '',
    'SOLICITACAO',
    'Solicitado por: ' + (order.requestedBy || '-'),
    'Data/hora da solicitacao: ' + dateTimeBR(order.requestedAt),
    'Observacao: ' + (order.observacao || '-'),
    '',
    'COMPRA',
    'Fornecedor: ' + (order.fornecedor || 'Aguardando compra'),
    'Comprado por: ' + (order.boughtBy || '-'),
    'Data/hora da compra: ' + (order.boughtAt || order.dataCompra ? dateTimeBR(order.boughtAt || order.dataCompra) : '-'),
    'Comentario da compra: ' + (order.purchaseComment || '-'),
    order.nfe?.name ? 'NFE anexada no pedido: ' + order.nfe.name : '',
    '',
    'FOTOS ANEXADAS AO PEDIDO',
    fileLine(photoFiles),
    '',
    'OUTROS ANEXOS',
    fileLine(otherFiles),
    '',
    'IMPORTANTE',
    'As fotos e anexos ficam salvos dentro do pedido no sistema. Para visualizar, abra a tela Insumos e clique no icone de olho do pedido.',
    '',
    'Aviso gerado pelo sistema Engerama.'
  ].filter(Boolean).join('\n');
  const url = '#';
  openInsumoEmailReport(order, type, subject, body, url);
}
function buildInsumoEmailReportHtml(order, type, subject, textBody, mailtoUrl) {
  const project = PROJECTS.find(project => project.id === order.obraId);
  const requestFiles = Array.isArray(order.attachments) ? order.attachments : [];
  const purchaseFiles = Array.isArray(order.purchaseAttachments) ? order.purchaseAttachments : [];
  const photos = [...requestFiles, ...purchaseFiles].filter(file => String(file.type || '').startsWith('image/') && file.data);
  const attachments = [...requestFiles, ...purchaseFiles, ...(order.nfe ? [order.nfe] : [])];
  const reportTitle = type === 'compra' ? 'Compra registrada' : 'Solicitação de material';
  const baseHref = location.href.slice(0, location.href.lastIndexOf('/') + 1);
  const photoHtml = photos.length
    ? photos.map(file => '<figure><img src="' + escHtml(file.data) + '" alt="' + escHtml(file.name || 'foto') + '"><figcaption>' + escHtml(file.name || 'foto') + '</figcaption></figure>').join('')
    : '<div class="empty">Nenhuma foto anexada ao pedido.</div>';
  const attachmentHtml = attachments.length
    ? attachments.map(file => '<li><b>' + escHtml(file.name || 'arquivo') + '</b><span>' + Math.round((file.size || 0) / 1024) + ' KB</span></li>').join('')
    : '<li><b>Nenhum anexo</b><span>-</span></li>';
  const nfeInfo = order.nfe?.name
    ? '<li><b>' + escHtml(order.nfe.name) + '</b><span>' + Math.round((order.nfe.size || 0) / 1024) + ' KB</span></li>'
    : '<li><b>Nenhuma NFE anexada</b><span>-</span></li>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base href="${escHtml(baseHref)}">
<title>${escHtml(subject)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#eef0f4;color:#171717;font-family:Segoe UI,Arial,sans-serif;}
.toolbar{position:sticky;top:0;z-index:5;background:#20232b;color:#fff;padding:14px 22px;display:flex;justify-content:space-between;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.toolbar b{font-size:14px}
.toolbar-actions{display:flex;gap:8px;flex-wrap:wrap}
.toolbar a,.toolbar button{border:1px solid rgba(255,255,255,.22);background:#f0c000;color:#111;border-radius:8px;padding:9px 13px;font-weight:800;text-decoration:none;cursor:pointer}
.toolbar button.secondary{background:transparent;color:#fff}
.page{width:780px;max-width:calc(100vw - 28px);margin:28px auto;background:#fff;border:1px solid #d8dbe2;border-radius:3px;padding:30px 34px 36px;box-shadow:0 24px 70px rgba(0,0,0,.18)}
.head{display:flex;justify-content:space-between;gap:20px;border:1.5px solid #202020;border-radius:8px;padding:18px 20px;margin-bottom:24px}
.brand{display:flex;align-items:center;gap:13px}
.brand img{width:58px;height:58px;object-fit:contain;background:#000;border-radius:4px}
.brand h1{font-size:23px;margin:0;letter-spacing:.3px}
.brand p{margin:3px 0 0;color:#555;font-size:12px}
.title{text-align:right}
.title h2{margin:0;font-size:17px}
.title p{margin:5px 0 0;color:#666;font-size:12px}
.status{border:1.5px solid #333;border-radius:10px;padding:16px 18px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center}
.status strong{display:block;color:#d2a900;font-size:18px;margin-top:3px}
.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#777}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
.card{border:1.5px solid #333;border-radius:9px;padding:14px 12px;min-height:92px}
.card span{display:block;font-size:10px;color:#777;margin-bottom:8px}
.card b{font-size:14px;line-height:1.25}
.section{margin-top:22px}
.section h3{font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:.9px;margin:0 0 10px}
.box{border:1px solid #d9dce4;border-radius:9px;padding:14px 16px;background:#fbfcfe;font-size:13px;line-height:1.55}
.kv{display:grid;grid-template-columns:160px 1fr;gap:10px;border-bottom:1px solid #eceef3;padding:8px 0}
.kv:last-child{border-bottom:0}
.kv span{color:#777;font-size:12px}
.kv b{font-size:13px}
.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.photos figure{margin:0;border:1px solid #d9dce4;border-radius:9px;overflow:hidden;background:#fff}
.photos img{width:100%;height:150px;object-fit:cover;display:block}
.photos figcaption{font-size:11px;color:#555;padding:8px 9px;word-break:break-word}
.empty{padding:18px;border:1px dashed #ccd1dc;border-radius:9px;color:#777;font-size:12px}
ul.clean{margin:0;padding-left:18px;font-size:12px;line-height:1.55}
.attach-list{list-style:none;margin:0;padding:0}
.attach-list li{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #eceef3;padding:8px 0;font-size:12px}
.attach-list li:last-child{border-bottom:0}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#777;font-size:11px;display:flex;justify-content:space-between;gap:12px}
@media print{body{background:#fff}.toolbar{display:none}.page{box-shadow:none;margin:0 auto;border:0}.photos img{height:130px}}
@media(max-width:720px){.grid{grid-template-columns:1fr 1fr}.photos{grid-template-columns:1fr}.head,.status{flex-direction:column}.title{text-align:left}}
</style>
</head>
<body>
<div class="toolbar">
  <b>Relatório visual para e-mail</b>
  <div class="toolbar-actions">
    <a href="#">E-mail desativado</a>
    <button onclick="window.print()">Salvar PDF / Imprimir</button>
    <button class="secondary" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.body.innerText)">Copiar texto</button>
  </div>
</div>
<main class="page">
  <div class="head">
    <div class="brand"><img src="img/img.png" alt="Engerama"><div><h1>ENGERAMA</h1><p>Engenharia e Empreendimentos Ltda.</p></div></div>
    <div class="title"><h2>${escHtml(reportTitle)}</h2><p>${escHtml(project?.codigo || '')} - ${escHtml(new Date().toLocaleDateString('pt-BR'))}</p></div>
  </div>
  <div class="status"><div><div class="eyebrow">Status do pedido</div><strong>${escHtml(statusInsumoLabel(order.status))}</strong></div><div><div class="eyebrow">Pedido</div><b>${escHtml(order.numeroPedido || order.id)}</b></div></div>
  <div class="grid">
    <div class="card"><span>Obra</span><b>${escHtml(project?.nome || '-')}</b></div>
    <div class="card"><span>Pedido</span><b>${escHtml(insumoItemsTitle(order))}</b></div>
    <div class="card"><span>Itens</span><b>${escHtml(insumoItemsQtySummary(order))}</b></div>
    <div class="card"><span>Necessário para</span><b>${escHtml(order.neededBy ? dateTimeBR(order.neededBy) : '-')}</b></div>
  </div>
  <section class="section"><h3>Itens solicitados</h3><div class="box">${escHtml(insumoItemsText(order)).replace(/\n/g,'<br>')}</div></section>
  <section class="section"><h3>Solicitação</h3><div class="box">
    <div class="kv"><span>Quem pediu</span><b>${escHtml(order.requestedBy || '-')}</b></div>
    <div class="kv"><span>Data e hora</span><b>${escHtml(dateTimeBR(order.requestedAt))}</b></div>
    <div class="kv"><span>Descrição</span><b>${escHtml(order.observacao || '-')}</b></div>
  </div></section>
  <section class="section"><h3>Compra</h3><div class="box">
    <div class="kv"><span>Fornecedor</span><b>${escHtml(order.fornecedor || 'Aguardando compra')}</b></div>
    <div class="kv"><span>Comprado por</span><b>${escHtml(order.boughtBy || '-')}</b></div>
    <div class="kv"><span>Data da compra</span><b>${escHtml(order.boughtAt || order.dataCompra ? dateTimeBR(order.boughtAt || order.dataCompra) : '-')}</b></div>
    <div class="kv"><span>Comentário</span><b>${escHtml(order.purchaseComment || '-')}</b></div>
    <div class="kv"><span>NFE</span><b>${escHtml(order.nfe?.name || '-')}</b></div>
  </div></section>
  <section class="section"><h3>Fotos anexadas</h3><div class="photos">${photoHtml}</div></section>
  <section class="section"><h3>Anexos do pedido</h3><div class="box"><ul class="attach-list">${attachmentHtml}</ul></div></section>
  <section class="section"><h3>NFE anexada</h3><div class="box"><ul class="attach-list">${nfeInfo}</ul></div></section>
  <div class="footer"><span>Este relatório foi gerado automaticamente pelo sistema Engerama.</span><span>${escHtml(location.href)}</span></div>
</main>
</body>
</html>`;
}
function openInsumoEmailReport(order, type, subject, textBody, mailtoUrl) {
  return false;
  const report = buildInsumoEmailReportHtml(order, type, subject, textBody, mailtoUrl);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(report);
    win.document.close();
    showToast('Relatório visual do e-mail aberto.', 'success');
  }
  try {
    const mail = document.createElement('a');
    mail.href = mailtoUrl;
    mail.style.display = 'none';
    document.body.appendChild(mail);
    mail.click();
    mail.remove();
  } catch(e) {
    try { window.location.href = mailtoUrl; } catch(err) {}
  }
}
function sendPurchaseWhatsAppNotice(order) {
  const requester = findUser(order.requestedBy || '');
  const phone = normalizePhoneForWhatsApp(requester?.phone || '');
  if (!phone) {
    showToast('Compra salva. Usuario solicitante sem celular cadastrado para WhatsApp.', 'warn');
    return false;
  }
  const project = PROJECTS.find(project => project.id === order.obraId);
  const message = [
    'Olá, ' + (requester.username || order.requestedBy || '') + '!',
    '',
    'Seu pedido de material foi comprado pela Engerama.',
    'Pedido: ' + (order.numeroPedido || order.id),
    'Obra: ' + (project?.nome || '-'),
    'Itens:',
    insumoItemsText(order),
    'Fornecedor: ' + (order.fornecedor || '-'),
    'Comprado por: ' + (order.boughtBy || currentUser || '-'),
    'Data da compra: ' + dateTimeBR(order.boughtAt || order.dataCompra || new Date().toISOString()),
    order.purchaseComment ? 'Observação: ' + order.purchaseComment : '',
    '',
    'O pedido agora está em rota.'
  ].filter(Boolean).join('\n');
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
  try {
    window.open(url, '_blank');
    return true;
  } catch(e) {
    try { window.location.href = url; return true; } catch(err) {}
  }
  return false;
}
function openWhatsAppToCompras(message) {
  const url = 'https://wa.me/' + COMPRAS_WHATSAPP + '?text=' + encodeURIComponent(message);
  try {
    window.open(url, '_blank');
    return true;
  } catch(e) {
    try { window.location.href = url; return true; } catch(err) {}
  }
  return false;
}
function sendComprasNewPedidoWhatsApp(order) {
  const project = PROJECTS.find(project => project.id === order.obraId);
  const msg = [
    'Novo pedido "#' + (order.numeroPedido || order.id) + '"',
    'Solicitado por: ' + (order.requestedBy || '-') + ' - ' + (project?.nome || 'Obra'),
    'Data: ' + dateTimeBRFull(order.requestedAt || new Date().toISOString()),
    '',
    'Itens:',
    insumoItemsTextWhatsApp(order),
    '',
    order.neededBy ? 'Precisa em: ' + dateTimeBR(order.neededBy) : '',
    order.observacao ? 'Observação: ' + order.observacao : ''
  ].filter(Boolean).join('\n');
  return openWhatsAppToCompras(msg);
}
function sendComprasAlteracaoWhatsApp(order, beforeText, motivo) {
  const project = PROJECTS.find(project => project.id === order.obraId);
  const msg = [
    'Pedido "#' + (order.numeroPedido || order.id) + '"',
    'Alterado por: ' + (currentUser || '-') + ' - ' + (project?.nome || 'Obra'),
    'Data: ' + dateTimeBRFull(new Date().toISOString()),
    '',
    'Antes:',
    beforeText || '-',
    '',
    'Depois:',
    insumoItemsTextWhatsApp(order),
    '',
    'Motivo:',
    motivo || '-'
  ].join('\n');
  return openWhatsAppToCompras(msg);
}
function renderNfePreview(nfe) {
  const el = document.getElementById('insumo-nfe-preview');
  if (!el) return;
  if (!nfe) {
    el.innerHTML = 'Compras anexa a NFE aqui. Ela ficará salva para baixar no pedido.';
    return;
  }
  el.innerHTML = '<b>' + escHtml(nfe.name || 'NFE anexada') + '</b><div class="insumo-meta">' +
    (nfe.data ? 'NFE anexada e disponivel para download.' : 'NFE registrada como referencia. Arquivo grande demais para salvar dentro do navegador.') +
    '</div>';
}
async function readInsumoNfeFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const attachment = await fileToAttachment(file);
    pendingPurchaseNfe = {...attachment, text: '', items: []};
    renderNfePreview(pendingPurchaseNfe);
    showToast('NFE anexada ao pedido.', 'success');
  } catch(err) {
    showToast('Nao foi possivel anexar a NFE: ' + err.message, 'error');
  }
}
function pdfTextContentToLines(content) {
  const rows = [];
  (content.items || []).forEach(item => {
    const str = String(item.str || '').trim();
    if (!str) return;
    const x = item.transform?.[4] || 0;
    const y = Math.round(item.transform?.[5] || 0);
    let row = rows.find(line => Math.abs(line.y - y) <= 3);
    if (!row) {
      row = {y, items:[]};
      rows.push(row);
    }
    row.items.push({x, str});
  });
  return rows
    .sort((a,b) => b.y - a.y)
    .map(row => row.items.sort((a,b) => a.x - b.x).map(item => item.str).join(' ').replace(/\s+/g,' ').trim())
    .filter(Boolean);
}
function formatNfeQuantity(value) {
  const parsed = Number(String(value || '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return String(value || '').trim();
  return parsed.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
function extractNfeQuantityFromLine(prefix) {
  const compact = String(prefix || '').replace(/\s+/g, '');
  if (!compact) return null;
  const afterMoneyMatches = [...compact.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}(\d{1,6},\d{3})(UN|PC|KG|LT|MT|ML|M2|M3|BR|M|L)(?=[A-Z0-9])/g)];
  const match = afterMoneyMatches.length ? afterMoneyMatches[afterMoneyMatches.length - 1] : null;
  if (match) return { quantity: formatNfeQuantity(match[1]), unit: match[2] };
  const loose = compact.match(/(?:^|[^0-9])(\d{1,6},\d{3})(UN|PC|KG|LT|MT|ML|M2|M3|BR|M|L)(?=[A-Z0-9])/);
  if (loose) return { quantity: formatNfeQuantity(loose[1]), unit: loose[2] };
  return null;
}
function extractNfeItems(text) {
  const source = String(text || '').replace(/\r/g, '\n');
  const start = source.search(/DADOS\s+DO\s+PRODUTO|DESCRI\S*O\s+DO\s+(?:PRODUTO|ITEM)/i);
  const endCandidates = [
    source.search(/C[ÁA]LCULO\s+DO\s+ISSQN/i),
    source.search(/DADOS\s+ADICIONAIS/i),
    source.search(/INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES/i)
  ].filter(index => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : source.length;
  const productText = start >= 0 ? source.slice(start, end) : source;
  const cleanLines = productText.split(/\n+/).map(line => line.replace(/\s+/g,' ').trim()).filter(Boolean);
  const stopWords = /danfe|nota fiscal|chave de acesso|protocolo|emitente|destinatario|transportador|calculo|duplicata|total|fone|cep|serie|página|pagina|endereço|municipio|fatura|icms|inscri[cç][aã]o/i;
  const items = [];
  cleanLines.forEach(line => {
    let l = line.replace(/\s+/g,' ').trim();
    if (l.length < 12 || stopWords.test(l)) return;
    if (/c[oó]d\.?\s*produto|descri\S*o\s+do\s+(produto|item)|ncm\/sh|aliq|valor\s+icms/i.test(l)) return;
    let desc = '';
    const descMatch = l.match(/0,00\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .#\/()\-]{5,})$/i);
    if (descMatch) desc = descMatch[1];
    if (!desc) {
      const fallback = l.match(/\d{8}\s+0,00\d{1,3}\s+[\d.,]+\s+0,00(.+)$/i);
      if (fallback) desc = fallback[1];
    }
    if (!desc) return;
    desc = desc.replace(/\s+/g,' ').replace(/^[-:.\s]+/,'').trim();
    if (desc.length < 5 || !/[A-Za-zÀ-ÿ]{4,}/.test(desc)) return;
    const descIndex = l.lastIndexOf(desc);
    const prefix = descIndex > -1 ? l.slice(0, descIndex) : l;
    const qtyInfo = extractNfeQuantityFromLine(prefix);
    const label = (qtyInfo ? 'Qtd. ' + qtyInfo.quantity + ' ' + qtyInfo.unit + ' - ' : '') + desc.slice(0,120);
    if (!items.some(item => normalizeInsumoText(item) === normalizeInsumoText(label))) items.push(label);
  });
  return items.slice(0,20);
}
function refreshNfeItemsFromText(order) {
  if (!order?.nfe) return false;
  if (!Array.isArray(order.nfe.items) || order.nfe.items.length === 0) return false;
  order.nfe.items = [];
  return true;
}
function renderInsumos() {
  const tbody = document.getElementById('insumos-tbody');
  if (!tbody) return;
  renderInsumoProjectOptions();
  renderInsumoUnits();
  renderInsumoFormItemsList();
  ensureInsumoPedidoNumbers();
  const deleteAllBtn = document.getElementById('btn-delete-all-insumos');
  if (deleteAllBtn) deleteAllBtn.style.display = isAdmin() ? 'flex' : 'none';
  const allowed = visibleProjectIdsSet();
  const obraFilter = document.getElementById('insumo-filter-obra')?.value || 'all';
  const statusFilter = document.getElementById('insumo-filter-status')?.value || 'all';
  let orders = INSUMO_ORDERS.filter(order => allowed.has(order.obraId));
  const allVisible = orders.slice();
  if (obraFilter !== 'all') orders = orders.filter(order => order.obraId === obraFilter);
  if (statusFilter !== 'all') orders = orders.filter(order => order.status === statusFilter);
  document.getElementById('insumo-kpi-pendente').textContent = allVisible.filter(order => order.status === 'pendente').length;
  document.getElementById('insumo-kpi-rota').textContent = allVisible.filter(order => order.status === 'em_rota').length;
  document.getElementById('insumo-kpi-concluido').textContent = allVisible.filter(order => order.status === 'concluido').length;
  document.getElementById('insumo-kpi-total').textContent = allVisible.length;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="insumos-empty">Nenhum pedido encontrado para os filtros atuais.</div></td></tr>';
    return;
  }
  const projectById = new Map(PROJECTS.map(project => [project.id, project]));
  tbody.innerHTML = orders.sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).map(order => {
    const project = projectById.get(order.obraId);
    const attachmentInfo = (order.attachments?.length || order.purchaseAttachments?.length || order.nfe?.name)
      ? '<div class="insumo-meta">Anexos: ' + ((order.attachments?.length || 0) + (order.purchaseAttachments?.length || 0) + (order.nfe?.name ? 1 : 0)) + '</div>'
      : '';
    const itemsMini = insumoItemsMiniHtml(order);
    const actions = [
      order.status === 'pendente' ? '<button class="btn-action primary insumo-mobile-buy" title="Comprar pedido" onclick="openInsumoPurchaseModal(\'' + order.id + '\')">Comprar</button>' : '',
      '<button class="btn-action insumo-eye-btn" title="Ver pedido completo" onclick="openInsumoDetailModal(\'' + order.id + '\')">👁</button>'
    ].filter(Boolean).join('');
    return '<tr>' +
      '<td><b>' + escHtml(order.numeroPedido || order.id.slice(-5)) + '</b><div class="insumo-meta">' + escHtml(project?.nome || 'Obra removida') + '</div></td>' +
      '<td><div class="insumo-material">' + escHtml(insumoItemsTitle(order)) + '</div><div class="insumo-meta">' + escHtml(insumoItemsQtySummary(order)) + '</div>' + itemsMini + attachmentInfo + '</td>' +
      '<td><span class="insumo-status ' + statusInsumoClass(order.status) + '">' + statusInsumoLabel(order.status) + '</span></td>' +
      '<td><div class="insumo-actions">' + actions + '</div></td>' +
    '</tr>';
  }).join('');
}
function toggleMobileInsumoForm(forceOpen) {
  const panel = document.querySelector('#view-insumos .insumos-panel');
  if (!panel) return;
  const open = forceOpen === true || !panel.classList.contains('mobile-form-open');
  panel.classList.toggle('mobile-form-open', open);
}
function projectLocationText(project) {
  if (!project) return '';
  const parts = [project.endereco, project.cidade, project.estado]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  return [project.nome, project.descricao, project.codigo]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}
function supplierSearchUrl(material, project) {
  const query = [material, 'material de construcao', projectLocationText(project)].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/search/' + encodeURIComponent(query);
}
function renderChosenSuppliers(order) {
  const box = document.getElementById('chosen-suppliers-list');
  if (!box) return;
  const suppliers = Array.isArray(order?.supplierQuotes) ? order.supplierQuotes : [];
  if (!suppliers.length) {
    box.innerHTML = '<div class="insumo-meta">Nenhum fornecedor cadastrado manualmente neste pedido.</div>';
    return;
  }
  box.innerHTML = suppliers.map(supplier =>
    '<div class="supplier-saved-card">' +
      '<b>' + escHtml(supplier.name || '-') + '</b>' +
      '<span>' + escHtml([supplier.phone, supplier.price, supplier.deadline].filter(Boolean).join(' - ') || '-') + '</span>' +
      '<small>' + escHtml(supplier.address || '') + '</small>' +
      (supplier.notes ? '<small>' + escHtml(supplier.notes) + '</small>' : '') +
    '</div>'
  ).join('');
}
function supplierQuotesHtml(order) {
  const suppliers = Array.isArray(order?.supplierQuotes) ? order.supplierQuotes : [];
  if (!suppliers.length) return '<div class="insumo-meta">Nenhum fornecedor escolhido cadastrado.</div>';
  return '<div class="supplier-chosen-list">' + suppliers.map(supplier =>
    '<div class="supplier-saved-card">' +
      '<b>' + escHtml(supplier.name || '-') + '</b>' +
      '<span>' + escHtml([supplier.phone, supplier.price, supplier.deadline].filter(Boolean).join(' - ') || '-') + '</span>' +
      '<small>' + escHtml(supplier.address || '') + '</small>' +
      (supplier.notes ? '<small>' + escHtml(supplier.notes) + '</small>' : '') +
      '<small>' + escHtml(supplier.registeredBy || '-') + ' - ' + dateTimeBR(supplier.registeredAt) + '</small>' +
    '</div>'
  ).join('') + '</div>';
}
function renderSupplierSuggestions(order) {
  const panel = document.getElementById('supplier-suggestions-panel');
  if (!panel || !order) return;
  const project = PROJECTS.find(project => project.id === order.obraId);
  const locationText = projectLocationText(project) || 'local da obra';
  const items = normalizeInsumoItems(order);
  panel.innerHTML =
    '<div class="supplier-panel-head"><b>Buscas prontas</b><span>' + escHtml(locationText) + '</span></div>' +
    '<div class="supplier-search-grid">' +
      items.map(item => {
        const material = item.material || 'material';
        return '<a class="supplier-search-card" href="' + escHtml(supplierSearchUrl(material, project)) + '" target="_blank" rel="noopener">' +
          '<b>Buscar fornecedores para ' + escHtml(material) + '</b>' +
          '<span>Google Maps perto da obra</span>' +
        '</a>';
      }).join('') +
    '</div>' +
    '<div class="supplier-note">A escolha e o cadastro do fornecedor sao manuais. O sistema nao busca avaliacoes nem salva dados do Google.</div>';
}
function toggleSupplierSuggestions(forceOpen) {
  const id = document.getElementById('insumo-compra-id')?.value;
  const order = INSUMO_ORDERS.find(item => item.id === id);
  const panel = document.getElementById('supplier-suggestions-panel');
  if (!order || !panel) return;
  const open = forceOpen === true || panel.style.display === 'none' || !panel.style.display;
  panel.style.display = open ? 'block' : 'none';
  if (open) renderSupplierSuggestions(order);
}
function toggleChosenSupplierForm(forceOpen) {
  const id = document.getElementById('insumo-compra-id')?.value;
  const order = INSUMO_ORDERS.find(item => item.id === id);
  const form = document.getElementById('chosen-supplier-form');
  if (!form) return;
  const open = forceOpen === true || form.style.display === 'none' || !form.style.display;
  form.style.display = open ? 'block' : 'none';
  if (open) renderChosenSuppliers(order);
}
function clearChosenSupplierInputs() {
  ['supplier-name','supplier-phone','supplier-address','supplier-price','supplier-deadline','supplier-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}
function saveChosenSupplier() {
  const id = document.getElementById('insumo-compra-id')?.value;
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  const supplier = {
    id: insumoId(),
    name: document.getElementById('supplier-name')?.value.trim() || '',
    phone: document.getElementById('supplier-phone')?.value.trim() || '',
    address: document.getElementById('supplier-address')?.value.trim() || '',
    price: document.getElementById('supplier-price')?.value.trim() || '',
    deadline: document.getElementById('supplier-deadline')?.value.trim() || '',
    notes: document.getElementById('supplier-notes')?.value.trim() || '',
    registeredBy: currentUser,
    registeredAt: new Date().toISOString()
  };
  if (!supplier.name) {
    showToast('Informe o nome do fornecedor escolhido.', 'error');
    return;
  }
  order.supplierQuotes = Array.isArray(order.supplierQuotes) ? order.supplierQuotes : [];
  order.supplierQuotes.push(supplier);
  order.updatedAt = new Date().toISOString();
  const fornecedorInput = document.getElementById('insumo-compra-fornecedor');
  if (fornecedorInput && !fornecedorInput.value.trim()) fornecedorInput.value = supplier.name;
  recordInsumoChange(order, 'Fornecedor cadastrado manualmente', supplier.name);
  saveInsumoOrders();
  clearChosenSupplierInputs();
  renderChosenSuppliers(order);
  showToast('Fornecedor cadastrado no pedido.', 'success');
}
async function saveInsumoPedido(event) {
  event.preventDefault();
  const obraId = document.getElementById('insumo-form-obra').value;
  const observacao = document.getElementById('insumo-form-obs').value.trim();
  const neededBy = document.getElementById('insumo-form-needed-by')?.value || '';
  const typedItem = readInsumoItemInputs();
  const items = pendingInsumoFormItems.slice();
  if (typedItem) items.push(typedItem);
  if (!obraId || !items.length) {
    showToast('Preencha obra, material, quantidade e unidade.', 'error');
    return;
  }
  if (items.some(item => !INSUMO_UNITS.includes(item.unidade))) {
    showToast('Selecione uma das unidades principais.', 'error');
    return;
  }
  const attachments = await filesToAttachments(document.getElementById('insumo-form-foto')?.files || []);
  const firstItem = items[0];
  const order = {
    id: insumoId(),
    obraId,
    numeroPedido: nextInsumoPedidoNumber(),
    material: firstItem.material,
    quantidade: firstItem.quantidade,
    unidade: firstItem.unidade,
    items,
    observacao,
    neededBy,
    status: 'pendente',
    requestedBy: currentUser,
    requestedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments,
    purchaseAttachments: [],
    history: []
  };
  recordInsumoChange(order, 'Solicitacao criada', 'Pedido registrado pela obra.');
  INSUMO_ORDERS.push(order);
  if (!saveInsumoOrders()) return;
  event.target.reset();
  document.getElementById('insumo-form-obra').value = obraId;
  pendingInsumoFormItems = [];
  renderInsumoFormItemsList();
  const pdfOk = exportInsumoPedidoPdf(order.id, {auto:true});
  const whatsOk = sendComprasNewPedidoWhatsApp(order);
  showToast(pdfOk
    ? 'Pedido registrado. PDF baixado e WhatsApp preparado para compras.'
    : 'Pedido registrado. WhatsApp preparado, mas o PDF nao foi baixado.',
    whatsOk && pdfOk ? 'success' : 'warn');
  renderInsumos();
}
function openInsumoPurchaseModal(id) {
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  if (refreshNfeItemsFromText(order)) saveInsumoOrders();
  pendingPurchaseNfe = order.nfe || null;
  renderInsumoUnits();
  document.getElementById('insumo-compra-id').value = id;
  document.getElementById('insumo-compra-material').innerHTML = escHtml(insumoItemsTitle(order)) + '<span>' + escHtml(insumoItemsQtySummary(order)) + '</span>';
  document.getElementById('insumo-compra-material-edit').value = order.material || '';
  document.getElementById('insumo-compra-qtd-edit').value = order.quantidade || '';
  document.getElementById('insumo-compra-unidade-edit').value = normalizeInsumoUnit(order.unidade);
  document.getElementById('insumo-compra-fornecedor').value = order.fornecedor || '';
  document.getElementById('insumo-compra-data').value = order.dataCompra || todayISO();
  document.getElementById('insumo-compra-comentario').value = order.purchaseComment || '';
  document.getElementById('insumo-compra-anexos').value = '';
  document.getElementById('insumo-compra-anexos-list').innerHTML = attachmentListHtml(order.purchaseAttachments || []);
  document.getElementById('insumo-compra-nfe').value = '';
  renderNfePreview(order.nfe || null);
  const supplierPanel = document.getElementById('supplier-suggestions-panel');
  if (supplierPanel) {
    supplierPanel.style.display = 'none';
    supplierPanel.innerHTML = '';
  }
  const supplierForm = document.getElementById('chosen-supplier-form');
  if (supplierForm) supplierForm.style.display = 'none';
  clearChosenSupplierInputs();
  renderChosenSuppliers(order);
  document.getElementById('modal-insumo-compra').classList.add('open');
  setTimeout(() => document.getElementById('insumo-compra-fornecedor')?.focus(), 80);
}
function closeInsumoPurchaseModal() {
  document.getElementById('modal-insumo-compra')?.classList.remove('open');
}
async function saveInsumoPurchase(event) {
  event.preventDefault();
  const id = document.getElementById('insumo-compra-id').value;
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  const oldSnapshot = {
    material: order.material,
    quantidade: order.quantidade,
    unidade: order.unidade,
    itemsText: insumoItemsText(order),
    observacao: order.observacao
  };
  const editedMaterial = document.getElementById('insumo-compra-material-edit').value.trim() || order.material || 'Material sem nome';
  const editedQtd = document.getElementById('insumo-compra-qtd-edit').value || order.quantidade || 1;
  const editedUnit = normalizeInsumoUnit(document.getElementById('insumo-compra-unidade-edit').value || order.unidade || 'peça');
  const fornecedor = document.getElementById('insumo-compra-fornecedor').value.trim();
  const dataCompra = document.getElementById('insumo-compra-data').value || todayISO();
  const purchaseComment = document.getElementById('insumo-compra-comentario').value.trim();
  if (!fornecedor) {
    showToast('Informe o fornecedor.', 'error');
    return;
  }
  order.material = editedMaterial;
  order.quantidade = editedQtd;
  order.unidade = editedUnit;
  const currentItems = normalizeInsumoItems(order);
  order.items = currentItems.length ? currentItems : [{material: editedMaterial, quantidade: editedQtd, unidade: editedUnit}];
  order.items[0] = {material: editedMaterial, quantidade: editedQtd, unidade: editedUnit};
  order.fornecedor = fornecedor;
  order.dataCompra = dataCompra;
  order.boughtBy = currentUser;
  order.boughtAt = new Date().toISOString();
  order.purchaseComment = purchaseComment;
  order.purchaseAttachments = [
    ...(Array.isArray(order.purchaseAttachments) ? order.purchaseAttachments : []),
    ...(await filesToAttachments(document.getElementById('insumo-compra-anexos')?.files || []))
  ];
  if (pendingPurchaseNfe) order.nfe = pendingPurchaseNfe;
  if (oldSnapshot.itemsText !== insumoItemsText(order)) {
    recordInsumoChange(order, 'Pedido ajustado na compra', 'De: ' + oldSnapshot.itemsText + ' | Para: ' + insumoItemsText(order));
  }
  recordInsumoChange(order, 'Compra registrada', 'Fornecedor: ' + fornecedor);
  order.status = 'em_rota';
  order.updatedAt = new Date().toISOString();
  if (!saveInsumoOrders()) return;
  closeInsumoPurchaseModal();
  showToast('Compra registrada. Pedido agora esta em rota.', 'success');
  sendPurchaseWhatsAppNotice(order);
  renderInsumos();
}
function markInsumoPurchased(id) {
  openInsumoPurchaseModal(id);
}
function openInsumoReceiveModal(id) {
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  if (refreshNfeItemsFromText(order)) saveInsumoOrders();
  document.getElementById('insumo-receber-id').value = id;
  document.getElementById('insumo-receber-material').innerHTML = escHtml(insumoItemsTitle(order)) + '<span>' + escHtml(insumoItemsQtySummary(order)) + '</span>';
  document.getElementById('insumo-receber-comentario').value = order.receiveComment || '';
  renderReceiveNfeAttachment(order);
  document.getElementById('modal-insumo-receber').classList.add('open');
  setTimeout(() => document.getElementById('insumo-receber-comentario')?.focus(), 80);
}
function closeInsumoReceiveModal() {
  document.getElementById('modal-insumo-receber')?.classList.remove('open');
}
function renderReceiveNfeAttachment(order) {
  const box = document.getElementById('insumo-receber-nfe');
  if (!box) return;
  if (!order?.nfe?.name) {
    box.innerHTML = 'Nenhuma NFE anexada neste pedido.';
    return;
  }
  box.innerHTML = attachmentListHtml([order.nfe]);
}
function saveInsumoReceive(event) {
  event.preventDefault();
  const id = document.getElementById('insumo-receber-id').value;
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  const receiveComment = document.getElementById('insumo-receber-comentario').value.trim();
  order.receivedBy = currentUser;
  order.receivedAt = new Date().toISOString();
  order.receiveComment = receiveComment;
  recordInsumoChange(order, 'Recebimento confirmado', 'Material recebido pela obra.');
  order.status = 'concluido';
  order.updatedAt = new Date().toISOString();
  if (!saveInsumoOrders()) return;
  closeInsumoReceiveModal();
  showToast('Material recebido e pedido concluido.', 'success');
  renderInsumos();
}
function markInsumoReceived(id) {
  openInsumoReceiveModal(id);
}
document.getElementById('modal-insumo-compra')?.addEventListener('click', function(event){ if (event.target === this) closeInsumoPurchaseModal(); });
document.getElementById('modal-insumo-editar')?.addEventListener('click', function(event){ if (event.target === this) closeInsumoEditModal(); });
document.getElementById('modal-insumo-receber')?.addEventListener('click', function(event){ if (event.target === this) closeInsumoReceiveModal(); });
document.getElementById('modal-insumo-detalhe')?.addEventListener('click', function(event){ if (event.target === this) closeInsumoDetailModal(); });
document.addEventListener('click', function(event) {
  if (!event.target.closest?.('.material-suggest-wrap')) document.getElementById('material-suggestions')?.classList.remove('open');
});

function openInsumoEditModal(id) {
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  if (order.status !== 'pendente') {
    showToast('Pedido so pode ser alterado antes da compra.', 'warn');
    return;
  }
  const first = normalizeInsumoItems(order)[0] || {material: order.material, quantidade: order.quantidade, unidade: order.unidade};
  renderInsumoUnits();
  document.getElementById('insumo-edit-id').value = id;
  document.getElementById('insumo-edit-title').innerHTML = 'Pedido #' + escHtml(order.numeroPedido || order.id) + '<span>Pendente</span>';
  document.getElementById('insumo-edit-material').value = first.material || '';
  document.getElementById('insumo-edit-qtd').value = first.quantidade || '';
  document.getElementById('insumo-edit-unidade').value = normalizeInsumoUnit(first.unidade || order.unidade || 'peça');
  document.getElementById('insumo-edit-needed-by').value = order.neededBy || '';
  document.getElementById('insumo-edit-obs').value = order.observacao || '';
  document.getElementById('insumo-edit-motivo').value = '';
  document.getElementById('modal-insumo-editar').classList.add('open');
  setTimeout(() => document.getElementById('insumo-edit-qtd')?.focus(), 80);
}
function closeInsumoEditModal() {
  document.getElementById('modal-insumo-editar')?.classList.remove('open');
}
function saveInsumoEdit(event) {
  event.preventDefault();
  const id = document.getElementById('insumo-edit-id').value;
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order || order.status !== 'pendente') return;
  const material = document.getElementById('insumo-edit-material').value.trim();
  const quantidade = document.getElementById('insumo-edit-qtd').value;
  const unidade = normalizeInsumoUnit(document.getElementById('insumo-edit-unidade').value || 'peça');
  const neededBy = document.getElementById('insumo-edit-needed-by').value || '';
  const observacao = document.getElementById('insumo-edit-obs').value.trim();
  const motivo = document.getElementById('insumo-edit-motivo').value.trim();
  if (!material || !quantidade || !unidade) {
    showToast('Preencha material, quantidade e unidade.', 'error');
    return;
  }
  if (!motivo) {
    showToast('Informe o motivo da alteração.', 'error');
    return;
  }
  const beforeText = insumoItemsTextWhatsApp(order);
  const items = normalizeInsumoItems(order);
  items[0] = {material, quantidade, unidade};
  order.items = items;
  syncPrimaryInsumoItem(order);
  order.neededBy = neededBy;
  order.observacao = observacao;
  recordInsumoChange(order, 'Pedido alterado pela obra', motivo);
  order.updatedAt = new Date().toISOString();
  if (!saveInsumoOrders()) return;
  sendComprasAlteracaoWhatsApp(order, beforeText, motivo);
  closeInsumoEditModal();
  showToast('Pedido alterado e WhatsApp preparado para compras.', 'success');
  renderInsumos();
}

function openInsumoDetailModal(id) {
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order) return;
  if (refreshNfeItemsFromText(order)) saveInsumoOrders();
  const project = PROJECTS.find(project => project.id === order.obraId);
  const history = Array.isArray(order.history) ? order.history : [];
  const content = document.getElementById('insumo-detail-content');
  const detailActions = [
    order.status === 'pendente' ? '<button class="btn-action" onclick="openEditFromDetail(\'' + escJs(order.id) + '\')">Editar pedido</button>' : '',
    order.status === 'pendente' ? '<button class="btn-action primary" onclick="openPurchaseFromDetail(\'' + escJs(order.id) + '\')">Comprar</button>' : '',
    order.status === 'em_rota' ? '<button class="btn-action primary" onclick="openReceiveFromDetail(\'' + escJs(order.id) + '\')">Receber</button>' : '',
    '<button class="btn-action" onclick="exportInsumoPedidoPdf(\'' + escJs(order.id) + '\')">Gerar PDF</button>',
    isAdmin() ? '<button class="btn-action" onclick="deleteInsumoFromDetail(\'' + escJs(order.id) + '\')">Apagar</button>' : ''
  ].filter(Boolean).join('');
  content.innerHTML =
    '<div class="insumo-flow-actions insumo-detail-actions-top">' + detailActions + '</div>' +
    '<div class="insumo-detail-grid">' +
      detailBox('Pedido', order.numeroPedido || order.id) +
      detailBox('Status', statusInsumoLabel(order.status)) +
      detailBox('Obra', project?.nome || '-') +
      detailBox('Itens', insumoItemsText(order)) +
      detailBox('Quem pediu', (order.requestedBy || '-') + ' · ' + dateTimeBR(order.requestedAt)) +
      detailBox('Compra', order.fornecedor ? (order.fornecedor + ' · ' + (order.boughtBy || '-') + ' · ' + dateTimeBR(order.boughtAt || order.dataCompra)) : 'Aguardando compras') +
      detailBox('Recebimento', order.receivedBy ? (order.receivedBy + ' · ' + dateTimeBR(order.receivedAt)) : 'Ainda nao recebido') +
      detailBox('Para quando', order.neededBy ? dateTimeBR(order.neededBy) : '-') +
    '</div>' +
    '<div class="insumo-detail-section"><h3>Descricao e comentarios</h3><div class="insumo-detail-box"><b>' + escHtml(order.observacao || '-') + '</b>' +
      (order.purchaseComment ? '<br><br><span>Compra</span><b>' + escHtml(order.purchaseComment) + '</b>' : '') +
      (order.receiveComment ? '<br><br><span>Recebimento</span><b>' + escHtml(order.receiveComment) + '</b>' : '') +
    '</div></div>' +
    '<div class="insumo-detail-section"><h3>Fornecedores escolhidos</h3>' + supplierQuotesHtml(order) + '</div>' +
    '<div class="insumo-detail-section"><h3>NFE anexada</h3>' + attachmentListHtml(order.nfe ? [order.nfe] : []) + '</div>' +
    '<div class="insumo-detail-section"><h3>Anexos</h3>' + attachmentListHtml([...(order.attachments || []), ...(order.purchaseAttachments || []), ...(order.nfe ? [order.nfe] : [])]) + '</div>' +
    '<div class="insumo-detail-section"><h3>Alteracoes</h3><div class="insumo-timeline">' +
      (history.length ? history.map(item => '<div class="insumo-timeline-item"><b>' + escHtml(item.action) + '</b><small>' + escHtml(item.user || '-') + ' · ' + dateTimeBR(item.at) + '</small><div>' + escHtml(item.detail || '') + '</div></div>').join('') : '<div class="insumo-meta">Sem alteracoes registradas.</div>') +
    '</div></div>' +
    '<div class="insumo-flow-actions" style="margin-top:16px">' + detailActions + '</div>';
  document.getElementById('modal-insumo-detalhe').classList.add('open');
}
function closeInsumoDetailModal() {
  document.getElementById('modal-insumo-detalhe')?.classList.remove('open');
}
function openEditFromDetail(id) {
  closeInsumoDetailModal();
  openInsumoEditModal(id);
}
function openPurchaseFromDetail(id) {
  closeInsumoDetailModal();
  openInsumoPurchaseModal(id);
}
function openReceiveFromDetail(id) {
  closeInsumoDetailModal();
  openInsumoReceiveModal(id);
}
function deleteInsumoFromDetail(id) {
  closeInsumoDetailModal();
  deleteInsumoPedido(id);
}
function detailBox(label, value) {
  return '<div class="insumo-detail-box"><span>' + escHtml(label) + '</span><b>' + escHtml(value || '-') + '</b></div>';
}
function downloadPdfFile(doc, fileName) {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1200);
    return true;
  } catch(e) {
    try {
      doc.save(fileName);
      return true;
    } catch(err) {
      showToast('Nao foi possivel baixar o PDF.', 'error');
      return false;
    }
  }
}
function exportInsumoPedidoPdf(id, options = {}) {
  const order = INSUMO_ORDERS.find(item => item.id === id);
  if (!order || !window.jspdf?.jsPDF) {
    showToast('Nao foi possivel gerar o PDF.', 'error');
    return;
  }
  if (refreshNfeItemsFromText(order)) saveInsumoOrders();
  const project = PROJECTS.find(project => project.id === order.obraId);
  const doc = new window.jspdf.jsPDF({unit:'pt', format:'a4'});
  const page = {w:595.28, h:841.89, m:40};
  const yellow = [240,192,0];
  const dark = [24,26,38];
  const muted = [108,114,128];
  const border = [220,224,232];
  let y = 42;

  function footer(pageNo) {
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(130,130,130);
    doc.text('Engerama - Pedido gerado automaticamente', page.m, page.h - 28);
    doc.text(String(pageNo), page.w - page.m, page.h - 28, {align:'right'});
  }
  function newPageIfNeeded(nextHeight) {
    if (y + nextHeight <= page.h - 54) return;
    footer(doc.getNumberOfPages());
    doc.addPage();
    y = 42;
  }
  function sectionTitle(title) {
    newPageIfNeeded(34);
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(65,65,65);
    doc.text(String(title).toUpperCase(), page.m, y);
    y += 12;
    doc.setDrawColor(...border);
    doc.line(page.m, y, page.w - page.m, y);
    y += 14;
  }
  function infoCard(x, y0, w, h, label, value, accent) {
    doc.setDrawColor(210,214,222);
    doc.setFillColor(250,251,253);
    doc.roundedRect(x, y0, w, h, 8, 8, 'FD');
    if (accent) {
      doc.setFillColor(...yellow);
      doc.roundedRect(x, y0, 5, h, 4, 4, 'F');
    }
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(String(label).toUpperCase(), x + 14, y0 + 18);
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text(doc.splitTextToSize(String(value || '-'), w - 28), x + 14, y0 + 36);
  }
  function labelValue(label, value) {
    const lines = doc.splitTextToSize(String(value || '-'), 360);
    newPageIfNeeded(Math.max(24, lines.length * 12 + 8));
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(label, page.m, y);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text(lines, 180, y);
    y += Math.max(24, lines.length * 12 + 8);
  }
  function imageFormat(file) {
    const type = String(file?.type || '').toLowerCase();
    const data = String(file?.data || '');
    if (type.includes('png') || data.startsWith('data:image/png')) return 'PNG';
    return 'JPEG';
  }
  function drawPhotoCard(file, x, y0, w, h) {
    doc.setDrawColor(218,222,230);
    doc.setFillColor(250,251,253);
    doc.roundedRect(x, y0, w, h, 8, 8, 'FD');
    const imageBoxH = h - 28;
    try {
      const props = doc.getImageProperties(file.data);
      const scale = Math.min((w - 16) / props.width, (imageBoxH - 12) / props.height);
      const imgW = props.width * scale;
      const imgH = props.height * scale;
      const imgX = x + (w - imgW) / 2;
      const imgY = y0 + 8 + ((imageBoxH - 12) - imgH) / 2;
      doc.addImage(file.data, imageFormat(file), imgX, imgY, imgW, imgH);
    } catch(e) {
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text('Imagem nao disponivel para o PDF', x + 12, y0 + 44);
    }
    doc.setFillColor(255,255,255);
    doc.rect(x + 1, y0 + h - 25, w - 2, 24, 'F');
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(doc.splitTextToSize(String(file.name || 'foto'), w - 18), x + 9, y0 + h - 10);
  }

  doc.setFillColor(...dark);
  doc.rect(0, 0, page.w, 92, 'F');
  doc.setFillColor(...yellow);
  doc.rect(0, 0, 9, 92, 'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(20);
  doc.setTextColor(255,255,255);
  doc.text('ENGERAMA', page.m, y);
  doc.setFontSize(11);
  doc.setFont('helvetica','normal');
  doc.text('Resumo Executivo de Pedido de Insumo', page.m, y + 20);
  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  doc.setTextColor(...yellow);
  doc.text(statusInsumoLabel(order.status).toUpperCase(), page.w - page.m, y + 8, {align:'right'});
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(210,214,222);
  doc.text(dateTimeBR(new Date().toISOString()), page.w - page.m, y + 26, {align:'right'});
  y = 118;

  infoCard(page.m, y, 160, 68, 'Pedido', order.numeroPedido || order.id, true);
  infoCard(page.m + 176, y, 160, 68, 'Obra', project?.nome || '-', false);
  infoCard(page.m + 352, y, 163, 68, 'Itens', insumoItemsQtySummary(order), false);
  y += 92;

  sectionTitle('Material solicitado');
  labelValue('Itens', insumoItemsText(order));
  labelValue('Observacao', order.observacao || '-');
  labelValue('Necessidade', order.neededBy ? dateTimeBR(order.neededBy) : '-');

  sectionTitle('Rastreabilidade');
  labelValue('Solicitado por', (order.requestedBy || '-') + ' em ' + dateTimeBR(order.requestedAt));
  labelValue('Comprado por', order.boughtBy ? order.boughtBy + ' em ' + dateTimeBR(order.boughtAt || order.dataCompra) : '-');
  labelValue('Fornecedor', order.fornecedor || '-');
  labelValue('Recebido por', order.receivedBy ? order.receivedBy + ' em ' + dateTimeBR(order.receivedAt) : '-');

  sectionTitle('Comentarios');
  labelValue('Compra', order.purchaseComment || '-');
  labelValue('Recebimento', order.receiveComment || '-');
  labelValue('NFE anexada', order.nfe?.name || '-');

  const photos = [...(order.attachments || []), ...(order.purchaseAttachments || [])]
    .filter(file => String(file.type || '').startsWith('image/') && file.data);
  if (photos.length) {
    sectionTitle('Fotos anexadas');
    const cardW = 240;
    const cardH = 168;
    photos.forEach((file, index) => {
      const col = index % 2;
      if (col === 0) newPageIfNeeded(cardH + 16);
      const x = page.m + col * 268;
      drawPhotoCard(file, x, y, cardW, cardH);
      if (col === 1 || index === photos.length - 1) y += cardH + 16;
    });
  }

  if (order.nfe?.name) {
    sectionTitle('NFE anexada');
    labelValue('Arquivo', order.nfe.name + ' (' + Math.round((order.nfe.size || 0) / 1024) + ' KB)');
  }

  const history = Array.isArray(order.history) ? order.history : [];
  if (history.length) {
    sectionTitle('Historico de alteracoes');
    history.forEach(item => {
      labelValue(item.action || 'Alteracao', (item.user || '-') + ' em ' + dateTimeBR(item.at) + ' - ' + (item.detail || ''));
    });
  }
  footer(doc.getNumberOfPages());
  const fileName = (options.auto ? 'Solicitacao_Insumo_' : 'Pedido_Insumo_') + safeFilePart(order.numeroPedido || order.id) + '.pdf';
  const downloaded = downloadPdfFile(doc, fileName);
  if (downloaded && !options.auto) showToast('PDF baixado com sucesso.', 'success');
  return downloaded;
}

function deleteInsumoPedido(id) {
  if (!isAdmin()) return;
  if (!confirm('Apagar este pedido de material?')) return;
  const previousOrders = INSUMO_ORDERS.slice();
  INSUMO_ORDERS = INSUMO_ORDERS.filter(item => item.id !== id);
  if (!saveInsumoOrders()) {
    INSUMO_ORDERS = previousOrders;
    return;
  }
  showToast('Pedido apagado.', 'success');
  renderInsumos();
}

function deleteAllInsumoPedidos() {
  if (!isAdmin()) {
    showToast('Apenas administradores podem apagar todos os pedidos.', 'error');
    return;
  }
  if (!INSUMO_ORDERS.length) {
    showToast('Nenhum pedido para apagar.', 'warn');
    return;
  }
  const adminPass = prompt('Digite a senha do administrador para apagar todos os pedidos:');
  if (!adminPasswordMatches(adminPass)) {
    showToast('Senha de administrador incorreta.', 'error');
    return;
  }
  const total = INSUMO_ORDERS.length;
  if (!confirm('Apagar TODOS os ' + total + ' pedido(s) de insumos? Esta acao nao pode ser desfeita.')) return;
  const previousOrders = INSUMO_ORDERS.slice();
  INSUMO_ORDERS = [];
  if (!saveInsumoOrders()) {
    INSUMO_ORDERS = previousOrders;
    return;
  }
  showToast(total + ' pedido(s) apagado(s).', 'success');
  renderInsumos();
}
function addInsumoUnit() {
  showToast('As unidades foram padronizadas: metro linear, metro, m², quilo, peça e litro.', 'warn');
}
function normInsumoHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}
function parseExcelDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  if (typeof value === 'number' && value > 20000) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return d.toISOString().slice(0,10);
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return '';
}
function findImportHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] || [];
    const prev = rows[r-1] || [];
    const headers = row.map((value, i) => normInsumoHeader((prev[i] ? prev[i] + ' ' : '') + (value || '')));
    const score = headers.filter(h => /qtd|qtde|quant|und|unidade|descr|especific|material|cabo|status|solicitante/.test(h)).length;
    if (score >= 2) return {index:r, headers};
  }
  return null;
}
function pickCol(headers, tests) {
  for (let i = 0; i < headers.length; i++) {
    if (tests.some(test => test.test(headers[i]))) return i;
  }
  return -1;
}
function importStatusFromRow(statusText, fornecedor, entregaSim, andamento) {
  const st = normInsumoHeader(statusText + ' ' + andamento);
  if (st.includes('concl') || st === 'ok' || normInsumoHeader(entregaSim) === 'x') return 'concluido';
  if (fornecedor) return 'em_rota';
  return 'pendente';
}
function mergeImportedInsumoOrders(imported) {
  let added = 0;
  let updated = 0;
  imported.forEach(incoming => {
    const pedidoKey = String(incoming.numeroPedido || '').trim();
    let existing = pedidoKey
      ? INSUMO_ORDERS.find(order => order.obraId === incoming.obraId && String(order.numeroPedido || '').trim() === pedidoKey)
      : null;
    if (!existing) {
      const incomingMaterial = normalizeInsumoText(incoming.material);
      existing = INSUMO_ORDERS.find(order =>
        order.obraId === incoming.obraId &&
        normalizeInsumoText(order.material) === incomingMaterial &&
        String(order.quantidade || '') === String(incoming.quantidade || '')
      );
    }
    if (existing) {
      const keep = {
        id: existing.id,
        createdAt: existing.createdAt || incoming.createdAt,
        attachments: existing.attachments || [],
        purchaseAttachments: existing.purchaseAttachments || [],
        nfe: existing.nfe,
        history: Array.isArray(existing.history) ? existing.history : []
      };
      Object.assign(existing, incoming, keep);
      recordInsumoChange(existing, 'Pedido atualizado pela importacao', incoming.importedFrom || 'Planilha importada');
      updated++;
    } else {
      INSUMO_ORDERS.push(incoming);
      added++;
    }
  });
  return {added, updated};
}
function importInsumosExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const targetObra = document.getElementById('insumo-filter-obra')?.value !== 'all'
    ? document.getElementById('insumo-filter-obra').value
    : (document.getElementById('insumo-form-obra')?.value || visibleProjects()[0]?.id);
  if (!targetObra) {
    showToast('Cadastre ou selecione uma obra antes de importar.', 'error');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      if (!window.XLSX) {
        showToast('Biblioteca do Excel nao carregou. Recarregue a pagina.', 'error');
        return;
      }
      const workbook = XLSX.read(new Uint8Array(ev.target.result), {type:'array', cellDates:true});
      const imported = [];
      workbook.SheetNames.forEach(sheetName => {
        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:true});
        const found = findImportHeader(rows);
        if (!found) return;
        const h = found.headers;
        let cPedido = pickCol(h, [/pedido/]);
        let cData = pickCol(h, [/data(?!.*conclus)/, /abertura/]);
        let cUn = pickCol(h, [/\bund\b/, /unidade/]);
        let cQtd = pickCol(h, [/qtd/, /qtde/, /quant/]);
        let cMat = pickCol(h, [/descr/, /especific/, /material/, /cabo/]);
        let cSolic = pickCol(h, [/solicitante/]);
        let cObs = pickCol(h, [/obs/]);
        let cForn = pickCol(h, [/fornecedor/, /local de compra/]);
        let cResp = pickCol(h, [/\bresp\b/, /comprador/]);
        let cPrev = pickCol(h, [/previs/, /prazo/]);
        let cStatus = pickCol(h, [/status/, /andamento/]);
        let cEntregaSim = h.findIndex(value => value.includes('entrega sim') || value === 'sim');
        if ((cMat < 0 || cMat === cUn || cMat === cQtd) && cQtd >= 0) cMat = cQtd + 1;
        rows.slice(found.index + 1).forEach((row, rowOffset) => {
          const material = String(row[cMat] || '').trim();
          const quantidade = row[cQtd];
          if (!material || quantidade === '' || quantidade === null) return;
          const fornecedor = String(row[cForn] || '').trim();
          const solicitante = String(row[cSolic] || currentUser || '').trim();
          const status = importStatusFromRow(row[cStatus], fornecedor, row[cEntregaSim], row[cStatus]);
          const now = new Date().toISOString();
          const unidade = normalizeInsumoUnit(String(row[cUn] || 'peça').trim());
          imported.push({
            id: insumoId() + '_' + imported.length,
            obraId: targetObra,
            numeroPedido: String(row[cPedido] || '').trim(),
            material,
            quantidade,
            unidade,
            items: [{material, quantidade, unidade}],
            observacao: [String(row[cObs] || '').trim(), sheetName].filter(Boolean).join(' · '),
            neededBy: parseExcelDate(row[cPrev]) || '',
            status,
            requestedBy: solicitante || currentUser,
            requestedAt: parseExcelDate(row[cData]) || now,
            fornecedor,
            dataCompra: fornecedor ? (parseExcelDate(row[cPrev]) || '') : '',
            boughtBy: fornecedor ? (String(row[cResp] || '').trim() || currentUser) : '',
            boughtAt: fornecedor ? now : '',
            receivedBy: status === 'concluido' ? currentUser : '',
            receivedAt: status === 'concluido' ? now : '',
            createdAt: now,
            importedFrom: file.name + ' / ' + sheetName + ' linha ' + (found.index + rowOffset + 2)
          });
        });
      });
      if (!imported.length) {
        showToast('Nenhum pedido reconhecido na planilha.', 'error');
        return;
      }
      const result = mergeImportedInsumoOrders(imported);
      if (!saveInsumoOrders()) return;
      showToast(result.added + ' pedido(s) novo(s) e ' + result.updated + ' atualizado(s). Nenhum pedido foi apagado.', 'success');
      renderInsumos();
    } catch(err) {
      showToast('Erro ao importar pedidos: ' + err.message, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}


// Chat de respostas prontas
const QUICK_CHAT_RESPONSES = [
  {keys:['importar','import excel','excel importar','arquivo','planilha entrar','atualizar dados'], title:'Importar Excel', answer:'Para importar, abra a obra desejada, clique em Importar Excel e escolha a planilha no padrão do cronograma. A importação substitui os dados antigos da obra pelos valores atuais da aba Resumo, incluindo orçamento, medições, Curva S e período.'},
  {keys:['exportar excel','excel','planilha','baixar excel','download excel'], title:'Exportar Excel', answer:'Para exportar Excel, abra uma obra ou vá em Relatório, escolha a obra e clique em Exportar Excel. O sistema baixa uma planilha com Info, Medições, Curva S e Resumo.'},
  {keys:['imprimir','impressao','impressão','pdf','relatorio','relatório','exportar pdf'], title:'Relatório e impressão', answer:'Na aba Relatório, escolha a obra no seletor. Clique em Pré-visualizar impressão para ver o layout executivo. Use Imprimir para abrir a impressão ou Exportar PDF para baixar o arquivo em PDF.'},
  {keys:['insumo','insumos','material','materiais','suprimento','suprimentos','pedido de material','pedidos de materiais'], title:'Insumos e pedidos de materiais', answer:'Na aba Insumos, a obra registra o material solicitado, quantidade, unidade, obra, observação e a data em que precisa do item. O pedido nasce como Pendente, depois Compras registra fornecedor, data da compra e comentário. Quando o material chega na obra, o recebimento confirma a entrega e pode registrar um comentário final.'},
  {keys:['pedir material','novo pedido','solicitar material','solicitacao','solicitação','precisa em','para quando','unidade','quantidade'], title:'Como pedir material', answer:'Em Insumos, preencha a obra, material, quantidade, unidade, data em que precisa e observação. Ao clicar em Registrar pedido, o sistema salva automaticamente o usuário logado, baixa o PDF e abre o WhatsApp para enviar o aviso ao compras. O pedido fica vermelho como Pendente até Compras registrar a compra.'},
  {keys:['comprar','compra','fornecedor','em rota','rota','data de compra','comentario compra','comentário compra'], title:'Compra de insumo', answer:'Quando o pedido estiver Pendente, clique em Comprar. Informe o fornecedor, a data da compra e, se necessário, um comentário. O sistema registra automaticamente quem comprou, muda o pedido para Em rota e mostra o comentário abaixo das informações de compra.'},
  {keys:['receber','recebimento','recebido','concluido','concluído','chegou','comentario recebimento','comentário recebimento'], title:'Recebimento de insumo', answer:'Quando o material chegar na obra, clique em Receber. Você pode adicionar um comentário de conferência, avaria, local de armazenamento ou observação. O sistema registra automaticamente quem recebeu, a data do recebimento e muda o pedido para Concluído.'},
  {keys:['status insumo','status pedido','pendente','amarelo','verde','vermelho','dashboard insumos','resumo insumos'], title:'Status dos insumos', answer:'Os pedidos de insumos usam três status: Pendente em vermelho, Em rota em amarelo e Concluído em verde. O painel da aba Insumos mostra o resumo geral com total de pendentes, em rota, concluídos e total de pedidos.'},
  {keys:['importar insumos','excel insumos','planilha insumos','controle de pedidos','importar pedidos'], title:'Importar pedidos de insumos', answer:'Na aba Insumos, use Importar Excel para carregar pedidos antigos de uma planilha de controle. A importação tenta reconhecer os campos de pedido, material, quantidade, unidade, status, solicitante, fornecedor, compra e recebimento, mantendo os pedidos atualizados na obra selecionada.'},
  {keys:['usuario','usuário','usuarios','usuários','senha','visualizador','admin','permissao','permissão','acesso'], title:'Usuários e permissões', answer:'Na aba Usuários, o administrador pode criar usuários, trocar senhas e escolher quais obras cada visualizador pode acessar. Visualizadores enxergam somente as obras marcadas.'},
  {keys:['obra','obras','projeto','editar obra','apagar obra','nova obra','desfazer'], title:'Obras', answer:'Na aba Obras, clique em Nova Obra para cadastrar. Use o lápis para editar e o X para apagar. Ao apagar uma obra, o sistema mostra a opção de desfazer por 9 segundos.'},
  {keys:['login','entrar','logar','acesso','sair'], title:'Login', answer:'Entre com um usuário cadastrado pelo administrador. Depois do login, o menu mostra as áreas disponíveis. Para sair, use o botão Sair na barra lateral.'},
  {keys:['orcamento','orçamento','154','309','valor errado','importando errado'], title:'Orçamento da planilha', answer:'O orçamento é lido da aba Resumo, nas células E51/F50. Se o valor mudar na planilha, importe novamente para atualizar o sistema. Para São José, o orçamento correto é 154.990.000 quando a planilha estiver nesse padrão.'},
  {keys:['resultado','negativo','menos','saldo'], title:'Resultado financeiro', answer:'O Resultado é calculado como Receita menos Gasto. Quando for negativo, ele aparece com o sinal de menos antes do valor.'}
];
const QUICK_CHAT_GOODBYES = ['nao','não','obrigado','obrigada','valeu','tchau','ate mais','até mais','encerrar','finalizar'];
const QUICK_CHAT_GREETINGS = ['oi','ola','olá','bom dia','boa tarde','boa noite','e ai','e aí'];

function normQuickChat(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function resetQuickChat() {
  const body = document.getElementById('quick-chat-body');
  if (!body) return;
  body.innerHTML = '<div class="quick-chat-msg bot">Olá, como posso ajudar?☺️</div>';
  const input = document.getElementById('quick-chat-input');
  if (input) input.value = '';
}
function toggleQuickChat(force) {
  const panel = document.getElementById('quick-chat-panel');
  if (!panel) return;
  const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  if (open) setTimeout(() => document.getElementById('quick-chat-input')?.focus(), 80);
}
function appendQuickChatMessage(role, text) {
  const body = document.getElementById('quick-chat-body');
  if (!body) return;
  const msg = document.createElement('div');
  msg.className = 'quick-chat-msg ' + role;
  msg.textContent = text;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
}
function quickChatOpenInsumosScreen() {
  if (!userHasModule('insumos')) return false;
  showView('insumos');
  setTimeout(() => {
    const field = document.getElementById('insumo-form-material');
    field?.scrollIntoView({behavior:'smooth', block:'center'});
    field?.focus();
  }, 120);
  return true;
}
function quickChatGoToInsumos() {
  toggleQuickChat(true);
  appendQuickChatMessage('user', 'Solicitar material');
  const ok = quickChatOpenInsumosScreen();
  appendQuickChatMessage('bot', ok
    ? 'Abri a tela de Insumos / Pedidos para voce solicitar o material. Preencha obra, material, quantidade, unidade e a data em que precisa. Posso ajudar em mais alguma coisa?'
    : 'Seu usuario nao tem acesso a tela de Insumos / Pedidos. Peça para um administrador liberar esse modulo. Posso ajudar em mais alguma coisa?');
}
function quickChatPedidoSearchTerm(raw) {
  const text = String(raw || '');
  const quoted = text.match(/["“”']([^"“”']+)["“”']/);
  if (quoted?.[1]) return quoted[1].trim();
  const afterPedido = text.match(/pedido\s*#?\s*([a-zA-Z0-9_-]+)/i);
  if (afterPedido?.[1]) return afterPedido[1].trim();
  const hash = text.match(/#\s*([a-zA-Z0-9_-]+)/);
  if (hash?.[1]) return hash[1].trim();
  const number = text.match(/\b\d{1,6}\b/);
  return number ? number[0] : '';
}
function quickChatFindOrders(term) {
  const allowed = visibleProjectIdsSet();
  const cleanTerm = normQuickChat(term).replace(/^#/, '').trim();
  const cleanNum = cleanTerm.replace(/\D/g, '').replace(/^0+/, '');
  const orders = INSUMO_ORDERS.filter(order => allowed.has(order.obraId));
  if (!cleanTerm) return [];
  const exact = orders.filter(order => {
    const numero = String(order.numeroPedido || '').replace(/\D/g, '').replace(/^0+/, '');
    return numero && cleanNum && numero === cleanNum;
  });
  if (exact.length) return exact;
  return orders.filter(order => {
    const project = getProject(order.obraId);
    const items = normalizeInsumoItems(order).map(item => item.material).join(' ');
    const haystack = normQuickChat([
      order.numeroPedido,
      order.id,
      order.material,
      items,
      order.observacao,
      project?.nome,
      project?.codigo
    ].filter(Boolean).join(' '));
    return haystack.includes(cleanTerm);
  });
}
function quickChatPedidoStatusAnswer(raw) {
  const q = normQuickChat(raw);
  if (!(q.includes('status') && (q.includes('pedido') || q.includes('insumo') || q.includes('material')))) return null;
  const term = quickChatPedidoSearchTerm(raw);
  if (!term) return 'Me diga o numero ou nome do pedido para eu consultar. Exemplo: "qual o status do pedido 001?". Posso ajudar em mais alguma coisa?';
  const matches = quickChatFindOrders(term);
  if (!matches.length) return 'Nao encontrei nenhum pedido com "' + term + '" nas obras liberadas para seu usuario. Confira o numero do pedido e tente novamente. Posso ajudar em mais alguma coisa?';
  if (matches.length > 1) {
    return 'Encontrei mais de um pedido parecido com "' + term + '":\n' + matches.slice(0,5).map(order => '#' + (order.numeroPedido || order.id) + ' - ' + (order.material || normalizeInsumoItems(order)[0]?.material || 'Material sem nome') + ' (' + statusInsumoLabel(order.status) + ')').join('\n') + '\n\nMe diga o numero exato para eu mostrar os detalhes. Posso ajudar em mais alguma coisa?';
  }
  const order = matches[0];
  const project = getProject(order.obraId);
  const anexos = (order.attachments?.length || 0) + (order.purchaseAttachments?.length || 0) + (order.nfe?.name ? 1 : 0);
  return [
    'Status do pedido #' + (order.numeroPedido || order.id),
    'Status: ' + statusInsumoLabel(order.status),
    'Obra: ' + (project?.nome || '-'),
    'Itens: ' + insumoItemsText(order).replace(/\n/g, ' | '),
    order.neededBy ? 'Precisa em: ' + dateTimeBR(order.neededBy) : '',
    'Solicitado por: ' + (order.requestedBy || '-') + ' em ' + dateTimeBR(order.requestedAt || order.createdAt),
    order.status !== 'pendente' ? 'Compra: ' + (order.fornecedor || '-') + ' por ' + (order.boughtBy || '-') + ' em ' + dateTimeBR(order.dataCompra || order.boughtAt) : 'Compra: aguardando compras',
    order.status === 'concluido' ? 'Recebimento: ' + (order.receivedBy || '-') + ' em ' + dateTimeBR(order.receivedAt) : 'Recebimento: ainda nao recebido',
    order.purchaseComment ? 'Obs. compra: ' + order.purchaseComment : '',
    order.receiveComment ? 'Obs. recebimento: ' + order.receiveComment : '',
    anexos ? 'Anexos: ' + anexos : ''
  ].filter(Boolean).join('\n') + '\n\nPosso ajudar em mais alguma coisa?';
}
function quickChatAnswer(text) {
  const raw = String(text || '').trim();
  const q = normQuickChat(raw);
  if (!q) return 'Pode me perguntar sobre obras, insumos, pedidos de materiais, usuários, Excel, relatórios, PDF ou impressão. Posso ajudar em mais alguma coisa?';

  if (QUICK_CHAT_GOODBYES.some(item => q.includes(normQuickChat(item)))) {
    return 'Claro. Fico feliz em ajudar. Até mais!';
  }
  if (QUICK_CHAT_GREETINGS.some(item => q === normQuickChat(item) || q.includes(normQuickChat(item)))) {
    return 'Olá! Posso ajudar com importação do Excel, relatório, insumos, pedidos de materiais, usuários, obras, permissões ou impressão. O que você precisa fazer agora?';
  }

  const pedidoStatus = quickChatPedidoStatusAnswer(raw);
  if (pedidoStatus) return pedidoStatus;

  if (q.includes('solicitar material') || q.includes('pedir material') || q.includes('novo pedido de material')) {
    const ok = quickChatOpenInsumosScreen();
    return ok
      ? 'Abri a tela de Insumos / Pedidos para voce solicitar o material. Preencha obra, material, quantidade, unidade e a data em que precisa. Posso ajudar em mais alguma coisa?'
      : 'Seu usuario nao tem acesso a tela de Insumos / Pedidos. Peça para um administrador liberar esse modulo. Posso ajudar em mais alguma coisa?';
  }

  let best = null, score = 0;
  QUICK_CHAT_RESPONSES.forEach(item => {
    const hits = item.keys.reduce((total, key) => total + (q.includes(normQuickChat(key)) ? 1 : 0), 0);
    if (hits > score) { best = item; score = hits; }
  });

  if (!best) {
    return 'Ainda não tenho uma resposta pronta para isso, mas posso ajudar com: insumos, pedidos de materiais, importar Excel, exportar Excel, relatórios, PDF, usuários, permissões, login e obras. Posso ajudar em mais alguma coisa?';
  }
  return best.title + '\n' + best.answer + '\n\nPosso ajudar em mais alguma coisa?';
}
function askQuickChat(text) {
  toggleQuickChat(true);
  appendQuickChatMessage('user', text);
  setTimeout(() => appendQuickChatMessage('bot', quickChatAnswer(text)), 120);
}
function quickChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('quick-chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  askQuickChat(text);
}

// ══ TOAST ═════════════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  const hasUndo = type === 'undo' && deletedProjectUndo;
  if (hasUndo) {
    t.innerHTML = '<span>' + escHtml(msg) + '</span><button class="toast-undo-btn" onclick="undoDeleteProject()">Desfazer</button>';
  } else {
    t.textContent = msg;
  }
  t.className = 'toast ' + (hasUndo ? 'warn undo' : type);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), hasUndo ? 9000 : 3000);
}

// ══ INIT ══════════════════════════════════════════════════════════════════
document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('pt-BR');
function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('hidden');
  setTimeout(() => splash.remove(), 450);
}
async function initPushNotifications() {
  if (!APP_CONFIG.enablePush) return;
  try {
    const cap = window.Capacitor?.Plugins?.PushNotifications;
    if (cap) {
      const perm = await cap.requestPermissions();
      if (perm.receive === 'granted') await cap.register();
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch(e) {
    console.warn('Push notifications nao configuradas:', e.message);
  }
}
function initAppRuntime() {
  setTimeout(hideSplash, 650);
  updateBackButton();
  if (backendEnabled()) {
    syncWhenPossible('inicio');
    setInterval(() => syncWhenPossible('intervalo'), Number(APP_CONFIG.offlineSyncIntervalMs) || 15000);
    window.addEventListener('online', () => {
      if (typeof showToast === 'function') showToast('Internet voltou. Sincronizando dados...', 'success');
      syncWhenPossible('online');
    });
    window.addEventListener('offline', () => {
      if (typeof showToast === 'function') showToast('Modo offline local ativado. As alteracoes serao sincronizadas depois.', 'warn');
    });
    window.addEventListener('focus', () => syncWhenPossible('focus'));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncWhenPossible('retorno');
    });
    try {
      window.Capacitor?.Plugins?.App?.addListener?.('appStateChange', ({ isActive }) => {
        if (isActive) syncWhenPossible('app-ativo');
      });
    } catch(e) {}
  }
  initPushNotifications();
}
document.addEventListener('DOMContentLoaded', initAppRuntime);

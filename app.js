/* Kanban EMM pour Grist - version GitHub Pages, sans build. */

const STATUSES = [
  'Nouveau',
  'En cours DUD',
  'En cours DT',
  'En développement',
  'En Test',
  'En Test CU',
  'Déployé'
];

const PRIORITY_RANK = { Haute: 1, Moyenne: 2, Basse: 3 };

const COLUMNS = [
  { name: 'Title', title: 'Service', type: 'Text' },
  { name: 'ServiceUtilisateur', title: 'Service Utilisateur' },
  { name: 'Category', title: 'Catégorie' },
  { name: 'CaseType', title: 'Cas' },
  { name: 'Description', title: 'Description', type: 'Text' },
  { name: 'DesiredDate', title: 'Date souhaitée' },
  { name: 'Priority', title: 'Prio' },
  { name: 'ModifiedAt', title: 'Modifiée le' },
  { name: 'Status', title: 'Statut' },
  { name: 'Assignees', title: 'Assignée à' },
  { name: 'Comment', title: 'Commentaire', type: 'Text' },
  { name: 'RTU', title: 'RTU', optional: true },
  { name: 'Sprint', title: 'Sprint', optional: true },
  { name: 'CreatedBy', title: 'Créée par', optional: true },
  { name: 'CreatedAt', title: 'Créé le', optional: true },
  { name: 'Requester', title: 'CP/Demandeur', optional: true }
];

const state = {
  records: [],
  currentId: null,
  filters: {
    search: '',
    category: '',
    caseType: '',
    priority: '',
    assignee: '',
    sprint: '',
    sort: 'priority'
  }
};

const $ = (id) => document.getElementById(id);

function safeText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return listValues(value).join(', ');
  if (value instanceof Date) return dateToInput(value);
  return String(value);
}

function listValues(value) {
  if (!Array.isArray(value)) {
    return safeText(value).split(',').map(v => v.trim()).filter(Boolean);
  }
  return value.filter(v => v !== 'L' && v !== null && v !== undefined).map(v => String(v));
}

function parseListText(text) {
  return String(text || '').split(',').map(v => v.trim()).filter(Boolean);
}

function dateToInput(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const ms = value > 100000000000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(value);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function truncate(value, limit = 150) {
  const s = safeText(value).trim();
  return s.length > limit ? s.slice(0, limit).trim() + '…' : s;
}

function normalizeStatus(status) {
  const s = safeText(status).trim();
  return STATUSES.includes(s) ? s : 'Nouveau';
}

function normalizeIncoming(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  // Sécurité si une version/API renvoie un format en colonnes.
  if (Array.isArray(data.id)) {
    return data.id.map((id, index) => {
      const row = { id };
      Object.keys(data).forEach(key => { row[key] = data[key]?.[index]; });
      return row;
    });
  }
  return [];
}

function normalizeRecord(row) {
  return {
    id: row.id,
    Title: safeText(row.Title),
    ServiceUtilisateur: safeText(row.ServiceUtilisateur),
    Category: safeText(row.Category),
    CaseType: safeText(row.CaseType),
    Description: safeText(row.Description),
    DesiredDate: row.DesiredDate,
    Priority: safeText(row.Priority),
    ModifiedAt: row.ModifiedAt,
    Status: normalizeStatus(row.Status),
    Assignees: row.Assignees,
    Comment: safeText(row.Comment),
    RTU: safeText(row.RTU),
    Sprint: safeText(row.Sprint),
    CreatedBy: safeText(row.CreatedBy),
    CreatedAt: row.CreatedAt,
    Requester: safeText(row.Requester)
  };
}

function uniqueValues(field, split = false) {
  const values = new Set();
  state.records.forEach(r => {
    if (split) listValues(r[field]).forEach(v => values.add(v));
    else {
      const v = safeText(r[field]).trim();
      if (v) values.add(v);
    }
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'));
}

function updateSelect(id, values, label) {
  const select = $(id);
  const current = select.value;
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = label;
  select.appendChild(first);
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = values.includes(current) ? current : '';
}

function updateDatalist(id, values) {
  const node = $(id);
  node.innerHTML = '';
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    node.appendChild(option);
  });
}

function refreshFilters() {
  const categories = uniqueValues('Category');
  const cases = uniqueValues('CaseType');
  const priorities = uniqueValues('Priority');
  const assignees = uniqueValues('Assignees', true);
  const sprints = uniqueValues('Sprint');

  updateSelect('categoryFilter', categories, 'Toutes catégories');
  updateSelect('caseFilter', cases, 'Tous les cas');
  updateSelect('priorityFilter', priorities, 'Toutes priorités');
  updateSelect('assigneeFilter', assignees, 'Tous assignés');
  updateSelect('sprintFilter', sprints, 'Tous sprints');

  updateDatalist('categorySuggestions', categories);
  updateDatalist('assigneeSuggestions', assignees);
  updateDatalist('sprintSuggestions', sprints);
}

function filteredRecords() {
  const f = state.filters;
  const search = f.search.toLowerCase();
  return state.records.filter(r => {
    const corpus = [
      r.Title, r.ServiceUtilisateur, r.Category, r.CaseType, r.Description,
      r.Priority, safeText(r.Assignees), r.Comment, r.RTU, r.Sprint, r.Requester
    ].join(' ').toLowerCase();

    if (search && !corpus.includes(search)) return false;
    if (f.category && r.Category !== f.category) return false;
    if (f.caseType && r.CaseType !== f.caseType) return false;
    if (f.priority && r.Priority !== f.priority) return false;
    if (f.assignee && !listValues(r.Assignees).includes(f.assignee)) return false;
    if (f.sprint && r.Sprint !== f.sprint) return false;
    return true;
  });
}

function compareDate(a, b, descending = false) {
  const da = Date.parse(dateToInput(a)) || 8640000000000000;
  const db = Date.parse(dateToInput(b)) || 8640000000000000;
  return descending ? db - da : da - db;
}

function sortedRecords(records) {
  return [...records].sort((a, b) => {
    switch (state.filters.sort) {
      case 'due': return compareDate(a.DesiredDate, b.DesiredDate);
      case 'modified': return compareDate(a.ModifiedAt, b.ModifiedAt, true);
      case 'created': return compareDate(a.CreatedAt, b.CreatedAt, true);
      case 'title': return a.Title.localeCompare(b.Title, 'fr');
      case 'priority':
      default:
        return (PRIORITY_RANK[a.Priority] || 99) - (PRIORITY_RANK[b.Priority] || 99)
          || compareDate(a.DesiredDate, b.DesiredDate);
    }
  });
}

function isOverdue(value, status) {
  if (!value || status === 'Déployé') return false;
  const input = dateToInput(value);
  if (!input) return false;
  const d = new Date(input + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function badgeClass(value, kind) {
  const v = safeText(value).toLowerCase();
  if (kind === 'priority') {
    if (v === 'haute') return 'prio-haute';
    if (v === 'moyenne') return 'prio-moyenne';
    if (v === 'basse') return 'prio-basse';
  }
  if (kind === 'case') {
    if (v === 'spécifique' || v === 'specifique') return 'case-specific';
    if (v === 'standard') return 'case-standard';
  }
  return '';
}

function makeBadge(text, className = '') {
  const badge = document.createElement('span');
  badge.className = `badge ${className}`.trim();
  badge.textContent = text;
  return badge;
}

function renderStats(records) {
  const total = records.length;
  const high = records.filter(r => r.Priority === 'Haute').length;
  const overdue = records.filter(r => isOverdue(r.DesiredDate, r.Status)).length;
  const deployed = records.filter(r => r.Status === 'Déployé').length;
  const stats = [
    `Total : ${total}`,
    `Priorité haute : ${high}`,
    `En retard : ${overdue}`,
    `Déployés : ${deployed}`
  ];
  $('statsBar').replaceChildren(...stats.map(t => {
    const div = document.createElement('div');
    div.className = 'stat-pill';
    div.textContent = t;
    return div;
  }));
}

function renderBoard() {
  const records = sortedRecords(filteredRecords());
  const board = $('board');
  board.innerHTML = '';
  renderStats(records);

  if (!state.records.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-board';
    empty.textContent = 'Aucune carte EMM trouvée dans la table source.';
    board.appendChild(empty);
    return;
  }

  STATUSES.forEach(status => {
    const laneRecords = records.filter(r => r.Status === status);
    const lane = document.createElement('section');
    lane.className = 'lane';
    lane.dataset.status = status;
    lane.addEventListener('dragover', onLaneDragOver);
    lane.addEventListener('dragleave', onLaneDragLeave);
    lane.addEventListener('drop', onLaneDrop);

    const header = document.createElement('div');
    header.className = 'lane-header';
    const title = document.createElement('div');
    title.className = 'lane-title';
    title.textContent = status;
    const count = document.createElement('div');
    count.className = 'lane-count';
    count.textContent = laneRecords.length;
    header.append(title, count);
    lane.appendChild(header);

    laneRecords.forEach(record => lane.appendChild(createCard(record)));
    board.appendChild(lane);
  });
}

function createCard(record) {
  const card = document.createElement('article');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = String(record.id);
  card.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', String(record.id));
    event.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('click', () => openModal(record.id));

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = record.Title || '(Sans titre)';

  const cu = document.createElement('div');
  cu.className = 'card-cu';
  cu.textContent = record.ServiceUtilisateur || 'Service utilisateur non renseigné';

  const badges = document.createElement('div');
  badges.className = 'badges';
  if (record.Priority) badges.appendChild(makeBadge(record.Priority, badgeClass(record.Priority, 'priority')));
  if (record.Category) badges.appendChild(makeBadge(record.Category));
  if (record.CaseType) badges.appendChild(makeBadge(record.CaseType, badgeClass(record.CaseType, 'case')));
  if (record.Sprint) badges.appendChild(makeBadge(`Sprint ${record.Sprint}`));

  const descText = truncate(record.Description || record.Comment, 155);
  const desc = document.createElement('div');
  desc.className = 'card-desc';
  desc.textContent = descText;

  const footer = document.createElement('div');
  footer.className = 'card-footer';
  const assignee = document.createElement('span');
  assignee.textContent = safeText(record.Assignees) || 'Non assignée';
  const due = document.createElement('span');
  const dueText = dateToInput(record.DesiredDate);
  due.textContent = dueText ? `Échéance ${dueText}` : 'Sans échéance';
  if (isOverdue(record.DesiredDate, record.Status)) due.className = 'overdue';
  footer.append(assignee, due);

  card.append(title, cu, badges);
  if (descText) card.appendChild(desc);
  card.appendChild(footer);
  return card;
}

function onLaneDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function onLaneDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

async function onLaneDrop(event) {
  event.preventDefault();
  const lane = event.currentTarget;
  lane.classList.remove('drag-over');
  const id = Number(event.dataTransfer.getData('text/plain'));
  const status = lane.dataset.status;
  const record = state.records.find(r => Number(r.id) === id);
  if (!record || record.Status === status) return;
  try {
    await updateRecord(id, { Status: status, ModifiedAt: todayISO() });
    showToast(`Statut mis à jour : ${status}`);
  } catch (err) {
    console.error(err);
    showToast(errorMessage(err));
  }
}

function fillStatusSelect() {
  const select = $('fStatus');
  select.innerHTML = '';
  STATUSES.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });
}

function setValue(id, value) { $(id).value = value ?? ''; }
function getValue(id) { return ($(id).value || '').trim(); }

function openModal(id = null) {
  fillStatusSelect();
  state.currentId = id;
  const record = id ? state.records.find(r => Number(r.id) === Number(id)) : null;

  $('modalTitle').textContent = record ? 'Modifier la carte' : 'Nouvelle carte';
  $('deleteCardBtn').style.display = record ? 'inline-block' : 'none';

  setValue('fTitle', record?.Title || '');
  setValue('fCU', record?.ServiceUtilisateur || '');
  setValue('fStatus', record?.Status || 'Nouveau');
  setValue('fPriority', record?.Priority || '');
  setValue('fCategory', record?.Category || '');
  setValue('fCase', record?.CaseType || '');
  setValue('fDueDate', dateToInput(record?.DesiredDate));
  setValue('fAssignees', safeText(record?.Assignees));
  setValue('fSprint', record?.Sprint || '');
  setValue('fRTU', record?.RTU || '');
  setValue('fRequester', record?.Requester || '');
  setValue('fCreatedBy', record?.CreatedBy || '');
  setValue('fDescription', record?.Description || '');
  setValue('fComment', record?.Comment || '');

  const created = dateToInput(record?.CreatedAt) || 'non renseigné';
  const modified = dateToInput(record?.ModifiedAt) || 'non renseigné';
  $('modalMeta').textContent = record ? `Créé le ${created} · Modifié le ${modified}` : 'Nouvelle carte';
  $('modalBackdrop').classList.remove('hidden');
}

function closeModal() {
  state.currentId = null;
  $('modalBackdrop').classList.add('hidden');
}

function prepareAssigneesForSave(originalValue) {
  const values = parseListText(getValue('fAssignees'));
  if (Array.isArray(originalValue)) return ['L', ...values];
  return values.join(', ');
}

function removeEmptyFields(fields) {
  const out = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function mapBack(fields) {
  const mapped = grist.mapColumnNamesBack(removeEmptyFields(fields));
  if (!mapped) {
    throw new Error('Mapping des colonnes incomplet. Ouvrez la configuration du widget et mappez les colonnes requises.');
  }
  return mapped;
}

async function updateRecord(id, fields) {
  const table = grist.getTable();
  await table.update({ id: Number(id), fields: mapBack(fields) });
}

async function createRecord(fields) {
  const table = grist.getTable();
  await table.create({ fields: mapBack(fields) });
}

async function saveModal() {
  const existing = state.currentId ? state.records.find(r => Number(r.id) === Number(state.currentId)) : null;
  const now = todayISO();
  const fields = {
    Title: getValue('fTitle'),
    ServiceUtilisateur: getValue('fCU'),
    Status: getValue('fStatus') || 'Nouveau',
    Priority: getValue('fPriority'),
    Category: getValue('fCategory'),
    CaseType: getValue('fCase'),
    DesiredDate: getValue('fDueDate'),
    Assignees: prepareAssigneesForSave(existing?.Assignees),
    Sprint: getValue('fSprint'),
    RTU: getValue('fRTU'),
    Requester: getValue('fRequester'),
    CreatedBy: getValue('fCreatedBy'),
    Description: getValue('fDescription'),
    Comment: getValue('fComment'),
    ModifiedAt: now
  };

  try {
    if (state.currentId) {
      await updateRecord(state.currentId, fields);
      showToast('Carte mise à jour');
    } else {
      fields.CreatedAt = now;
      await createRecord(fields);
      showToast('Carte créée');
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast(errorMessage(err));
  }
}

async function deleteCurrentCard() {
  if (!state.currentId) return;
  if (!confirm('Supprimer cette carte EMM ?')) return;
  try {
    const table = grist.getTable();
    await table.destroy(Number(state.currentId));
    showToast('Carte supprimée');
    closeModal();
  } catch (err) {
    console.error(err);
    showToast(errorMessage(err));
  }
}

function errorMessage(err) {
  return err?.message || 'Erreur lors de la mise à jour Grist';
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 3400);
}

function showConfigError() {
  $('board').innerHTML = `
    <div class="config-error">
      Configuration requise : mappez les colonnes du widget avec la table EMM dans le panneau de configuration Grist.
    </div>`;
}

function bindEvents() {
  $('newCardBtn').addEventListener('click', () => openModal(null));
  $('refreshBtn').addEventListener('click', () => renderBoard());
  $('closeModalBtn').addEventListener('click', closeModal);
  $('saveCardBtn').addEventListener('click', saveModal);
  $('deleteCardBtn').addEventListener('click', deleteCurrentCard);
  $('modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

  $('searchInput').addEventListener('input', event => { state.filters.search = event.target.value; renderBoard(); });
  $('categoryFilter').addEventListener('change', event => { state.filters.category = event.target.value; renderBoard(); });
  $('caseFilter').addEventListener('change', event => { state.filters.caseType = event.target.value; renderBoard(); });
  $('priorityFilter').addEventListener('change', event => { state.filters.priority = event.target.value; renderBoard(); });
  $('assigneeFilter').addEventListener('change', event => { state.filters.assignee = event.target.value; renderBoard(); });
  $('sprintFilter').addEventListener('change', event => { state.filters.sprint = event.target.value; renderBoard(); });
  $('sortSelect').addEventListener('change', event => { state.filters.sort = event.target.value; renderBoard(); });
  $('resetFiltersBtn').addEventListener('click', () => {
    state.filters = { search: '', category: '', caseType: '', priority: '', assignee: '', sprint: '', sort: 'priority' };
    $('searchInput').value = '';
    $('categoryFilter').value = '';
    $('caseFilter').value = '';
    $('priorityFilter').value = '';
    $('assigneeFilter').value = '';
    $('sprintFilter').value = '';
    $('sortSelect').value = 'priority';
    renderBoard();
  });
}

bindEvents();

grist.ready({
  requiredAccess: 'full',
  columns: COLUMNS
});

grist.onRecords((records) => {
  const mapped = grist.mapColumnNames(records);
  if (!mapped) {
    showConfigError();
    return;
  }
  state.records = normalizeIncoming(mapped).map(normalizeRecord).filter(r => r.id);
  refreshFilters();
  renderBoard();
});

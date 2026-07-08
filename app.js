const STATUSES = [
  "Nouveau",
  "En cours DUD",
  "En cours DT",
  "En développement",
  "En Test",
  "En Test CU",
  "Déployé"
];

const STATUS_COLORS = {
  "Nouveau": "#3157ff",
  "En cours DUD": "#7047eb",
  "En cours DT": "#0ba5ec",
  "En développement": "#f79009",
  "En Test": "#12b76a",
  "En Test CU": "#039855",
  "Déployé": "#667085"
};

const PRIORITY_RANK = {
  "P0": 0,
  "P1": 1,
  "Haute": 1,
  "P2": 2,
  "Moyenne": 2,
  "P3": 3,
  "Basse": 3
};

const COLUMNS = [
  { name: "Title", title: "Service", type: "Text" },
  { name: "ServiceUtilisateur", title: "Service Utilisateur", type: "Text" },
  { name: "Category", title: "Catégorie", type: "Text" },
  { name: "CaseType", title: "Cas", type: "Text" },
  { name: "Description", title: "Description", type: "Text" },
  { name: "DesiredDate", title: "Date souhaitée" },
  { name: "Priority", title: "Prio", type: "Text" },
  { name: "ModifiedAt", title: "Modifiée le" },
  { name: "Status", title: "Statut", type: "Text" },
  { name: "Assignees", title: "Assignée à" },
  { name: "Comment", title: "Commentaire", type: "Text" },
  { name: "RTU", title: "RTU", optional: true },
  { name: "Sprint", title: "Sprint", optional: true },
  { name: "CreatedBy", title: "Créée par", optional: true },
  { name: "CreatedAt", title: "Créé le", optional: true },
  { name: "Requester", title: "CP/Demandeur", optional: true }
];

grist.ready({
  requiredAccess: "full",
  columns: COLUMNS
});

const state = {
  search: "",
  category: "",
  caseType: "",
  priority: "",
  assignee: "",
  sprint: "",
  sort: "priority",
  compact: false
};

let allRecords = [];
let currentRecordId = null;
let dragStartedAt = 0;

const $ = (id) => document.getElementById(id);

function asArray(value) {
  if (Array.isArray(value)) {
    const arr = value[0] === "L" ? value.slice(1) : value;
    return arr.map(v => asText(v)).filter(Boolean);
  }
  if (value === null || value === undefined || value === "") return [];
  return String(value).split(",").map(v => v.trim()).filter(Boolean);
}

function asText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return asArray(value).join(", ");
  if (value instanceof Date) return dateToISO(value);
  return String(value);
}

function dateToISO(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 100000000000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const s = String(value);
  const match = s.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10);
}

function formatDate(value) {
  const iso = dateToISO(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeIncoming(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.id)) {
    return data.id.map((id, i) => {
      const row = { id };
      Object.keys(data).forEach(k => { row[k] = data[k][i]; });
      return row;
    });
  }
  return [];
}

function normalizeRecord(r) {
  const status = asText(r.Status);
  const normalizedStatus = STATUSES.includes(status) ? status : "Nouveau";
  return {
    id: r.id,
    Title: asText(r.Title),
    ServiceUtilisateur: asText(r.ServiceUtilisateur),
    Category: asText(r.Category),
    CaseType: asText(r.CaseType),
    Description: asText(r.Description),
    DesiredDate: r.DesiredDate,
    Priority: asText(r.Priority),
    ModifiedAt: r.ModifiedAt,
    Status: normalizedStatus,
    Assignees: r.Assignees,
    Comment: asText(r.Comment),
    RTU: asText(r.RTU),
    Sprint: asText(r.Sprint),
    CreatedBy: asText(r.CreatedBy),
    CreatedAt: r.CreatedAt,
    Requester: asText(r.Requester)
  };
}

function titleFor(record) {
  return record.Title || [record.Category, record.ServiceUtilisateur].filter(Boolean).join(" · ") || "(Sans titre)";
}

function priorityKey(priority) {
  return asText(priority).toLowerCase().replace(/\s+/g, "-");
}

function priorityClass(priority) {
  const key = priorityKey(priority);
  if (!key) return "";
  return `prio-${key}`;
}

function badgePriorityClass(priority) {
  const key = priorityKey(priority);
  return key ? `badge--prio-${key}` : "";
}

function compareDateAsc(a, b) {
  const da = Date.parse(dateToISO(a)) || 8640000000000000;
  const db = Date.parse(dateToISO(b)) || 8640000000000000;
  return da - db;
}

function compareDateDesc(a, b) {
  const da = Date.parse(dateToISO(a)) || 0;
  const db = Date.parse(dateToISO(b)) || 0;
  return db - da;
}

function isOverdue(value, status) {
  if (!value || status === "Déployé") return false;
  const iso = dateToISO(value);
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function isDueSoon(value, status) {
  if (!value || status === "Déployé" || isOverdue(value, status)) return false;
  const iso = dateToISO(value);
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 7;
}

function truncate(text, max = 155) {
  const s = asText(text).trim();
  return s.length > max ? s.slice(0, max).trim() + "…" : s;
}

function uniqueValues(records, field, splitList = false) {
  const set = new Set();
  records.forEach(r => {
    if (splitList) {
      asArray(r[field]).forEach(v => set.add(v));
    } else {
      const v = asText(r[field]).trim();
      if (v) set.add(v);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}

function setSelectOptions(selectId, values, firstLabel) {
  const select = $(selectId);
  const current = select.value;
  select.replaceChildren();
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);
  values.forEach(v => {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    select.appendChild(option);
  });
  select.value = values.includes(current) ? current : "";
}

function refreshFilterOptions() {
  setSelectOptions("categoryFilter", uniqueValues(allRecords, "Category"), "Toutes catégories");
  setSelectOptions("caseFilter", uniqueValues(allRecords, "CaseType"), "Tous les cas");
  setSelectOptions("priorityFilter", uniqueValues(allRecords, "Priority"), "Toutes priorités");
  setSelectOptions("assigneeFilter", uniqueValues(allRecords, "Assignees", true), "Tous assignés");
  setSelectOptions("sprintFilter", uniqueValues(allRecords, "Sprint"), "Tous sprints");
}

function filteredRecords() {
  const s = state.search.trim().toLowerCase();
  return allRecords.filter(r => {
    const text = [
      titleFor(r), r.ServiceUtilisateur, r.Category, r.CaseType, r.Description,
      r.Priority, asText(r.Assignees), r.Comment, r.RTU, r.Sprint, r.Requester
    ].join(" ").toLowerCase();

    if (s && !text.includes(s)) return false;
    if (state.category && r.Category !== state.category) return false;
    if (state.caseType && r.CaseType !== state.caseType) return false;
    if (state.priority && r.Priority !== state.priority) return false;
    if (state.sprint && r.Sprint !== state.sprint) return false;
    if (state.assignee && !asArray(r.Assignees).includes(state.assignee)) return false;
    return true;
  });
}

function sortRecords(records) {
  const copy = [...records];
  copy.sort((a, b) => {
    if (state.sort === "priority") {
      return (PRIORITY_RANK[a.Priority] ?? 99) - (PRIORITY_RANK[b.Priority] ?? 99)
        || compareDateAsc(a.DesiredDate, b.DesiredDate)
        || titleFor(a).localeCompare(titleFor(b), "fr");
    }
    if (state.sort === "due") return compareDateAsc(a.DesiredDate, b.DesiredDate);
    if (state.sort === "modified") return compareDateDesc(a.ModifiedAt, b.ModifiedAt);
    if (state.sort === "created") return compareDateDesc(a.CreatedAt, b.CreatedAt);
    if (state.sort === "title") return titleFor(a).localeCompare(titleFor(b), "fr");
    return 0;
  });
  return copy;
}

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderKpis(records) {
  const total = records.length;
  const urgent = records.filter(r => r.Status !== "Déployé" && ["P0", "P1", "Haute"].includes(r.Priority)).length;
  const overdue = records.filter(r => isOverdue(r.DesiredDate, r.Status)).length;
  const dueSoon = records.filter(r => isDueSoon(r.DesiredDate, r.Status)).length;

  const items = [
    ["En retard", overdue, "kpi--danger"],
    ["Urgents", urgent, "kpi--warning"],
    ["À 7 jours", dueSoon, "kpi--attention"],
    ["Total", total, "kpi--neutral"]
  ];

  const kpiBar = $("kpiBar");
  kpiBar.replaceChildren();
  items.forEach(([label, value, modifier]) => {
    const card = makeEl("div", `kpi ${modifier}`.trim());
    card.appendChild(makeEl("div", "kpi__label", label));
    card.appendChild(makeEl("div", "kpi__value", String(value)));
    kpiBar.appendChild(card);
  });
}

function renderBoard() {
  const board = $("board");
  board.replaceChildren();

  const records = sortRecords(filteredRecords());
  renderKpis(records);

  STATUSES.forEach(status => {
    const laneRecords = records.filter(r => r.Status === status);
    const lane = makeEl("section", "lane");
    lane.dataset.status = status;

    lane.addEventListener("dragover", onLaneDragOver);
    lane.addEventListener("dragleave", onLaneDragLeave);
    lane.addEventListener("drop", onLaneDrop);

    const header = makeEl("div", "lane__header");
    const title = makeEl("div", "lane__title");
    const dot = makeEl("span", "lane__dot");
    dot.style.background = STATUS_COLORS[status] || "#3157ff";
    title.appendChild(dot);
    title.appendChild(document.createTextNode(status));
    const count = makeEl("div", "lane__count", String(laneRecords.length));
    header.appendChild(title);
    header.appendChild(count);
    lane.appendChild(header);

    if (laneRecords.length === 0) {
      lane.appendChild(makeEl("div", "empty-lane", "Aucune carte"));
    } else {
      laneRecords.forEach(record => lane.appendChild(createCard(record)));
    }

    board.appendChild(lane);
  });
}

function addBadge(container, text, className = "") {
  if (!text) return;
  const badge = makeEl("span", `badge ${className}`.trim(), text);
  container.appendChild(badge);
}

function createCard(record) {
  const card = makeEl("article", `card ${priorityClass(record.Priority)}`.trim());
  card.draggable = true;
  card.dataset.id = String(record.id);

  card.addEventListener("dragstart", e => {
    dragStartedAt = Date.now();
    e.dataTransfer.setData("text/plain", String(record.id));
    e.dataTransfer.effectAllowed = "move";
  });

  card.addEventListener("click", () => {
    if (Date.now() - dragStartedAt < 250) return;
    openDrawer(record.id);
  });

  const top = makeEl("div", "card__top");
  const titleBlock = makeEl("div");
  titleBlock.appendChild(makeEl("div", "card__title", titleFor(record)));
  titleBlock.appendChild(makeEl("div", "card__cu", record.ServiceUtilisateur || "CU non renseignée"));
  top.appendChild(titleBlock);
  card.appendChild(top);

  const badges = makeEl("div", "card__badges");
  addBadge(badges, record.Priority, badgePriorityClass(record.Priority));
  addBadge(badges, record.Category, "badge--category");
  addBadge(badges, record.CaseType, "badge--case");
  card.appendChild(badges);

  const summary = truncate(record.Description || record.Comment, 175);
  if (summary) card.appendChild(makeEl("div", "card__desc", summary));

  const footer = makeEl("div", "card__footer");
  footer.appendChild(makeEl("span", "card__assignee", asText(record.Assignees) || "Non assignée"));
  const date = formatDate(record.DesiredDate);
  const dateNode = makeEl("span", `card__date ${isOverdue(record.DesiredDate, record.Status) ? "overdue" : ""}`.trim(), date ? `Échéance ${date}` : "Sans échéance");
  footer.appendChild(dateNode);
  card.appendChild(footer);

  return card;
}

function onLaneDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function onLaneDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

async function onLaneDrop(e) {
  e.preventDefault();
  const lane = e.currentTarget;
  lane.classList.remove("drag-over");

  const id = Number(e.dataTransfer.getData("text/plain"));
  const newStatus = lane.dataset.status;
  const record = allRecords.find(r => Number(r.id) === id);
  if (!record || record.Status === newStatus) return;

  try {
    await updateRecord(id, { Status: newStatus, ModifiedAt: todayISO() });
    showToast(`Statut mis à jour : ${newStatus}`);
  } catch (err) {
    console.error(err);
    showToast(err.message || "Erreur lors du changement de statut");
  }
}

function fillStatusSelect() {
  const select = $("fStatus");
  select.replaceChildren();
  STATUSES.forEach(status => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });
}

function setValue(id, value) {
  const node = $(id);
  if (node) node.value = value ?? "";
}

function getValue(id) {
  const node = $(id);
  return node ? node.value.trim() : "";
}

function openDrawer(id = null) {
  fillStatusSelect();
  currentRecordId = id;
  const record = id ? allRecords.find(r => Number(r.id) === Number(id)) : null;

  $("drawerTitle").textContent = record ? titleFor(record) : "Nouvelle carte";
  $("deleteCardBtn").style.display = record ? "inline-flex" : "none";

  setValue("fTitle", record?.Title || "");
  setValue("fCU", record?.ServiceUtilisateur || "");
  setValue("fCategory", record?.Category || "");
  setValue("fCase", record?.CaseType || "");
  setValue("fRTU", record?.RTU || "");
  setValue("fStatus", record?.Status || "Nouveau");
  setValue("fPriority", record?.Priority || "");
  setValue("fDueDate", dateToISO(record?.DesiredDate));
  setValue("fSprint", record?.Sprint || "");
  setValue("fAssignees", asText(record?.Assignees));
  setValue("fRequester", record?.Requester || "");
  setValue("fCreatedBy", record?.CreatedBy || "");
  setValue("fDescription", record?.Description || "");
  setValue("fComment", record?.Comment || "");

  const created = record ? formatDate(record.CreatedAt) : "";
  const modified = record ? formatDate(record.ModifiedAt) : "";
  $("drawerMeta").textContent = record
    ? `Créé le ${created || "non renseigné"} · Modifié le ${modified || "non renseigné"}`
    : "Nouvelle carte";

  $("drawerBackdrop").classList.remove("hidden");
  $("drawer").classList.add("is-open");
  $("drawer").setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  currentRecordId = null;
  $("drawer").classList.remove("is-open");
  $("drawer").setAttribute("aria-hidden", "true");
  $("drawerBackdrop").classList.add("hidden");
}

function assigneesForSave(originalValue) {
  const text = getValue("fAssignees");
  const values = text.split(",").map(v => v.trim()).filter(Boolean);

  // Texte simple : le plus robuste et recommandé pour cette V2.
  if (!Array.isArray(originalValue)) return values.join(", ");

  // Choice List Grist : ['L', 'Nom 1', 'Nom 2'].
  if (originalValue[0] === "L") return ["L", ...values];

  // Autres listes : on renvoie la liste simple. Les Reference Lists nécessiteront une variante dédiée.
  return values;
}

function cleanedFields(fields) {
  const out = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function mapBack(fields) {
  const mapped = grist.mapColumnNamesBack(cleanedFields(fields));
  if (!mapped) {
    throw new Error("Mapping des colonnes incomplet. Ouvrez la configuration du widget et mappez les colonnes requises.");
  }
  delete mapped.id;
  delete mapped.fields;
  return mapped;
}

async function updateRecord(id, fields) {
  const table = grist.getTable();
  await table.update([{ id: Number(id), fields: mapBack(fields) }], { parseStrings: true });
}

async function createRecord(fields) {
  const table = grist.getTable();
  await table.create([{ fields: mapBack(fields) }], { parseStrings: true });
}

async function deleteRecord(id) {
  const table = grist.getTable();
  try {
    await table.destroy([Number(id)]);
  } catch (err) {
    await table.destroy(Number(id));
  }
}

async function saveDrawer() {
  const existing = currentRecordId ? allRecords.find(r => Number(r.id) === Number(currentRecordId)) : null;
  const now = todayISO();

  const fields = {
    Title: getValue("fTitle"),
    ServiceUtilisateur: getValue("fCU"),
    Category: getValue("fCategory"),
    CaseType: getValue("fCase"),
    RTU: getValue("fRTU"),
    Status: getValue("fStatus") || "Nouveau",
    Priority: getValue("fPriority"),
    DesiredDate: getValue("fDueDate"),
    Sprint: getValue("fSprint"),
    Assignees: assigneesForSave(existing?.Assignees),
    Requester: getValue("fRequester"),
    CreatedBy: getValue("fCreatedBy"),
    Description: getValue("fDescription"),
    Comment: getValue("fComment"),
    ModifiedAt: now
  };

  try {
    if (currentRecordId) {
      await updateRecord(currentRecordId, fields);
      showToast("Carte mise à jour");
    } else {
      fields.CreatedAt = now;
      await createRecord(fields);
      showToast("Carte créée");
    }
    closeDrawer();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Erreur lors de l’enregistrement");
  }
}

async function deleteCurrentCard() {
  if (!currentRecordId) return;
  if (!confirm("Supprimer cette carte ?")) return;
  try {
    await deleteRecord(currentRecordId);
    showToast("Carte supprimée");
    closeDrawer();
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de la suppression");
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => toast.classList.add("hidden"), 3000);
}

function renderMappingMessage() {
  const board = $("board");
  board.replaceChildren();
  const box = makeEl("div", "mapping-message");
  box.appendChild(makeEl("h2", "", "Configuration du widget requise"));
  box.appendChild(makeEl("p", "", "Ouvrez la configuration du widget et mappez les colonnes Grist avec les champs attendus par le Kanban EMM."));
  board.appendChild(box);
}

function bindEvents() {
  $("newCardBtn").addEventListener("click", () => openDrawer(null));
  $("refreshBtn").addEventListener("click", () => window.location.reload());
  $("toggleFiltersBtn").addEventListener("click", () => {
    const panel = $("filterPanel");
    const isOpen = panel.classList.toggle("is-open");
    $("toggleFiltersBtn").textContent = isOpen ? "Masquer filtres" : "Filtres";
  });
  $("compactBtn").addEventListener("click", () => {
    state.compact = !state.compact;
    document.body.classList.toggle("compact", state.compact);
    $("compactBtn").textContent = state.compact ? "Vue détaillée" : "Vue compacte";
  });
  $("closeDrawerBtn").addEventListener("click", closeDrawer);
  $("drawerBackdrop").addEventListener("click", closeDrawer);
  $("saveCardBtn").addEventListener("click", saveDrawer);
  $("deleteCardBtn").addEventListener("click", deleteCurrentCard);

  $("searchInput").addEventListener("input", e => {
    state.search = e.target.value;
    renderBoard();
  });
  $("sortSelect").addEventListener("change", e => {
    state.sort = e.target.value;
    renderBoard();
  });
  $("categoryFilter").addEventListener("change", e => {
    state.category = e.target.value;
    renderBoard();
  });
  $("caseFilter").addEventListener("change", e => {
    state.caseType = e.target.value;
    renderBoard();
  });
  $("priorityFilter").addEventListener("change", e => {
    state.priority = e.target.value;
    renderBoard();
  });
  $("assigneeFilter").addEventListener("change", e => {
    state.assignee = e.target.value;
    renderBoard();
  });
  $("sprintFilter").addEventListener("change", e => {
    state.sprint = e.target.value;
    renderBoard();
  });
  $("resetFiltersBtn").addEventListener("click", () => {
    state.search = "";
    state.category = "";
    state.caseType = "";
    state.priority = "";
    state.assignee = "";
    state.sprint = "";
    state.sort = "priority";
    $("searchInput").value = "";
    $("categoryFilter").value = "";
    $("caseFilter").value = "";
    $("priorityFilter").value = "";
    $("assigneeFilter").value = "";
    $("sprintFilter").value = "";
    $("sortSelect").value = "priority";
    renderBoard();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
  });
}

bindEvents();

grist.onRecords((data) => {
  const mapped = grist.mapColumnNames(data);
  if (!mapped) {
    renderMappingMessage();
    return;
  }
  allRecords = normalizeIncoming(mapped).map(normalizeRecord).filter(r => r.id !== undefined && r.id !== null);
  refreshFilterOptions();
  renderBoard();
});

const STATUSES = [
  "Nouveau",
  "En cours DUD",
  "En cours DT",
  "En développement",
  "En Test",
  "En Test CU",
  "Déployé"
];

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
  { name: "ServiceUtilisateur", title: "Service Utilisateur" },
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
  serviceId: "",
  community: "",
  department: "",
  deploymentStatus: "",
  deploymentPriority: "",
  search: "",
  category: "",
  caseType: "",
  priority: "",
  assignee: "",
  sort: "priority",
  compact: false,
  filtersHidden: false
};

let allRecords = [];
let currentRecordId = null;
let dragStartedAt = 0;

let servicesLoaded = false;
let servicesLoadError = null;
let services = [];
let serviceById = new Map();
let serviceIdByLabel = new Map();

const SERVICE_TABLE_CANDIDATES = [
  "REF_Services_Utilisateurs",
  "REF_Services Utilisateurs",
  "REFServicesUtilisateurs",
  "REF_Services_Utilisateurs1",
  "REF_Services_Utilisateurs2"
];

const $ = (id) => document.getElementById(id);

function normalizeKey(value) {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getFirstValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return "";
}

function getFlexibleValue(row, keys) {
  const direct = getFirstValue(row, keys);
  if (direct !== "") return direct;
  if (!row) return "";
  const normalizedCandidates = new Set(keys.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedCandidates.has(normalizeKey(key)) && value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

function rowRecordsFromTable(data) {
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

async function findTableId(candidates, fuzzyNeedle) {
  for (const tableId of candidates) {
    try {
      await grist.docApi.fetchTable(tableId);
      return tableId;
    } catch (e) {
      // Essai suivant.
    }
  }

  try {
    const tableIds = await grist.docApi.listTables();
    const needle = normalizeKey(fuzzyNeedle);
    const found = (tableIds || []).find(t => normalizeKey(t).includes(needle));
    return found || null;
  } catch (e) {
    return null;
  }
}

async function loadServicesReference() {
  if (servicesLoaded) return;

  servicesLoaded = true;
  servicesLoadError = null;
  services = [];
  serviceById = new Map();
  serviceIdByLabel = new Map();

  try {
    const tableId = await findTableId(SERVICE_TABLE_CANDIDATES, "REF Services Utilisateurs");
    if (!tableId) {
      servicesLoadError = "Table REF_Services Utilisateurs introuvable";
      return;
    }

    const raw = await grist.docApi.fetchTable(tableId);
    services = rowRecordsFromTable(raw).map(row => {
      const nom = asText(getFlexibleValue(row, ["Nom", "nom"]));
      const nomLong = asText(getFlexibleValue(row, ["Nom_Long", "Nom Long", "nom_long"]));
      const community = asText(getFlexibleValue(row, [
        "Communauté Nationale", "Communaute Nationale", "Communauté_Nationale", "Communaute_Nationale"
      ]));
      const department = asText(getFlexibleValue(row, ["Département", "Departement"]));
      const deploymentPriority = asText(getFlexibleValue(row, [
        "Priorité Déploiement", "Priorite Deploiement", "Priorité_Déploiement", "Priorite_Deploiement"
      ]));
      const deploymentStatus = asText(getFlexibleValue(row, [
        "Statut Déploiement", "Statut Deploiement", "Statut_Déploiement", "Statut_Deploiement",
        "Avancement Matrice de déploiement", "Avancement Matrice de deploiement",
        "Avancement_Matrice_de_déploiement", "Avancement_Matrice_de_deploiement"
      ]));
      const label = nom || nomLong || `Service #${row.id}`;
      return {
        id: Number(row.id), nom, nomLong, label,
        community, department, deploymentPriority, deploymentStatus
      };
    }).filter(svc => svc.id && svc.label)
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));

    services.forEach(svc => {
      serviceById.set(Number(svc.id), svc);
      serviceIdByLabel.set(normalizeKey(svc.label), Number(svc.id));
      if (svc.nom) serviceIdByLabel.set(normalizeKey(svc.nom), Number(svc.id));
      if (svc.nomLong) serviceIdByLabel.set(normalizeKey(svc.nomLong), Number(svc.id));
    });
  } catch (err) {
    console.warn("Impossible de charger REF_Services Utilisateurs", err);
    servicesLoadError = err.message || "Erreur de chargement du référentiel services";
  }
}

function serviceLabel(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return serviceById.get(Number(value))?.label || `Service #${value}`;
  if (Array.isArray(value)) {
    const values = value[0] === "L" ? value.slice(1) : value;
    return values.map(item => serviceLabel(item)).filter(Boolean).join(", ");
  }

  const text = asText(value);
  const maybeId = Number(text);
  if (Number.isInteger(maybeId) && serviceById.has(maybeId)) {
    return serviceById.get(maybeId).label;
  }
  return text;
}

function rawServiceId(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number(value);
  const text = asText(value);
  const numeric = Number(text);
  if (Number.isInteger(numeric) && serviceById.has(numeric)) return numeric;
  const fromLabel = serviceIdByLabel.get(normalizeKey(text));
  return fromLabel || text;
}

function populateServiceSelect(record) {
  const select = $("fCU");
  if (!select) return;
  select.replaceChildren();

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "";
  select.appendChild(empty);

  services.forEach(svc => {
    const option = document.createElement("option");
    option.value = String(svc.id);
    option.textContent = svc.label;
    select.appendChild(option);
  });

  const raw = record?.ServiceUtilisateurRaw ?? "";
  const rawId = rawServiceId(raw);
  if (rawId !== "" && rawId !== null && rawId !== undefined) {
    const value = String(rawId);
    if (![...select.options].some(opt => opt.value === value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = serviceLabel(raw);
      select.appendChild(option);
    }
    select.value = value;
  }
}

function serviceValueForSave() {
  const value = getValue("fCU");
  if (!value) return "";
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : value;
}

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
    ServiceUtilisateurRaw: r.ServiceUtilisateur,
    ServiceUtilisateur: serviceLabel(r.ServiceUtilisateur),
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

function fillSelect(selectId, values, firstLabel, currentValue = "") {
  const select = $(selectId);
  if (!select) return "";
  select.replaceChildren();

  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);

  values.forEach(item => {
    const option = document.createElement("option");
    if (typeof item === "object") {
      option.value = String(item.value);
      option.textContent = item.label;
    } else {
      option.value = String(item);
      option.textContent = String(item);
    }
    select.appendChild(option);
  });

  const validValues = new Set([...select.options].map(option => option.value));
  const requested = String(currentValue || "");
  select.value = validValues.has(requested) ? requested : "";
  return select.value;
}

function serviceMatchesDimensionFilters(service, ignoredField = "") {
  if (!service) return false;
  if (ignoredField !== "community" && state.community && service.community !== state.community) return false;
  if (ignoredField !== "department" && state.department && service.department !== state.department) return false;
  if (ignoredField !== "deploymentStatus" && state.deploymentStatus && service.deploymentStatus !== state.deploymentStatus) return false;
  if (ignoredField !== "deploymentPriority" && state.deploymentPriority && service.deploymentPriority !== state.deploymentPriority) return false;
  return true;
}

function serviceFromToken(token) {
  if (token === null || token === undefined || token === "") return null;
  const numeric = Number(token);
  if (Number.isInteger(numeric) && serviceById.has(numeric)) return serviceById.get(numeric);
  const id = serviceIdByLabel.get(normalizeKey(serviceLabel(token)));
  return id ? serviceById.get(id) : null;
}

function rawServiceTokens(raw) {
  if (Array.isArray(raw)) return raw[0] === "L" ? raw.slice(1) : raw;
  if (raw === null || raw === undefined || raw === "") return [];
  return String(raw).split(/[,;\n|]+/).map(value => value.trim()).filter(Boolean);
}

function rawIsCommonService(raw) {
  return rawServiceTokens(raw).some(token => normalizeKey(serviceLabel(token)) === "tous");
}

function recordMatchesServiceFilters(record) {
  const tokens = rawServiceTokens(record.ServiceUtilisateurRaw);
  const isCommon = rawIsCommonService(record.ServiceUtilisateurRaw);

  if (state.serviceId) {
    if (isCommon) return true;
    const selected = Number(state.serviceId);
    const selectedLabel = serviceById.get(selected)?.label || "";
    return tokens.some(token => {
      const service = serviceFromToken(token);
      return service ? service.id === selected : normalizeKey(serviceLabel(token)) === normalizeKey(selectedLabel);
    });
  }

  const hasDimensionFilter = Boolean(state.community || state.department || state.deploymentStatus || state.deploymentPriority);
  if (!hasDimensionFilter) return true;
  if (isCommon) return true;

  return tokens.some(token => serviceMatchesDimensionFilters(serviceFromToken(token)));
}

function recordsInServiceScope() {
  return allRecords.filter(recordMatchesServiceFilters);
}

function refreshServiceFilterOptions() {
  const communityValues = uniqueValues(services.filter(service => serviceMatchesDimensionFilters(service, "community")), "community");
  state.community = fillSelect("communityFilter", communityValues, "Toutes les communautés", state.community);

  const departmentValues = uniqueValues(services.filter(service => serviceMatchesDimensionFilters(service, "department")), "department");
  state.department = fillSelect("departmentFilter", departmentValues, "Tous les départements", state.department);

  const deploymentStatuses = uniqueValues(services.filter(service => serviceMatchesDimensionFilters(service, "deploymentStatus")), "deploymentStatus");
  state.deploymentStatus = fillSelect("deploymentStatusFilter", deploymentStatuses, "Tous les statuts", state.deploymentStatus);

  const deploymentPriorities = uniqueValues(services.filter(service => serviceMatchesDimensionFilters(service, "deploymentPriority")), "deploymentPriority");
  state.deploymentPriority = fillSelect("deploymentPriorityFilter", deploymentPriorities, "Toutes les priorités", state.deploymentPriority);

  const availableServices = services.filter(service => serviceMatchesDimensionFilters(service));
  const serviceOptions = availableServices.map(service => ({ value: service.id, label: service.label }));
  state.serviceId = fillSelect("serviceFilter", serviceOptions, "Tous les services utilisateurs", state.serviceId);
}

function refreshWorkFilterOptions() {
  const scoped = recordsInServiceScope();
  state.category = fillSelect("categoryFilter", uniqueValues(scoped, "Category"), "Toutes les catégories", state.category);
  state.caseType = fillSelect("caseFilter", uniqueValues(scoped, "CaseType"), "Tous les cas", state.caseType);
  state.priority = fillSelect("priorityFilter", uniqueValues(scoped, "Priority"), "Toutes les priorités", state.priority);
  state.assignee = fillSelect("assigneeFilter", uniqueValues(scoped, "Assignees", true), "Toutes les personnes", state.assignee);
}

function refreshFilterOptions() {
  refreshServiceFilterOptions();
  refreshWorkFilterOptions();
}

function filteredRecords() {
  const search = normalizeKey(state.search);
  return allRecords.filter(record => {
    if (!recordMatchesServiceFilters(record)) return false;

    const searchable = normalizeKey([
      titleFor(record), record.ServiceUtilisateur, record.Category, record.CaseType, record.Description,
      record.Priority, asText(record.Assignees), record.Comment, record.RTU, record.Sprint, record.Requester
    ].join(" "));

    if (search && !searchable.includes(search)) return false;
    if (state.category && record.Category !== state.category) return false;
    if (state.caseType && record.CaseType !== state.caseType) return false;
    if (state.priority && record.Priority !== state.priority) return false;
    if (state.assignee && !asArray(record.Assignees).includes(state.assignee)) return false;
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
  const active = records.filter(record => record.Status !== "Déployé");
  const p0p1 = active.filter(record => ["P0", "P1"].includes(asText(record.Priority).trim())).length;
  const overdue = active.filter(record => isOverdue(record.DesiredDate, record.Status)).length;

  const items = [
    ["Sujets en cours", active.length, "kpi--neutral"],
    ["P0 ou P1", p0p1, "kpi--warning"],
    ["En retard", overdue, "kpi--danger"]
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
  populateServiceSelect(record);
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
  const cleaned = cleanedFields(fields);

  // IMPORTANT : pour une mise à jour partielle, par exemple un drag & drop qui
  // ne modifie que Statut + Modifiée le, il faut demander à Grist de mapper
  // uniquement les colonnes présentes dans "fields".
  // Sans ce filtrage, mapColumnNamesBack peut renvoyer aussi les autres colonnes
  // mappées avec une valeur undefined, ce qui peut effacer les données existantes.
  const requestedColumns = COLUMNS.filter(col =>
    Object.prototype.hasOwnProperty.call(cleaned, col.name)
  );

  const mapped = grist.mapColumnNamesBack(cleaned, { columns: requestedColumns });
  if (!mapped) {
    throw new Error("Mapping des colonnes incomplet. Ouvrez la configuration du widget et mappez les colonnes requises.");
  }

  // Sécurité : ces clés ne doivent jamais être envoyées comme champs métier.
  delete mapped.id;
  delete mapped.fields;

  // Sécurité complémentaire : ne jamais envoyer de champ undefined à Grist,
  // sinon certaines instances peuvent interpréter cela comme une remise à vide.
  Object.keys(mapped).forEach(key => {
    if (mapped[key] === undefined) delete mapped[key];
  });

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
    ServiceUtilisateur: serviceValueForSave(),
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

function handleServiceDimensionChange(key, value) {
  state[key] = value;
  refreshServiceFilterOptions();
  refreshWorkFilterOptions();
  renderBoard();
}

function bindEvents() {
  $("newCardBtn").addEventListener("click", () => openDrawer(null));
  $("refreshBtn").addEventListener("click", () => window.location.reload());

  $("toggleFiltersBtn").addEventListener("click", () => {
    state.filtersHidden = !state.filtersHidden;
    $("filterDeck").classList.toggle("is-collapsed", state.filtersHidden);
    $("toggleFiltersBtn").textContent = state.filtersHidden ? "Afficher les filtres" : "Masquer les filtres";
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

  $("serviceFilter").addEventListener("change", event => {
    state.serviceId = event.target.value;
    refreshWorkFilterOptions();
    renderBoard();
  });
  $("communityFilter").addEventListener("change", event => handleServiceDimensionChange("community", event.target.value));
  $("departmentFilter").addEventListener("change", event => handleServiceDimensionChange("department", event.target.value));
  $("deploymentStatusFilter").addEventListener("change", event => handleServiceDimensionChange("deploymentStatus", event.target.value));
  $("deploymentPriorityFilter").addEventListener("change", event => handleServiceDimensionChange("deploymentPriority", event.target.value));

  $("searchInput").addEventListener("input", event => {
    state.search = event.target.value;
    renderBoard();
  });
  $("sortSelect").addEventListener("change", event => {
    state.sort = event.target.value;
    renderBoard();
  });
  $("categoryFilter").addEventListener("change", event => {
    state.category = event.target.value;
    renderBoard();
  });
  $("caseFilter").addEventListener("change", event => {
    state.caseType = event.target.value;
    renderBoard();
  });
  $("priorityFilter").addEventListener("change", event => {
    state.priority = event.target.value;
    renderBoard();
  });
  $("assigneeFilter").addEventListener("change", event => {
    state.assignee = event.target.value;
    renderBoard();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDrawer();
  });
}

bindEvents();

grist.onRecords(async (data) => {
  const mapped = grist.mapColumnNames(data);
  if (!mapped) {
    renderMappingMessage();
    return;
  }

  await loadServicesReference();

  allRecords = normalizeIncoming(mapped).map(normalizeRecord).filter(r => r.id !== undefined && r.id !== null);
  refreshFilterOptions();
  renderBoard();

  if (servicesLoadError) {
    console.warn(servicesLoadError);
  }
});

const STATUSES = [
  "Nouveau",
  "En attente CU",
  "En cours DUD",
  "En cours DT",
  "En conception",
  "Terminé"
];


const PRIORITY_RANK = {
  "P0": 0,
  "P1": 1,
  "Haute": 1,
  "P2": 2,
  "Moyenne": 2,
  "P3": 3,
  "Basse": 3,
  "P4": 4
};

const COLUMNS = [
  { name: "Title", title: "Service" },
  { name: "ServiceUtilisateur", title: "Service Utilisateur" },
  { name: "Category", title: "Catégorie" },
  { name: "CaseType", title: "Cas" },
  { name: "Description", title: "Description" },
  { name: "DesiredDate", title: "Date souhaitée" },
  { name: "Priority", title: "Prio" },
  { name: "ModifiedAt", title: "Modifée le" },
  { name: "Status", title: "Statut" },
  { name: "Assignees", title: "Assignée à" },
  { name: "Comment", title: "Commentaire" },
  { name: "Target", title: "Cible", optional: true },
  { name: "RTU", title: "RTU", optional: true },
  { name: "CreatedBy", title: "Créée par", optional: true },
  { name: "CreatedAt", title: "Créé le", optional: true },
  { name: "Requester", title: "CP/Demandeur", optional: true }
];

grist.ready({
  requiredAccess: "full",
  columns: COLUMNS
});

const state = {
  serviceId: null,
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
let serviceComboIndex = -1;

// Métadonnées de la table sélectionnée. Elles permettent au widget de lire et
// d'écrire les mêmes champs qu'ils soient Texte, Date, Choice, Ref ou RefList.
let currentMappings = {};
let selectedTableId = "";
let metadataByTable = new Map();
let columnMetaById = new Map();
let fieldMetaByAlias = new Map();
let referenceCatalogs = new Map();
let metadataSignature = "";

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


function mappedColumnId(alias) {
  const value = currentMappings?.[alias];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function fieldMeta(alias) {
  return fieldMetaByAlias.get(alias) || { type: "Any", colId: mappedColumnId(alias), isFormula: false };
}

function referenceTarget(type) {
  const match = /^(?:Ref|RefList):(.+)$/.exec(type || "");
  return match ? match[1] : "";
}

function chooseReferenceDisplayColumn(tableId, raw) {
  const tableMeta = metadataByTable.get(tableId) || new Map();
  const keys = Object.keys(raw || {}).filter(key => key !== "id");

  for (const meta of fieldMetaByAlias.values()) {
    if (meta.refTableId === tableId && meta.visibleTableId === tableId && meta.visibleColId && keys.includes(meta.visibleColId)) {
      return meta.visibleColId;
    }
  }

  const aliases = ["nom", "nomlong", "libelle", "valeur", "statut", "intitule", "titre", "name", "label", "code", "email"];
  for (const alias of aliases) {
    const found = keys.find(key => normalizeKey(key) === alias || normalizeKey(tableMeta.get(key)?.label) === alias);
    if (found) return found;
  }

  return keys.find(key => {
    const type = tableMeta.get(key)?.type || "";
    return !type.startsWith("Attachments") && !type.startsWith("Ref:") && !type.startsWith("RefList:");
  }) || keys[0] || "";
}

async function loadMappedMetadata(mappings = {}) {
  currentMappings = mappings || {};
  try {
    if ((!currentMappings || !Object.keys(currentMappings).length) && grist.sectionApi?.mappings) {
      currentMappings = await grist.sectionApi.mappings() || {};
    }

    const tableOps = grist.getTable();
    selectedTableId = await tableOps.getTableId();
    const signature = `${selectedTableId}|${JSON.stringify(currentMappings)}`;
    if (signature === metadataSignature && fieldMetaByAlias.size) return;

    metadataSignature = signature;
    metadataByTable = new Map();
    columnMetaById = new Map();
    fieldMetaByAlias = new Map();
    referenceCatalogs = new Map();

    const [tablesRaw, columnsRaw] = await Promise.all([
      grist.docApi.fetchTable("_grist_Tables"),
      grist.docApi.fetchTable("_grist_Tables_column")
    ]);
    const tables = rowRecordsFromTable(tablesRaw);
    const columns = rowRecordsFromTable(columnsRaw);
    const tableNameByMetaId = new Map(tables.map(row => [Number(row.id), row.tableId]));

    columns.forEach(row => {
      const tableId = tableNameByMetaId.get(Number(row.parentId));
      if (!tableId) return;
      const meta = {
        metaId: Number(row.id),
        tableId,
        colId: row.colId,
        label: row.label || row.colId,
        type: row.type || "Any",
        isFormula: Boolean(row.isFormula),
        visibleColMetaId: Number(row.visibleCol || 0),
        displayColMetaId: Number(row.displayCol || 0)
      };
      columnMetaById.set(meta.metaId, meta);
      if (!metadataByTable.has(tableId)) metadataByTable.set(tableId, new Map());
      metadataByTable.get(tableId).set(meta.colId, meta);
    });

    columnMetaById.forEach(meta => {
      meta.refTableId = referenceTarget(meta.type);
      const visible = columnMetaById.get(meta.visibleColMetaId);
      const display = columnMetaById.get(meta.displayColMetaId);
      meta.visibleTableId = visible?.tableId || "";
      meta.visibleColId = visible?.colId || "";
      meta.displayTableId = display?.tableId || "";
      meta.displayColId = display?.colId || "";
    });

    const selectedMeta = metadataByTable.get(selectedTableId) || new Map();
    COLUMNS.forEach(column => {
      const colId = mappedColumnId(column.name);
      fieldMetaByAlias.set(column.name, selectedMeta.get(colId) || { type: "Any", colId, label: column.title, isFormula: false });
    });

    const targets = new Set([...fieldMetaByAlias.values()].map(meta => meta.refTableId).filter(Boolean));
    await Promise.all([...targets].map(async tableId => {
      try {
        const raw = await grist.docApi.fetchTable(tableId);
        const rows = rowRecordsFromTable(raw);
        const displayCol = chooseReferenceDisplayColumn(tableId, raw);
        const items = rows.map(row => {
          let label = displayCol ? asText(row[displayCol]).trim() : "";
          if (!label || label === "0") label = `#${row.id}`;
          return { id: Number(row.id), label };
        }).filter(item => item.id);
        referenceCatalogs.set(tableId, {
          tableId,
          displayCol,
          items,
          byId: new Map(items.map(item => [item.id, item]))
        });
      } catch (error) {
        console.warn(`Référentiel ${tableId} non chargé`, error);
      }
    }));
  } catch (error) {
    console.warn("Métadonnées Grist indisponibles", error);
  }
}

function displayMappedValue(alias, raw) {
  if (raw === null || raw === undefined || raw === "" || raw === 0 || raw === "0") return "";
  const meta = fieldMeta(alias);
  const type = meta.type || "Any";
  const target = referenceTarget(type);

  if (target) {
    const catalog = referenceCatalogs.get(target);
    const resolveOne = value => {
      if (value === null || value === undefined || value === "" || value === 0 || value === "0") return "";
      if (typeof value === "string" && !/^\d+$/.test(value.trim())) return value;
      const numeric = Number(value);
      return catalog?.byId.get(numeric)?.label || asText(value);
    };
    if (type.startsWith("RefList:")) return listValues(raw).map(resolveOne).filter(Boolean).join(", ");
    return resolveOne(raw);
  }

  if (type === "ChoiceList") return listValues(raw).map(asText).filter(Boolean).join(", ");
  return asText(raw);
}

function catalogForAlias(alias) {
  const meta = fieldMeta(alias);
  const target = referenceTarget(meta.type || "");
  return target ? referenceCatalogs.get(target) : null;
}

function matchReferenceValue(alias, label) {
  const catalog = catalogForAlias(alias);
  const text = asText(label).trim();
  if (!text) return 0;
  const numeric = Number(text);
  if (Number.isInteger(numeric) && catalog?.byId.has(numeric)) return numeric;
  const item = catalog?.items.find(entry => normalizeKey(entry.label) === normalizeKey(text));
  return item?.id || null;
}

function serializeMappedValue(alias, displayValue) {
  const meta = fieldMeta(alias);
  const type = meta.type || "Any";
  const text = asText(displayValue).trim();

  if (type.startsWith("RefList:")) {
    if (!text) return ["L"];
    const labels = text.split(/[,;\n]+/).map(value => value.trim()).filter(Boolean);
    const ids = labels.map(label => matchReferenceValue(alias, label));
    const unknown = labels.filter((_, index) => !ids[index]);
    if (unknown.length) throw new Error(`Valeur(s) inconnue(s) pour ${meta.label || alias} : ${unknown.join(", ")}`);
    return ["L", ...ids];
  }

  if (type.startsWith("Ref:")) {
    if (!text) return 0;
    const id = matchReferenceValue(alias, text);
    if (!id) throw new Error(`Valeur inconnue pour ${meta.label || alias} : ${text}`);
    return id;
  }

  if (type === "ChoiceList") {
    return ["L", ...text.split(/[,;\n]+/).map(value => value.trim()).filter(Boolean)];
  }

  if (type === "Bool") {
    const normalized = normalizeKey(text);
    if (["oui", "true", "vrai", "1"].includes(normalized)) return true;
    if (["non", "false", "faux", "0", ""].includes(normalized)) return false;
  }

  if (type === "Int" || type === "Numeric") {
    if (!text) return null;
    const number = Number(text.replace(",", "."));
    return Number.isFinite(number) ? number : text;
  }

  if (type === "Date" || type === "DateTime") {
    if (!text) return null;
    return dateToISO(text) || text;
  }

  return displayValue;
}

function timestampForAlias(alias) {
  const type = fieldMeta(alias).type || "Any";
  if (type === "DateTime") return new Date().toISOString();
  if (type === "Date") return todayISO();
  return new Date().toLocaleDateString("fr-FR");
}

function setupReferenceDatalist(inputId, alias) {
  const input = $(inputId);
  if (!input) return;
  const catalog = catalogForAlias(alias);
  const old = document.getElementById(`${inputId}_list`);
  if (old) old.remove();
  input.removeAttribute("list");
  if (!catalog?.items?.length) return;
  const list = document.createElement("datalist");
  list.id = `${inputId}_list`;
  catalog.items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.label;
    list.appendChild(option);
  });
  document.body.appendChild(list);
  input.setAttribute("list", list.id);
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
      const nom = cleanDimensionValue(getFirstValue(row, ["Nom", "nom"]));
      const nomLong = cleanDimensionValue(getFirstValue(row, ["Nom_Long", "Nom Long", "nom_long"]));
      const community = cleanDimensionValue(getFirstValue(row, ["Communauté Nationale", "Communaute_Nationale", "Communauté_Nationale", "Communaute Nationale"]));
      const department = cleanDimensionValue(getFirstValue(row, ["Département", "Departement"]));
      const deploymentPriority = cleanDimensionValue(getFirstValue(row, ["Priorité Déploiement", "Priorite_Deploiement", "Priorité de déploiement", "Priorite_de_deploiement"]));
      const matrixProgress = cleanDimensionValue(getFirstValue(row, ["Avancement Matrice de déploiement", "Avancement_Matrice_de_deploiement"]));
      const deploymentStatus = cleanDimensionValue(getFirstValue(row, ["Statut Déploiement", "Statut_Deploiement", "Statut de déploiement", "Statut_de_deploiement", "Avancement Déploiement", "Avancement_Deploiement"])) || matrixProgress;
      const label = nom || nomLong || `Service #${row.id}`;
      return {
        id: Number(row.id),
        nom,
        nomLong,
        label,
        community,
        department,
        deploymentPriority,
        deploymentStatus
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

function listValues(value) {
  if (!Array.isArray(value)) return [value];
  return value[0] === "L" ? value.slice(1) : value;
}

function serviceLabel(value) {
  if (value === null || value === undefined || value === "" || value === 0 || value === "0") return "";
  if (typeof value === "number") return serviceById.get(Number(value))?.label || `Service #${value}`;
  if (Array.isArray(value)) return listValues(value).map(serviceLabel).filter(Boolean).join(", ");

  const text = String(value);
  const maybeId = Number(text);
  if (Number.isInteger(maybeId) && serviceById.has(maybeId)) {
    return serviceById.get(maybeId).label;
  }
  return text;
}

function rawServiceId(value) {
  if (value === null || value === undefined || value === "" || value === 0 || value === "0") return "";
  if (typeof value === "number") return Number(value);
  const text = String(value);
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
  if (!value) return serializeMappedValue("ServiceUtilisateur", "");
  const service = serviceById.get(Number(value));
  const metaType = fieldMeta("ServiceUtilisateur").type || "Any";
  if (metaType.startsWith("RefList:")) return ["L", Number(value)];
  if (metaType.startsWith("Ref:")) return Number(value);
  return service?.label || value;
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

function cleanDimensionValue(value) {
  const text = asText(value).trim();
  return text === "0" ? "" : text;
}

function updateRefreshLabel(message = "") {
  const node = $("lastRefresh");
  if (!node) return;
  if (message) {
    node.textContent = message;
    return;
  }
  node.textContent = `Actualisé à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function dateToISO(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) {
    if (["D", "DT"].includes(value[0])) return dateToISO(value[1]);
    return dateToISO(asText(value));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 100000000000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text || normalizeKey(text) === "apreciser") return "";
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const french = text.match(/^\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\s*$/);
  if (french) {
    const day = String(Number(french[1])).padStart(2, "0");
    const month = String(Number(french[2])).padStart(2, "0");
    let year = french[3] ? Number(french[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const candidate = `${year}-${month}-${day}`;
    const parsed = new Date(`${candidate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? "" : candidate;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10);
}

function formatDate(value) {
  const iso = dateToISO(value);
  if (!iso) return asText(value).trim();
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

function canonicalStatus(value) {
  const key = normalizeKey(value);
  const byKey = new Map(STATUSES.map(status => [normalizeKey(status), status]));
  return byKey.get(key) || "Nouveau";
}

function normalizeRecord(r) {
  const statusLabel = displayMappedValue("Status", r.Status);
  return {
    id: r.id,
    TitleRaw: r.Title,
    Title: displayMappedValue("Title", r.Title),
    ServiceUtilisateurRaw: r.ServiceUtilisateur,
    ServiceUtilisateur: serviceLabel(r.ServiceUtilisateur) || displayMappedValue("ServiceUtilisateur", r.ServiceUtilisateur),
    CategoryRaw: r.Category,
    Category: displayMappedValue("Category", r.Category),
    CaseTypeRaw: r.CaseType,
    CaseType: displayMappedValue("CaseType", r.CaseType),
    DescriptionRaw: r.Description,
    Description: displayMappedValue("Description", r.Description),
    DesiredDateRaw: r.DesiredDate,
    DesiredDate: displayMappedValue("DesiredDate", r.DesiredDate),
    PriorityRaw: r.Priority,
    Priority: displayMappedValue("Priority", r.Priority),
    ModifiedAtRaw: r.ModifiedAt,
    ModifiedAt: displayMappedValue("ModifiedAt", r.ModifiedAt),
    StatusRaw: r.Status,
    Status: canonicalStatus(statusLabel),
    AssigneesRaw: r.Assignees,
    Assignees: displayMappedValue("Assignees", r.Assignees),
    CommentRaw: r.Comment,
    Comment: displayMappedValue("Comment", r.Comment),
    TargetRaw: r.Target,
    Target: displayMappedValue("Target", r.Target),
    RTURaw: r.RTU,
    RTU: displayMappedValue("RTU", r.RTU),
    CreatedByRaw: r.CreatedBy,
    CreatedBy: displayMappedValue("CreatedBy", r.CreatedBy),
    CreatedAtRaw: r.CreatedAt,
    CreatedAt: displayMappedValue("CreatedAt", r.CreatedAt),
    RequesterRaw: r.Requester,
    Requester: displayMappedValue("Requester", r.Requester)
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

function trackingDate(record) {
  return dateToISO(record.Target) ? record.Target : record.DesiredDate;
}

function trackingDateLabel(record) {
  if (asText(record.Target).trim()) return { prefix: "Cible", value: record.Target };
  if (asText(record.DesiredDate).trim()) return { prefix: "Souhaitée", value: record.DesiredDate };
  return { prefix: "", value: "" };
}

function isOverdue(value, status) {
  if (!value || status === "Terminé") return false;
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
      const v = cleanDimensionValue(r[field]);
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

function serviceTokens(raw) {
  if (raw === null || raw === undefined || raw === "") return [];
  if (typeof raw === "number") return [String(raw), normalizeKey(serviceLabel(raw))];
  if (Array.isArray(raw)) return listValues(raw).flatMap(serviceTokens);
  return String(raw).split(/[,;\n|]+/).map(token => normalizeKey(token.trim())).filter(Boolean);
}

function rawIsCommonService(raw) {
  return serviceTokens(raw).some(token => ["tous", "toutes", "all"].includes(token));
}

function rawAppliesToService(raw, service) {
  if (!service) return true;
  const tokens = serviceTokens(raw);
  if (tokens.some(token => ["tous", "toutes", "all"].includes(token))) return true;
  const keys = new Set([
    String(service.id),
    normalizeKey(service.label),
    normalizeKey(service.nom),
    normalizeKey(service.nomLong)
  ].filter(Boolean));
  return tokens.some(token => keys.has(token));
}

function serviceMatchesDimensionFilters(service) {
  if (state.community && service.community !== state.community) return false;
  if (state.department && service.department !== state.department) return false;
  if (state.deploymentStatus && service.deploymentStatus !== state.deploymentStatus) return false;
  if (state.deploymentPriority && service.deploymentPriority !== state.deploymentPriority) return false;
  return true;
}

function selectedService() {
  return state.serviceId ? serviceById.get(Number(state.serviceId)) || null : null;
}

function recordMatchesServiceScope(record) {
  const selected = selectedService();
  if (selected) return serviceMatchesDimensionFilters(selected) && rawAppliesToService(record.ServiceUtilisateurRaw, selected);

  const hasDimensions = Boolean(state.community || state.department || state.deploymentStatus || state.deploymentPriority);
  if (!hasDimensions) return true;
  if (rawIsCommonService(record.ServiceUtilisateurRaw)) return true;
  return services.some(service => serviceMatchesDimensionFilters(service) && rawAppliesToService(record.ServiceUtilisateurRaw, service));
}

function recordMatchesWorkFilters(record) {
  const query = normalizeKey(state.search);
  if (query) {
    const haystack = normalizeKey([
      titleFor(record), record.ServiceUtilisateur, record.Category, record.CaseType,
      record.Description, record.Priority, asText(record.Assignees), record.Comment,
      record.RTU, record.Target, record.Requester
    ].join(" "));
    if (!haystack.includes(query)) return false;
  }
  if (state.category && record.Category !== state.category) return false;
  if (state.caseType && record.CaseType !== state.caseType) return false;
  if (state.priority && record.Priority !== state.priority) return false;
  if (state.assignee && !asArray(record.Assignees).includes(state.assignee)) return false;
  return true;
}

function recordsForCurrentServiceScope() {
  return allRecords.filter(recordMatchesServiceScope);
}

function filteredRecords() {
  return allRecords.filter(record => recordMatchesServiceScope(record) && recordMatchesWorkFilters(record));
}

function availableServicesForPicker() {
  let candidates = services.filter(serviceMatchesDimensionFilters);
  const hasWorkFilters = Boolean(state.search || state.category || state.caseType || state.priority || state.assignee);
  if (hasWorkFilters) {
    candidates = candidates.filter(service => allRecords.some(record => rawAppliesToService(record.ServiceUtilisateurRaw, service) && recordMatchesWorkFilters(record)));
  }
  return candidates;
}

function refreshDimensionOptions() {
  setSelectOptions("communityFilter", uniqueValues(services, "community"), "Toutes les communautés");
  setSelectOptions("departmentFilter", uniqueValues(services, "department"), "Tous les départements");
  setSelectOptions("deploymentStatusFilter", uniqueValues(services, "deploymentStatus"), "Tous les statuts");
  setSelectOptions("deploymentPriorityFilter", uniqueValues(services, "deploymentPriority"), "Toutes les priorités");
}

function refreshWorkFilterOptions() {
  const scoped = recordsForCurrentServiceScope();
  setSelectOptions("categoryFilter", uniqueValues(scoped, "Category"), "Toutes les catégories");
  setSelectOptions("caseFilter", uniqueValues(scoped, "CaseType"), "Tous les cas");
  setSelectOptions("priorityFilter", uniqueValues(scoped, "Priority"), "Toutes les priorités");
  setSelectOptions("assigneeFilter", uniqueValues(scoped, "Assignees", true), "Toutes les personnes assignées");
}

function refreshFilterOptions() {
  refreshDimensionOptions();
  refreshWorkFilterOptions();
}

function serviceMeta(service) {
  return [service.community, service.department].filter(Boolean).join(" · ");
}

function renderServiceDropdown() {
  const dropdown = $("serviceDropdown");
  if (!dropdown) return;
  const input = $("serviceSearch");
  const query = normalizeKey(input.value);
  let candidates = availableServicesForPicker();
  if (query && !state.serviceId) {
    candidates = candidates.filter(service => normalizeKey([service.label, service.nomLong, service.community, service.department].join(" ")).includes(query));
  }
  candidates = candidates.slice(0, 100);
  dropdown.replaceChildren();
  serviceComboIndex = -1;

  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "combo-empty";
    empty.textContent = "Aucun service correspondant";
    dropdown.appendChild(empty);
  } else {
    candidates.forEach(service => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "combo-item";
      button.dataset.serviceId = String(service.id);
      const name = document.createElement("span");
      name.className = "combo-item__name";
      name.textContent = service.label;
      const meta = document.createElement("span");
      meta.className = "combo-item__meta";
      meta.textContent = serviceMeta(service);
      button.append(name, meta);
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => selectService(service.id));
      dropdown.appendChild(button);
    });
  }
  dropdown.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
}

function closeServiceDropdown() {
  $("serviceDropdown")?.classList.add("hidden");
  $("serviceSearch")?.setAttribute("aria-expanded", "false");
  serviceComboIndex = -1;
}

function selectService(serviceId) {
  const service = serviceById.get(Number(serviceId));
  state.serviceId = service ? Number(service.id) : null;
  $("serviceSearch").value = service?.label || "";
  $("clearServiceBtn").classList.toggle("hidden", !service);
  closeServiceDropdown();
  refreshWorkFilterOptions();
  renderBoard();
}

function clearSelectedService() {
  state.serviceId = null;
  $("serviceSearch").value = "";
  $("clearServiceBtn").classList.add("hidden");
  closeServiceDropdown();
  refreshWorkFilterOptions();
  renderBoard();
}

function updateSelectedServiceValidity() {
  const service = selectedService();
  if (service && !serviceMatchesDimensionFilters(service)) clearSelectedService();
}

function sortRecords(records) {
  const copy = [...records];
  copy.sort((a, b) => {
    if (state.sort === "priority") {
      return (PRIORITY_RANK[a.Priority] ?? 99) - (PRIORITY_RANK[b.Priority] ?? 99)
        || compareDateAsc(trackingDate(a), trackingDate(b))
        || titleFor(a).localeCompare(titleFor(b), "fr");
    }
    if (state.sort === "due") return compareDateAsc(trackingDate(a), trackingDate(b));
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
  const active = records.filter(record => record.Status !== "Terminé");
  const p0p1 = active.filter(record => ["P0", "P1"].includes(record.Priority)).length;
  const overdue = active.filter(record => isOverdue(trackingDate(record), record.Status)).length;

  const items = [
    ["Sujets en cours", active.length, "kpi--info"],
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
    const title = makeEl("div", "lane__title", status);
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
  const tracked = trackingDateLabel(record);
  const date = formatDate(tracked.value);
  const dateText = date ? `${tracked.prefix} ${date}` : "Sans date cible";
  const dateNode = makeEl("span", `card__date ${isOverdue(trackingDate(record), record.Status) ? "overdue" : ""}`.trim(), dateText);
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
    await updateRecord(id, { Status: serializeMappedValue("Status", newStatus), ModifiedAt: timestampForAlias("ModifiedAt") });
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
  setValue("fDueDate", record?.DesiredDate || "");
  setValue("fTarget", record?.Target || "");
  setValue("fAssignees", record?.Assignees || "");
  setValue("fRequester", record?.Requester || "");
  setValue("fCreatedBy", record?.CreatedBy || "");
  setValue("fDescription", record?.Description || "");
  setValue("fComment", record?.Comment || "");

  [
    ["fTitle", "Title"], ["fCategory", "Category"], ["fRTU", "RTU"],
    ["fAssignees", "Assignees"], ["fRequester", "Requester"], ["fCreatedBy", "CreatedBy"]
  ].forEach(([inputId, alias]) => setupReferenceDatalist(inputId, alias));

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
  const now = timestampForAlias("ModifiedAt");

  try {
    const fields = {
      Title: serializeMappedValue("Title", getValue("fTitle")),
      ServiceUtilisateur: serviceValueForSave(),
      Category: serializeMappedValue("Category", getValue("fCategory")),
      CaseType: serializeMappedValue("CaseType", getValue("fCase")),
      RTU: serializeMappedValue("RTU", getValue("fRTU")),
      Status: serializeMappedValue("Status", getValue("fStatus") || "Nouveau"),
      Priority: serializeMappedValue("Priority", getValue("fPriority")),
      DesiredDate: serializeMappedValue("DesiredDate", getValue("fDueDate")),
      Target: serializeMappedValue("Target", getValue("fTarget")),
      Assignees: serializeMappedValue("Assignees", getValue("fAssignees")),
      Requester: serializeMappedValue("Requester", getValue("fRequester")),
      CreatedBy: serializeMappedValue("CreatedBy", getValue("fCreatedBy")),
      Description: serializeMappedValue("Description", getValue("fDescription")),
      Comment: serializeMappedValue("Comment", getValue("fComment")),
      ModifiedAt: now
    };

    if (currentRecordId) {
      await updateRecord(currentRecordId, fields);
      showToast("Carte mise à jour");
    } else {
      fields.CreatedAt = timestampForAlias("CreatedAt");
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
    state.filtersHidden = !state.filtersHidden;
    $("filtersPanel").classList.toggle("filters-hidden", state.filtersHidden);
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

  $("serviceSearch").addEventListener("focus", renderServiceDropdown);
  $("serviceSearch").addEventListener("click", renderServiceDropdown);
  $("serviceSearch").addEventListener("input", event => {
    const selected = selectedService();
    if (selected && event.target.value !== selected.label) {
      state.serviceId = null;
      $("clearServiceBtn").classList.add("hidden");
      refreshWorkFilterOptions();
      renderBoard();
    }
    renderServiceDropdown();
  });
  $("serviceSearch").addEventListener("keydown", event => {
    const items = [...$("serviceDropdown").querySelectorAll(".combo-item")];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!items.length) return;
      serviceComboIndex = event.key === "ArrowDown"
        ? Math.min(serviceComboIndex + 1, items.length - 1)
        : Math.max(serviceComboIndex - 1, 0);
      items.forEach((item, index) => item.classList.toggle("is-active", index === serviceComboIndex));
      items[serviceComboIndex]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && serviceComboIndex >= 0) {
      event.preventDefault();
      selectService(Number(items[serviceComboIndex].dataset.serviceId));
    } else if (event.key === "Escape") {
      closeServiceDropdown();
    }
  });
  $("clearServiceBtn").addEventListener("click", clearSelectedService);

  [
    ["communityFilter", "community"],
    ["departmentFilter", "department"],
    ["deploymentStatusFilter", "deploymentStatus"],
    ["deploymentPriorityFilter", "deploymentPriority"]
  ].forEach(([id, key]) => {
    $(id).addEventListener("change", event => {
      state[key] = event.target.value;
      updateSelectedServiceValidity();
      refreshWorkFilterOptions();
      renderServiceDropdown();
      closeServiceDropdown();
      renderBoard();
    });
  });

  $("searchInput").addEventListener("input", event => {
    state.search = event.target.value;
    renderServiceDropdown();
    closeServiceDropdown();
    renderBoard();
  });
  $("sortSelect").addEventListener("change", event => {
    state.sort = event.target.value;
    renderBoard();
  });
  $("categoryFilter").addEventListener("change", event => {
    state.category = event.target.value;
    renderServiceDropdown();
    closeServiceDropdown();
    renderBoard();
  });
  $("caseFilter").addEventListener("change", event => {
    state.caseType = event.target.value;
    renderServiceDropdown();
    closeServiceDropdown();
    renderBoard();
  });
  $("priorityFilter").addEventListener("change", event => {
    state.priority = event.target.value;
    renderServiceDropdown();
    closeServiceDropdown();
    renderBoard();
  });
  $("assigneeFilter").addEventListener("change", event => {
    state.assignee = event.target.value;
    renderServiceDropdown();
    closeServiceDropdown();
    renderBoard();
  });

  document.addEventListener("click", event => {
    if (!$("servicePicker").contains(event.target)) closeServiceDropdown();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeServiceDropdown();
      closeDrawer();
    }
  });
}

bindEvents();

grist.onRecords(async (data, mappings) => {
  const mapped = grist.mapColumnNames(data);
  if (!mapped) {
    updateRefreshLabel("Configuration requise");
    renderMappingMessage();
    return;
  }

  await Promise.all([
    loadServicesReference(),
    loadMappedMetadata(mappings || {})
  ]);

  allRecords = normalizeIncoming(mapped).map(normalizeRecord).filter(r => r.id !== undefined && r.id !== null);
  refreshFilterOptions();
  const selected = selectedService();
  if (selected) {
    $("serviceSearch").value = selected.label;
    $("clearServiceBtn").classList.remove("hidden");
  }
  renderBoard();
  updateRefreshLabel();

  if (servicesLoadError) {
    console.warn(servicesLoadError);
  }
});

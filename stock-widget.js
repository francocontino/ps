const allProducts = window.STOCK_DB?.products ?? [];

if (!allProducts.length) {
  throw new Error("No se pudo cargar la base de stock (window.STOCK_DB.products).");
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  search: $("#search"),
  searchClear: $("#searchClear"),
quickFilters: $("#quickFilters"),
modelFilters: $("#modelFilters"),
activeFilters: $("#activeFilters"),
  products: $("#products"),
  resultCount: $("#resultCount"),
  sortTrigger: $("#sortTrigger"),
  catalogStatus: $("#catalogStatus"),
  openAdmin: $("#openAdmin"),
  adminSheet: $("#adminSheet"),
  adminProfit: $("#adminProfit"),
  adminShowPrice: $("#adminShowPrice"),
  adminShowUnits: $("#adminShowUnits"),
  saveAdmin: $("#saveAdmin"),
  downloadVariables: $("#downloadVariables"),

  openFilters: $("#openFilters"),
  filtersSheet: $("#filtersSheet"),
  filterPreviewCount: $("#filterPreviewCount"),
  applyFilters: $("#applyFilters"),
  clearFilters: $("#clearFilters"),
  deviceType: $("#deviceType"),
  brand: $("#brand"),
  model: $("#model"),
  storage: $("#storage"),
  ram: $("#ram"),
  chip: $("#chip"),
  color: $("#color"),
  sort: $("#sort"),

  variantSheet: $("#variantSheet"),
  variantSheetTitle: $("#variantSheetTitle"),
  variantSheetSubtitle: $("#variantSheetSubtitle"),
  variantList: $("#variantList"),

  compareBar: $("#compareBar"),
  compareBarTitle: $("#compareBarTitle"),
  compareBarSubtitle: $("#compareBarSubtitle"),
  openCompare: $("#openCompare"),
  compareSheet: $("#compareSheet"),
  compareSheetSubtitle: $("#compareSheetSubtitle"),
  compareBody: $("#compareBody"),
  clearCompare: $("#clearCompare"),
  copyCompare: $("#copyCompare"),
  compareBadge: $("#compareBadge"),

  orderBar: $("#orderBar"),
  orderBarTitle: $("#orderBarTitle"),
  orderBarSubtitle: $("#orderBarSubtitle"),
  openOrder: $("#openOrder"),
  orderSheet: $("#orderSheet"),
  orderSheetSubtitle: $("#orderSheetSubtitle"),
  selected: $("#selected"),
  total: $("#total"),
  clearOrder: $("#clearOrder"),
  copyOrder: $("#copyOrder"),
  orderBadge: $("#orderBadge"),

  navSearch: $("#navSearch"),
  navCompare: $("#navCompare"),
  navOrder: $("#navOrder"),
  navFilters: $("#navFilters"),

  sheetBackdrop: $("#sheetBackdrop"),
  toast: $("#toast"),
};

const FILTER_KEYS = ["deviceType", "brand", "model", "storage", "ram", "chip", "color"];
const selectedItems = new Map();
const selectedColors = new Map();

const PRICE_VARIABLES_FILE = "./variable_precios.md";
const ADMIN_STORAGE_KEY = "prime-store-price-settings";
const basePrices = new WeakMap();
let appliedProfitPercentage = 0;
const priceSettings = {
  showPrice: true,
  showAvailableUnits: true,
};

function parseProfitPercentage(text) {
  const match = String(text).match(/^\s*\[ganancia\]\s*(?::|=|-)?\s*(?:USD\s*)?(-?\d+(?:[.,]\d+)?)\s*$/im);
  if (!match) throw new Error("No se encontró un valor válido para [ganancia].");

  const percentage = Number(match[1].replace(",", "."));
  if (!Number.isFinite(percentage)) throw new Error("El valor de [ganancia] no es numérico.");
  return percentage;
}

function parseYesNoVariable(text, key, defaultValue = true) {
  const match = String(text).match(new RegExp(`^\\s*\\[${key}\\]\\s*(?::|=|-)\\s*([SN])\\s*$`, "im"));
  return match ? match[1].toUpperCase() === "S" : defaultValue;
}

function addProfitToCatalog(percentage) {
  const adjusted = (owner, value) => {
    if (value == null || value === "") return value;
    const price = Number(value);
    if (!Number.isFinite(price)) return value;
    if (!basePrices.has(owner)) basePrices.set(owner, price / (1 + appliedProfitPercentage / 100));
    return basePrices.get(owner) * (1 + percentage / 100);
  };

  for (const product of allProducts) {
    product.priceUsd = adjusted(product, product.priceUsd);
    if (Array.isArray(product.pricesUsd)) {
      const factor = (1 + percentage / 100) / (1 + appliedProfitPercentage / 100);
      product.pricesUsd = product.pricesUsd.map((value) => Number.isFinite(Number(value)) ? Number(value) * factor : value);
    }
    if (Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        variant.priceUsd = adjusted(variant, variant.priceUsd);
      }
    }
  }
  appliedProfitPercentage = percentage;
}

function readAdminOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY));
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function applyPriceSettings(settings, { persist = false } = {}) {
  const percentage = Number(settings.percentage);
  if (!Number.isFinite(percentage) || percentage <= -100) throw new Error("Ingresá un porcentaje mayor a -100.");

  addProfitToCatalog(percentage);
  priceSettings.showPrice = Boolean(settings.showPrice);
  priceSettings.showAvailableUnits = Boolean(settings.showAvailableUnits);
  document.body.classList.toggle("hide-sale-prices", !priceSettings.showPrice);

  for (const item of selectedItems.values()) {
    const product = allProducts.find((candidate) => candidate.id === item.id);
    const variant = product ? getVariants(product).find((candidate) => candidate.color === item.selectedColor) : null;
    if (variant) item.priceUsd = Number(variant.priceUsd ?? 0);
  }

  if (persist) localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ percentage, showPrice: priceSettings.showPrice, showAvailableUnits: priceSettings.showAvailableUnits }));
}

function variablesFileContent() {
  return `# Variables de precios\n\n[ganancia]: ${appliedProfitPercentage}\n[mostrar_precio]: ${priceSettings.showPrice ? "S" : "N"}\n[mostrar_uds_dispo]: ${priceSettings.showAvailableUnits ? "S" : "N"}\n`;
}

async function loadPriceVariables() {
  const separator = PRICE_VARIABLES_FILE.includes("?") ? "&" : "?";
  const response = await fetch(`${PRICE_VARIABLES_FILE}${separator}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo leer ${PRICE_VARIABLES_FILE} (${response.status}).`);
  const variables = await response.text();
  const fileSettings = {
    percentage: parseProfitPercentage(variables),
    showPrice: parseYesNoVariable(variables, "mostrar_precio"),
    showAvailableUnits: parseYesNoVariable(variables, "mostrar_uds_dispo"),
  };
  applyPriceSettings({ ...fileSettings, ...readAdminOverrides() });
}

const state = {
  quickGroup: "all",
  compareIds: [],
  activeSheet: null,
  variantProductId: null,
  toastTimer: null,
};

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
})[char]);

const unique = (values) => [...new Set(values.filter((value) => value != null && value !== ""))];
const naturalSort = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
const memoryLabel = (gb) => gb == null ? "" : Number(gb) >= 1024 ? `${Number(gb) / 1024} TB` : `${Number(gb)} GB`;
const toArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];

function formatMoney(value) {
  const numeric = Number(value ?? 0);
  return money.format(Number.isFinite(numeric) ? numeric : 0).replace("US$", "US$");
}

function getModelFamily(product) {
  const model = String(product.model ?? "").trim();
  const brand = normalize(product.brand);
  const deviceType = normalize(product.deviceType);

  const patterns = [
    [/^(\d+E?)\b/i, (match) => brand === "apple" && deviceType === "smartphone" ? `iPhone ${match[1].toUpperCase()}` : match[1].toUpperCase()],
    [/^(NOTE\s+\d+[A-Z]?|REDMI\s+\d+[A-Z]?|POCO\s+[A-Z]\d+)\b/i, (match) => match[1].toUpperCase()],
    [/^(S\d+|A\d+|Z\s+(?:FOLD|FLIP)\s*\d*|G\d+|EDGE\s+\d+)\b/i, (match) => match[1].toUpperCase().replace(/\s+/g, " ")],
    [/^(IPAD(?:\s+AIR|\s+PRO)?|AIRPODS(?:\s+PRO|\s+MAX)?|APPLE WATCH(?:\s+SERIES|\s+SE|\s+ULTRA)?|MACBOOK(?:\s+AIR|\s+PRO|\s+NEO)?|MAC MINI)\b/i, (match) => match[1].replace(/\b\w/g, (char) => char.toUpperCase())],
  ];

  for (const [pattern, format] of patterns) {
    const match = model.match(pattern);
    if (match) return format(match);
  }

  return model;
}

function getVariants(product) {
  const rawVariants = Array.isArray(product.variants) ? product.variants : [];
  const colors = unique([
    ...(product.colors ?? []),
    ...rawVariants.map((variant) => variant?.color).filter(Boolean),
  ]);

  if (!colors.length) {
    return [{
      color: "Standard",
      priceUsd: Number(product.priceUsd ?? getLowestVariantPrice(product) ?? 0),
      raw: rawVariants[0] ?? product,
    }];
  }

  return colors.map((color) => {
    const raw = rawVariants.find((variant) => normalize(variant?.color) === normalize(color)) ?? null;
    return {
      color,
      priceUsd: Number(raw?.priceUsd ?? product.priceUsd ?? getLowestVariantPrice(product) ?? 0),
      raw: raw ?? product,
    };
  });
}

function getLowestVariantPrice(product) {
  const prices = (product.variants ?? [])
    .map((variant) => Number(variant?.priceUsd))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (prices.length) return Math.min(...prices);
  const direct = Number(product.priceUsd);
  return Number.isFinite(direct) ? direct : 0;
}

function getSelectedVariant(product) {
  const variants = getVariants(product);
  const requestedColor = selectedColors.get(product.id);
  const selected = variants.find((variant) => variant.color === requestedColor) ?? variants[0];
  if (selected) selectedColors.set(product.id, selected.color);
  return selected;
}

function numericStock(source) {
  if (!source || typeof source !== "object") return null;
  const keys = ["stockQuantity", "availableQuantity", "quantity", "stockQty", "units", "stock"];

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Math.max(0, Number(value));
  }

  return null;
}

function getAvailability(product, variant = getSelectedVariant(product)) {
  const raw = variant?.raw ?? product;
  const quantity = numericStock(raw) ?? numericStock(product);
  const explicitlyOut = raw?.inStock === false || raw?.available === false || product?.inStock === false || product?.available === false;

  if (explicitlyOut || quantity === 0) {
    return { quantity: 0, label: "Sin stock", className: "is-out", available: false };
  }

  if (quantity != null) {
    if (!priceSettings.showAvailableUnits) {
      return { quantity, label: "Disponible", className: "", available: true };
    }
    if (quantity === 1) return { quantity, label: "1 disponible", className: "is-low", available: true };
    if (quantity <= 3) return { quantity, label: `${quantity} disponibles`, className: "is-low", available: true };
    return { quantity, label: `${quantity} disponibles`, className: "", available: true };
  }

  return { quantity: null, label: "Disponible", className: "", available: true };
}

function getSelectedPrice(product) {
  const variant = getSelectedVariant(product);
  const price = Number(variant?.priceUsd ?? getLowestVariantPrice(product) ?? 0);
  return Number.isFinite(price) ? price : 0;
}

function getSimLabel(product) {
  const source = [
    ...toArray(product.connectivity),
    product.description,
    product.raw,
  ].filter(Boolean).join(" ");
  const normalizedSource = normalize(source);
  const hasEsim = /\besim\b/.test(normalizedSource);
  const hasPhysicalSim = /physical\s+sim|sim\s+fisica/.test(normalizedSource);

  if (hasEsim && hasPhysicalSim) return "SIM física + eSIM";
  if (/\bdual\s+sim\b/.test(normalizedSource)) return "Dual SIM";
  if (hasEsim) return "eSIM";
  if (hasPhysicalSim || /\bsim\b/.test(normalizedSource)) return "SIM física";
  return "";
}

function humanType(value) {
  const map = {
    smartphone: "Smartphone",
    notebook: "Notebook",
    laptop: "Notebook",
    tablet: "Tablet",
    smartwatch: "Smartwatch",
    watch: "Smartwatch",
    headphones: "Audio",
  };
  return map[normalize(value)] ?? String(value ?? "Producto");
}

function colorToCss(color) {
  const value = normalize(color);
  const rules = [
    [["black", "negro", "midnight", "graphite", "space black"], "#343238"],
    [["white", "blanco", "starlight"], "#eeeae5"],
    [["silver", "plata"], "#c7c9cb"],
    [["gray", "grey", "gris", "titanium gray", "natural titanium", "natural"], "#b7aea3"],
    [["gold", "dorado", "desert", "desert titanium"], "#b89373"],
    [["blue", "azul", "ultramarine"], "#6c8fb5"],
    [["purple", "violet", "violeta"], "#88709a"],
    [["green", "verde"], "#75897a"],
    [["pink", "rosa"], "#d7a6b5"],
    [["red", "rojo"], "#b85a5a"],
    [["yellow", "amarillo"], "#d9c56d"],
    [["orange", "naranja"], "#c9875d"],
  ];

  for (const [terms, css] of rules) {
    if (terms.some((term) => value.includes(term))) return css;
  }

  return "#d7d2d9";
}

function specsFor(product) {
  return [
    product.memory?.storageGb != null ? memoryLabel(product.memory.storageGb) : null,
    product.memory?.ramGb != null ? `${memoryLabel(product.memory.ramGb)} RAM` : null,
    product.chip || null,
    ...toArray(product.connectivity).filter((value) => !/\b(?:e?sim|physical sim)\b/i.test(value)),
  ].filter(Boolean);
}

function buildSearchQuery(value) {
  let query = normalize(value)
    .replace(/(\d+)\s*pm\b/g, "$1 pro max")
    .replace(/\bpm\b/g, "pro max")
    .replace(/pro\s*-?\s*max/g, "pro max")
    .replace(/promax/g, "pro max")
    .replace(/\bgb\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    raw: query,
    tokens: query.split(" ").filter(Boolean),
    compact: query.replace(/\s+/g, ""),
  };
}

function searchableText(product) {
  return normalize([
    product.brand,
    product.model,
    getModelFamily(product),
    product.deviceType,
    product.chip,
    product.memory?.storageGb,
    product.memory?.storageGb != null ? `${product.memory.storageGb}gb` : null,
    product.memory?.ramGb,
    product.memory?.ramGb != null ? `${product.memory.ramGb}gb ram` : null,
    ...toArray(product.connectivity),
    getSimLabel(product),
    ...(product.colors ?? []),
    ...(product.variants ?? []).map((variant) => variant?.color),
  ].filter(Boolean).join(" "));
}

function queryMatches(product) {
  const query = buildSearchQuery(ui.search.value);
  if (!query.tokens.length) return true;

  const text = searchableText(product);
  const compactText = text.replace(/\s+/g, "");
  return query.tokens.every((token) => text.includes(token) || compactText.includes(token));
}

function searchScore(product) {
  const query = buildSearchQuery(ui.search.value);
  if (!query.tokens.length) return 0;

  const model = normalize(product.model);
  const family = normalize(getModelFamily(product));
  const text = searchableText(product);
  let score = 0;

  if (model.includes(query.raw)) score += 80;
  if (family.includes(query.raw)) score += 60;
  if (text.includes(query.raw)) score += 35;

  for (const token of query.tokens) {
    if (model.includes(token)) score += 14;
    else if (family.includes(token)) score += 10;
    else if (text.includes(token)) score += 4;
  }

  return score;
}

const quickGroups = [
  { id: "all", label: "Todos", match: () => true },
  { id: "iphone", label: "iPhone", match: (product) => normalize(product.brand) === "apple" && (normalize(product.deviceType) === "smartphone" || normalize(product.model).includes("iphone") || /^\d+e?\b/.test(normalize(product.model))) },
  { id: "mac", label: "Mac", match: (product) => /macbook|mac mini|imac|mac studio|mac pro/.test(normalize(product.model)) },
  { id: "ipad", label: "iPad", match: (product) => normalize(product.model).includes("ipad") },
  { id: "watch", label: "Watch", match: (product) => normalize(product.model).includes("watch") },
  { id: "samsung", label: "Samsung", match: (product) => normalize(product.brand) === "samsung" },
  { id: "notebook", label: "Notebooks", match: (product) => ["notebook", "laptop"].includes(normalize(product.deviceType)) },
];

function currentQuickGroup() {
  return quickGroups.find((group) => group.id === state.quickGroup) ?? quickGroups[0];
}

function productMatchesQuickGroup(product) {
  return currentQuickGroup().match(product);
}

function selectedFilters(except = null) {
  return {
    deviceType: except === "deviceType" ? "" : ui.deviceType.value,
    brand: except === "brand" ? "" : ui.brand.value,
    model: except === "model" ? "" : ui.model.value,
    storage: except === "storage" ? "" : ui.storage.value,
    ram: except === "ram" ? "" : ui.ram.value,
    chip: except === "chip" ? "" : ui.chip.value,
    color: except === "color" ? "" : ui.color.value,
  };
}

function productMatchesFilters(product, filters, { includeQuery = true, includeQuick = true } = {}) {
  const matches = (
    (!filters.deviceType || product.deviceType === filters.deviceType) &&
    (!filters.brand || product.brand === filters.brand) &&
    (!filters.model || getModelFamily(product) === filters.model) &&
    (!filters.storage || Number(product.memory?.storageGb) === Number(filters.storage)) &&
    (!filters.ram || Number(product.memory?.ramGb) === Number(filters.ram)) &&
    (!filters.chip || product.chip === filters.chip) &&
    (!filters.color || getVariants(product).some((variant) => variant.color === filters.color))
  );

  if (!matches) return false;
  if (includeQuick && !productMatchesQuickGroup(product)) return false;
  if (includeQuery && !queryMatches(product)) return false;
  return true;
}

function getFilterValues(key, products) {
  return unique(products.flatMap((product) => {
    if (key === "deviceType") return product.deviceType ? [product.deviceType] : [];
    if (key === "brand") return product.brand ? [product.brand] : [];
    if (key === "model") return product.model ? [getModelFamily(product)] : [];
    if (key === "storage") return product.memory?.storageGb != null ? [product.memory.storageGb] : [];
    if (key === "ram") return product.memory?.ramGb != null ? [product.memory.ramGb] : [];
    if (key === "chip") return product.chip ? [product.chip] : [];
    if (key === "color") return getVariants(product).map((variant) => variant.color);
    return [];
  }));
}

function fillSelect(element, values, label, formatter = (value) => value) {
  if (!element) return;

  const current = element.value;
  const list = unique(values).sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return naturalSort(a, b);
  });

  element.innerHTML = [
    `<option value="">${escapeHtml(label)}</option>`,
    ...list.map((value) => `<option value="${escapeHtml(String(value))}">${escapeHtml(formatter(value))}</option>`),
  ].join("");

  element.value = list.map(String).includes(String(current)) ? current : "";
}

function refreshFilterOptions() {
  const labels = {
    deviceType: "Todos",
    brand: "Todas",
    model: "Todos",
    storage: "Todos",
    ram: "Toda",
    chip: "Todos",
    color: "Todos",
  };

  const formatters = {
    storage: memoryLabel,
    ram: memoryLabel,
    deviceType: humanType,
  };

  for (const key of FILTER_KEYS) {
    const candidates = allProducts.filter((product) => productMatchesFilters(product, selectedFilters(key), {
      includeQuery: true,
      includeQuick: true,
    }));
    fillSelect(ui[key], getFilterValues(key, candidates), labels[key], formatters[key] ?? ((value) => value));
  }
}

function visibleProducts() {
  const filtered = allProducts.filter((product) => productMatchesFilters(product, selectedFilters()));

  if (ui.sort.value === "price-asc") {
    return [...filtered].sort((a, b) => getSelectedPrice(a) - getSelectedPrice(b));
  }

  if (ui.sort.value === "price-desc") {
    return [...filtered].sort((a, b) => getSelectedPrice(b) - getSelectedPrice(a));
  }

  const query = buildSearchQuery(ui.search.value);
  return [...filtered].sort((a, b) => {
    if (query.tokens.length) {
      const scoreDiff = searchScore(b) - searchScore(a);
      if (scoreDiff) return scoreDiff;
    }
    return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "es", { numeric: true, sensitivity: "base" });
  });
}

function renderQuickFilters() {
  const availableGroups = quickGroups.filter((group) => group.id === "all" || allProducts.some(group.match));

  ui.quickFilters.innerHTML = availableGroups.map((group) => `
    <button class="chip ${state.quickGroup === group.id ? "is-active" : ""}" type="button" data-quick-group="${escapeHtml(group.id)}">
      ${escapeHtml(group.label)}
    </button>
  `).join("");
}

function renderModelFilters() {
  if (state.quickGroup === "all") {
    ui.modelFilters.innerHTML = "";
    return;
  }

  const models = unique(
    allProducts
      .filter((product) => productMatchesQuickGroup(product))
      .map((product) => getModelFamily(product))
      .filter(Boolean)
  ).sort(naturalSort);

  if (models.length <= 1) {
    ui.modelFilters.innerHTML = "";
    return;
  }

  ui.modelFilters.innerHTML = models.map((model) => `
    <button
      class="chip ${ui.model.value === model ? "is-active" : ""}"
      type="button"
      data-model-chip="${escapeHtml(model)}"
    >
      ${escapeHtml(model)}
    </button>
  `).join("");
}

function activeFilterEntries() {
  const filters = selectedFilters();
  const labels = {
    deviceType: humanType(filters.deviceType),
    brand: filters.brand,
    model: filters.model,
    storage: filters.storage ? memoryLabel(filters.storage) : "",
    ram: filters.ram ? `${memoryLabel(filters.ram)} RAM` : "",
    chip: filters.chip,
    color: filters.color,
  };

  return FILTER_KEYS
    .filter((key) => filters[key])
    .map((key) => ({ key, label: labels[key] }));
}

function renderActiveFilters() {
  ui.activeFilters.innerHTML = activeFilterEntries().map(({ key, label }) => `
    <button class="chip chip-filter" type="button" data-remove-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>
  `).join("");
}

function productCard(product) {
  const variant = getSelectedVariant(product);
  const availability = getAvailability(product, variant);
  const isCompared = state.compareIds.includes(product.id);
  const specs = specsFor(product).slice(0, 4);
  const variants = getVariants(product);
  const simLabel = getSimLabel(product);

  return `
    <article class="product ${isCompared ? "is-compared" : ""}" data-product-id="${escapeHtml(product.id)}">
      <div class="product-main">
        <div class="product-kicker">
          <span class="product-brand">${escapeHtml(product.brand)}</span>
          <span class="product-type">${escapeHtml(humanType(product.deviceType))}</span>
        </div>
        <h2>${escapeHtml(product.model)}</h2>
        <div class="product-specs">
          ${specs.length ? specs.map((spec) => `<span class="spec">${escapeHtml(spec)}</span>`).join("") : '<span class="spec">Configuración única</span>'}
        </div>
        ${simLabel ? `<div class="sim-info"><span class="sim-icon" aria-hidden="true">SIM</span><span>${escapeHtml(simLabel)}</span></div>` : ""}
      </div>

      <div class="card-variants" aria-label="Variantes de color">
        <span class="card-variants-title">${variants.length === 1 ? "Variante" : `${variants.length} variantes`}</span>
        <div class="card-variant-stack">
          ${variants.map((item) => {
            const itemAvailability = getAvailability(product, item);
            const isSelected = item.color === variant.color;
            return `
              <button
                class="card-variant-row ${isSelected ? "is-selected" : ""}"
                type="button"
                data-card-variant-product="${escapeHtml(product.id)}"
                data-card-variant-color="${escapeHtml(item.color)}"
                ${itemAvailability.available ? "" : "disabled"}
              >
                <span class="card-variant-swatch" style="--swatch:${colorToCss(item.color)}"></span>
                <span class="card-variant-info">
                  <strong>${escapeHtml(item.color)}</strong>
                  <span class="availability ${itemAvailability.className}">${escapeHtml(itemAvailability.label)}</span>
                </span>
                <span class="card-variant-price">${formatMoney(item.priceUsd)}</span>
                <span class="card-variant-check" aria-hidden="true">${isSelected ? "✓" : ""}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>

      <div class="product-actions">
        <button class="action-button ${isCompared ? "is-active" : ""}" type="button" data-compare="${escapeHtml(product.id)}">${isCompared ? "✓ Comparar" : "Comparar"}</button>
        <button class="action-button" type="button" data-copy-product="${escapeHtml(product.id)}">Copiar</button>
        <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" ${availability.available ? "" : "disabled"}>+ Pedido</button>
      </div>
    </article>
  `;
}

function renderProducts() {
  const products = visibleProducts();
  const query = ui.search.value.trim();
  const group = currentQuickGroup();
  const context = [query ? `“${query}”` : "", group.id !== "all" ? group.label : ""].filter(Boolean).join(" · ");

  ui.resultCount.textContent = `${products.length} ${products.length === 1 ? "resultado" : "resultados"}${context ? ` para ${context}` : ""}`;
  ui.filterPreviewCount.textContent = `${products.length} ${products.length === 1 ? "resultado" : "resultados"} con esta selección`;

  if (!products.length) {
    ui.products.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>No encontramos esa combinación.</strong>
          <p>Probá con menos palabras, otro color o quitando algún filtro.</p>
        </div>
      </div>
    `;
    return;
  }

  ui.products.innerHTML = products.map(productCard).join("");
}

function updateSortLabel() {
  const labels = {
    catalog: ui.search.value.trim() ? "Relevancia" : "Modelo",
    "price-asc": "Menor precio",
    "price-desc": "Mayor precio",
  };
  ui.sortTrigger.textContent = labels[ui.sort.value] ?? "Ordenar";
}

function renderCatalogStatus() {
  const source = window.STOCK_DB ?? {};
  const rawDate = source.updatedAt ?? source.lastUpdated ?? source.stockUpdatedAt ?? null;

  if (rawDate) {
    const date = new Date(rawDate);
    if (!Number.isNaN(date.getTime())) {
      ui.catalogStatus.textContent = `Actualizado ${date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} · ${date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
      return;
    }
  }

  ui.catalogStatus.textContent = `${allProducts.length} modelos disponibles`;
}

function renderEverything({ refreshFilters = false } = {}) {
  if (refreshFilters) refreshFilterOptions();

  renderQuickFilters();
  renderModelFilters();
  renderActiveFilters();
  renderProducts();
  renderCompare();
  renderOrder();
  updateSortLabel();
}

function openSheet(sheet) {
  if (!sheet) return;

  closeSheet(false);
  state.activeSheet = sheet;
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  ui.sheetBackdrop.classList.add("is-open");
  document.body.classList.add("sheet-open");

  const focusTarget = sheet.querySelector("button, select, input");
  window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 180);
}

function closeSheet(restoreBody = true) {
  if (state.activeSheet) {
    state.activeSheet.classList.remove("is-open");
    state.activeSheet.setAttribute("aria-hidden", "true");
  }

  state.activeSheet = null;
  state.variantProductId = null;
  ui.sheetBackdrop.classList.remove("is-open");
  if (restoreBody) document.body.classList.remove("sheet-open");
}

function openAdminPanel() {
  ui.adminProfit.value = String(appliedProfitPercentage);
  ui.adminShowPrice.value = priceSettings.showPrice ? "S" : "N";
  ui.adminShowUnits.value = priceSettings.showAvailableUnits ? "S" : "N";
  openSheet(ui.adminSheet);
}

function saveAdminSettings() {
  try {
    applyPriceSettings({
      percentage: ui.adminProfit.value,
      showPrice: ui.adminShowPrice.value === "S",
      showAvailableUnits: ui.adminShowUnits.value === "S",
    }, { persist: true });
    renderEverything({ refreshFilters: true });
    closeSheet();
    showToast("Variables actualizadas");
  } catch (error) {
    showToast(error.message || "Revisá los valores ingresados");
    ui.adminProfit.focus();
  }
}

function downloadVariablesFile() {
  const blob = new Blob([variablesFileContent()], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "variable_precios.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Archivo variable_precios.md descargado");
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), 1600);
}

function openVariantSheet(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  const variants = getVariants(product);
  const selected = getSelectedVariant(product);

  ui.variantSheetTitle.textContent = product.model;
  ui.variantSheetSubtitle.textContent = variants.length > 1 ? "Elegí color / variante disponible" : "Variante disponible";
  ui.variantList.innerHTML = variants.map((variant) => {
    const availability = getAvailability(product, variant);
    const isSelected = variant.color === selected.color;
    return `
      <button class="variant-option ${isSelected ? "is-selected" : ""}" type="button" data-select-variant="${escapeHtml(variant.color)}" ${availability.available ? "" : "disabled"}>
        <span class="variant-swatch" style="--swatch:${colorToCss(variant.color)}"></span>
        <span class="variant-copy">
          <strong>${escapeHtml(variant.color)}</strong>
          <span>${escapeHtml(availability.label)}</span>
        </span>
        <span class="variant-side">
          <span class="variant-price">${formatMoney(variant.priceUsd)}</span>
          <span class="radio-dot" aria-hidden="true"></span>
        </span>
      </button>
    `;
  }).join("");

  openSheet(ui.variantSheet);
  state.variantProductId = productId;
}

function selectVariant(color) {
  const productId = state.variantProductId;
  if (!productId) return;

  selectedColors.set(productId, color);
  closeSheet();
  renderProducts();
  renderCompare();
  showToast(`Variante: ${color}`);
}

function toggleCompare(productId) {
  const index = state.compareIds.indexOf(productId);

  if (index >= 0) {
    state.compareIds.splice(index, 1);
  } else {
    if (state.compareIds.length >= 3) {
      showToast("Podés comparar hasta 3 productos.");
      return;
    }
    state.compareIds.push(productId);
  }

  renderProducts();
  renderCompare();
}

function compareRow(label, values, className = "") {
  return `
    <div class="compare-cell compare-label">${escapeHtml(label)}</div>
    ${values.map((value) => `<div class="compare-cell ${className}">${value}</div>`).join("")}
  `;
}

function renderCompare() {
  const products = state.compareIds
    .map((id) => allProducts.find((product) => product.id === id))
    .filter(Boolean);

  const count = products.length;
  ui.compareBadge.hidden = count === 0;
  ui.compareBadge.textContent = count;
  ui.compareBar.hidden = count === 0;
  ui.compareBarTitle.textContent = count === 1 ? "1 producto para comparar" : `Comparar ${count} productos`;
  ui.compareBarSubtitle.textContent = count < 2 ? "Sumá otra alternativa" : "Ver diferencias clave";
  ui.compareSheetSubtitle.textContent = count ? `${count} ${count === 1 ? "producto seleccionado" : "productos seleccionados"}` : "Seleccioná entre 2 y 3 productos";
  ui.copyCompare.disabled = count < 2;
  ui.clearCompare.disabled = count === 0;

  if (!count) {
    ui.compareBody.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Todavía no hay productos para comparar.</strong>
          <p>Elegí “Comparar” en 2 o 3 alternativas y las vas a ver acá.</p>
        </div>
      </div>
    `;
    return;
  }

  const columns = count;
  const gridStyle = `grid-template-columns: 104px repeat(${columns}, minmax(138px, 1fr));`;

  const modelCells = products.map((product) => {
    const variant = getSelectedVariant(product);
    return `
      <div class="compare-cell compare-product">
        <button class="compare-remove" type="button" data-remove-compare="${escapeHtml(product.id)}" aria-label="Quitar ${escapeHtml(product.model)}">×</button>
        <strong>${escapeHtml(product.model)}</strong>
        <span>${escapeHtml(product.brand)} · ${escapeHtml(variant.color)}</span>
      </div>
    `;
  }).join("");

  ui.compareBody.innerHTML = `
    <div class="compare-scroll">
      <div class="compare-grid" style="${gridStyle}">
        <div class="compare-cell compare-label">Producto</div>
        ${modelCells}
        ${compareRow("Almacenamiento", products.map((product) => escapeHtml(product.memory?.storageGb != null ? memoryLabel(product.memory.storageGb) : "—")))}
        ${compareRow("RAM", products.map((product) => escapeHtml(product.memory?.ramGb != null ? memoryLabel(product.memory.ramGb) : "—")))}
        ${compareRow("Chip", products.map((product) => escapeHtml(product.chip || "—")))}
        ${compareRow("Conectividad", products.map((product) => escapeHtml(toArray(product.connectivity).join(" · ") || "—")))}
        ${compareRow("Color", products.map((product) => escapeHtml(getSelectedVariant(product).color)))}
        ${compareRow("Stock", products.map((product) => {
          const availability = getAvailability(product);
          return `<span class="availability ${availability.className}">${escapeHtml(availability.label)}</span>`;
        }))}
        ${priceSettings.showPrice ? compareRow("Precio", products.map((product) => escapeHtml(formatMoney(getSelectedPrice(product)))), "compare-price") : ""}
      </div>
    </div>
  `;
}

async function copyComparison() {
  const products = state.compareIds
    .map((id) => allProducts.find((product) => product.id === id))
    .filter(Boolean);

  if (products.length < 2) return;

  const lines = products.map((product, index) => {
    const variant = getSelectedVariant(product);
    const availability = getAvailability(product, variant);
    const specs = [
      product.memory?.storageGb != null ? memoryLabel(product.memory.storageGb) : null,
      product.memory?.ramGb != null ? `${memoryLabel(product.memory.ramGb)} RAM` : null,
      product.chip,
      variant.color,
    ].filter(Boolean).join(" · ");

    const price = priceSettings.showPrice ? `${formatMoney(variant.priceUsd)} · ` : "";
    return `${index + 1}. ${product.brand} ${product.model}\n${specs}\n${price}${availability.label}`;
  });

  await copyText(["Comparación Prime Store", "", ...lines].join("\n\n"), "Comparación copiada");
}

function addProduct(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  const variant = getSelectedVariant(product);
  const availability = getAvailability(product, variant);
  if (!availability.available) {
    showToast("Esa variante no tiene stock.");
    return;
  }

  const key = `${product.id}::${variant.color}`;
  const current = selectedItems.get(key);
  const nextQuantity = (current?.quantity ?? 0) + 1;

  if (availability.quantity != null && nextQuantity > availability.quantity) {
    showToast(`Solo hay ${availability.quantity} ${availability.quantity === 1 ? "unidad disponible" : "unidades disponibles"}.`);
    return;
  }

  selectedItems.set(key, {
    ...product,
    key,
    selectedColor: variant.color,
    quantity: nextQuantity,
    priceUsd: Number(variant.priceUsd ?? 0),
    maxQuantity: availability.quantity,
  });

  renderOrder();
  showToast("Agregado al pedido");
}

function changeQuantity(key, difference) {
  const item = selectedItems.get(key);
  if (!item) return;

  const next = item.quantity + difference;
  if (next < 1) {
    selectedItems.delete(key);
    renderOrder();
    return;
  }

  if (item.maxQuantity != null && next > item.maxQuantity) {
    showToast(`Solo hay ${item.maxQuantity} ${item.maxQuantity === 1 ? "unidad disponible" : "unidades disponibles"}.`);
    return;
  }

  item.quantity = next;
  renderOrder();
}

function orderTotals() {
  const entries = [...selectedItems.values()];
  const units = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce((sum, item) => sum + Number(item.priceUsd ?? 0) * item.quantity, 0);
  return { entries, units, total };
}

function renderOrder() {
  const { entries, units, total } = orderTotals();

  ui.orderBadge.hidden = units === 0;
  ui.orderBadge.textContent = units;
  ui.orderBar.hidden = units === 0;
  ui.orderBarTitle.textContent = `${units} ${units === 1 ? "producto" : "productos"}${priceSettings.showPrice ? ` · ${formatMoney(total)}` : ""}`;
  ui.orderBarSubtitle.textContent = "Pedido en curso";
  ui.orderSheetSubtitle.textContent = units ? `${units} ${units === 1 ? "unidad" : "unidades"}` : "Todavía no agregaste productos";
  ui.total.textContent = formatMoney(total);
  ui.copyOrder.disabled = !entries.length;
  ui.clearOrder.disabled = !entries.length;

  if (!entries.length) {
    ui.selected.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Tu pedido está vacío.</strong>
          <p>Agregá una variante desde los resultados para armar una cotización rápida.</p>
        </div>
      </div>
    `;
    return;
  }

  ui.selected.innerHTML = entries.map((item) => `
    <article class="order-item">
      <div>
        <p class="order-name">${escapeHtml(item.brand)} ${escapeHtml(item.model)}</p>
        <p class="order-meta">${escapeHtml([specsFor(item).join(" · "), item.selectedColor].filter(Boolean).join(" · "))}</p>
      </div>
      <strong class="order-price">${formatMoney(Number(item.priceUsd ?? 0) * item.quantity)}</strong>
      <div class="order-controls">
        <div class="quantity">
          <button class="qty-button" type="button" data-change="-1" data-key="${escapeHtml(item.key)}" aria-label="Restar una unidad">−</button>
          <strong>${item.quantity}</strong>
          <button class="qty-button" type="button" data-change="1" data-key="${escapeHtml(item.key)}" aria-label="Sumar una unidad">+</button>
        </div>
        <button class="remove-button" type="button" data-remove-order="${escapeHtml(item.key)}">Quitar</button>
      </div>
    </article>
  `).join("");
}

async function copyOrder() {
  const { entries, total } = orderTotals();
  if (!entries.length) return;

  const lines = entries.map((item) => {
    const unitPrice = formatMoney(item.priceUsd);
    const lineTotal = formatMoney(Number(item.priceUsd ?? 0) * item.quantity);
    const price = priceSettings.showPrice ? ` | ${unitPrice}${item.quantity > 1 ? ` c/u | ${lineTotal}` : ""}` : "";
    return `- ${item.quantity}x ${item.brand} ${item.model} | ${item.selectedColor}${price}`;
  });

  const totalLine = priceSettings.showPrice ? [`Total: ${formatMoney(total)}`] : [];
  await copyText(["Pedido Prime Store", ...lines, ...totalLine].join("\n"), "Pedido copiado");
}

async function copyProduct(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  const variant = getSelectedVariant(product);
  const availability = getAvailability(product, variant);
  const details = [
    product.memory?.storageGb != null ? memoryLabel(product.memory.storageGb) : null,
    product.memory?.ramGb != null ? `${memoryLabel(product.memory.ramGb)} RAM` : null,
    ...toArray(product.connectivity),
    variant.color,
  ].filter(Boolean).join(" · ");

  const text = [
    `${product.brand} ${product.model}`,
    details,
    priceSettings.showPrice ? `${formatMoney(variant.priceUsd)} · ${availability.label}` : availability.label,
  ].filter(Boolean).join("\n");

  await copyText(text, "Producto copiado");
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    window.prompt("Copiá el texto:", text);
  }
}

function clearAdvancedFilters({ keepSearch = true, keepQuick = true } = {}) {
  for (const key of FILTER_KEYS) ui[key].value = "";
  ui.sort.value = "catalog";
  if (!keepSearch) ui.search.value = "";
  if (!keepQuick) state.quickGroup = "all";
  refreshFilterOptions();
  renderEverything();
}

function updateCatalog({ refreshFilters = true } = {}) {
  if (refreshFilters) refreshFilterOptions();
  renderEverything();
}

function setQuickGroup(groupId) {
  const nextGroup = quickGroups.some((group) => group.id === groupId)
    ? groupId
    : "all";

  if (state.quickGroup !== nextGroup) {
    ui.model.value = "";
  }

  state.quickGroup = nextGroup;

  refreshFilterOptions();
  renderEverything();
}

function removeFilter(key) {
  if (!FILTER_KEYS.includes(key)) return;
  ui[key].value = "";
  refreshFilterOptions();
  renderEverything();
}

ui.search.addEventListener("input", () => {
  ui.searchClear.hidden = !ui.search.value;
  refreshFilterOptions();
  renderEverything();
});

ui.search.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    ui.search.value = "";
    ui.searchClear.hidden = true;
    refreshFilterOptions();
    renderEverything();
  }
});

ui.searchClear.addEventListener("click", () => {
  ui.search.value = "";
  ui.searchClear.hidden = true;
  refreshFilterOptions();
  renderEverything();
  ui.search.focus();
});

ui.quickFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-group]");
  if (button) setQuickGroup(button.dataset.quickGroup);
});
ui.modelFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-model-chip]");
  if (!button) return;

  const model = button.dataset.modelChip;

  // Si toca nuevamente el modelo activo, lo deselecciona.
  ui.model.value = ui.model.value === model ? "" : model;

  refreshFilterOptions();
  renderEverything();
});

ui.activeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-filter]");
  if (button) removeFilter(button.dataset.removeFilter);
});

for (const key of FILTER_KEYS) {
  ui[key].addEventListener("change", () => updateCatalog({ refreshFilters: true }));
}

ui.sort.addEventListener("change", () => renderEverything());
ui.sortTrigger.addEventListener("click", () => openSheet(ui.filtersSheet));
ui.openFilters.addEventListener("click", () => openSheet(ui.filtersSheet));
ui.applyFilters.addEventListener("click", () => closeSheet());
ui.clearFilters.addEventListener("click", () => clearAdvancedFilters({ keepSearch: true, keepQuick: true }));

ui.products.addEventListener("click", (event) => {
  const cardVariant = event.target.closest("[data-card-variant-product]");
  const variant = event.target.closest("[data-open-variant]");
  const compare = event.target.closest("[data-compare]");
  const copy = event.target.closest("[data-copy-product]");
  const add = event.target.closest("[data-add]");

  if (cardVariant) {
    selectedColors.set(cardVariant.dataset.cardVariantProduct, cardVariant.dataset.cardVariantColor);
    renderProducts();
    renderCompare();
  } else if (variant) openVariantSheet(variant.dataset.openVariant);
  else if (compare) toggleCompare(compare.dataset.compare);
  else if (copy) copyProduct(copy.dataset.copyProduct);
  else if (add) addProduct(add.dataset.add);
});

ui.variantList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-variant]");
  if (button) selectVariant(button.dataset.selectVariant);
});

ui.openCompare.addEventListener("click", () => openSheet(ui.compareSheet));
ui.navCompare.addEventListener("click", () => openSheet(ui.compareSheet));
ui.clearCompare.addEventListener("click", () => {
  state.compareIds = [];
  renderProducts();
  renderCompare();
});
ui.copyCompare.addEventListener("click", copyComparison);
ui.compareBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-compare]");
  if (!button) return;
  state.compareIds = state.compareIds.filter((id) => id !== button.dataset.removeCompare);
  renderProducts();
  renderCompare();
});

ui.openOrder.addEventListener("click", () => openSheet(ui.orderSheet));
ui.navOrder.addEventListener("click", () => openSheet(ui.orderSheet));
ui.clearOrder.addEventListener("click", () => {
  selectedItems.clear();
  renderOrder();
});
ui.copyOrder.addEventListener("click", copyOrder);
ui.selected.addEventListener("click", (event) => {
  const change = event.target.closest("[data-change]");
  const remove = event.target.closest("[data-remove-order]");

  if (change) changeQuantity(change.dataset.key, Number(change.dataset.change));
  if (remove) {
    selectedItems.delete(remove.dataset.removeOrder);
    renderOrder();
  }
});

ui.navSearch.addEventListener("click", () => {
  closeSheet();
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.setTimeout(() => ui.search.focus({ preventScroll: true }), 250);
});
ui.navFilters.addEventListener("click", () => openSheet(ui.filtersSheet));
ui.openAdmin.addEventListener("click", openAdminPanel);
ui.saveAdmin.addEventListener("click", saveAdminSettings);
ui.downloadVariables.addEventListener("click", downloadVariablesFile);

ui.sheetBackdrop.addEventListener("click", () => closeSheet());
$$('[data-close-sheet]').forEach((button) => button.addEventListener("click", () => closeSheet()));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.activeSheet) closeSheet();
});

async function initializeWidget() {
  try {
    await loadPriceVariables();
  } catch (error) {
    console.error("No se pudo aplicar la variable de ganancia; se mostrarán precios de lista.", error);
    const overrides = readAdminOverrides();
    if (overrides) applyPriceSettings(overrides);
  }

  renderCatalogStatus();
  refreshFilterOptions();
  renderEverything();
}

initializeWidget();

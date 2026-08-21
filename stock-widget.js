const allProducts = window.STOCK_DB?.products ?? [];

if (!allProducts.length) {
  throw new Error(
    "No se pudo cargar la base de stock (window.STOCK_DB.products).",
  );
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  search: $("#search"),
  searchClear: $("#searchClear"),
  searchLiveCount: $("#searchLiveCount"),
  quickFilters: $("#quickFilters"),
  modelFilters: $("#modelFilters"),
  navContext: $("#navContext"),
  filterTriggerLabel: $("#filterTriggerLabel"),
  activeFilters: $("#activeFilters"),
  products: $("#products"),
  resultCount: $("#resultCount"),
  resultsTitle: $(".results-title"),
  sortTrigger: $("#sortTrigger"),
  catalogStatus: $("#catalogStatus"),
  brandLockup: $("#brandLockup"),
  brandSubtitle: $("#brandSubtitle"),
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
  family: $("#family"),
  model: $("#model"),
  storage: $("#storage"),
  ram: $("#ram"),
  chip: $("#chip"),
  sim: $("#sim"),
  color: $("#color"),
  availability: $("#availability"),
  priceMin: $("#priceMin"),
  priceMax: $("#priceMax"),
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

const FILTER_KEYS = [
  "deviceType",
  "brand",
  "family",
  "model",
  "storage",
  "ram",
  "chip",
  "sim",
  "color",
  "availability",
];
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
  const match = String(text).match(
    /^\s*\[ganancia\]\s*(?::|=|-)?\s*(?:USD\s*)?(-?\d+(?:[.,]\d+)?)\s*$/im,
  );
  if (!match)
    throw new Error("No se encontró un valor válido para [ganancia].");

  const percentage = Number(match[1].replace(",", "."));
  if (!Number.isFinite(percentage))
    throw new Error("El valor de [ganancia] no es numérico.");
  return percentage;
}

function parseYesNoVariable(text, key, defaultValue = true) {
  const match = String(text).match(
    new RegExp(`^\\s*\\[${key}\\]\\s*(?::|=|-)\\s*([SN])\\s*$`, "im"),
  );
  return match ? match[1].toUpperCase() === "S" : defaultValue;
}

function addProfitToCatalog(percentage) {
  const adjusted = (owner, value) => {
    if (value == null || value === "") return value;
    const price = Number(value);
    if (!Number.isFinite(price)) return value;
    if (!basePrices.has(owner))
      basePrices.set(owner, price / (1 + appliedProfitPercentage / 100));
    return basePrices.get(owner) * (1 + percentage / 100);
  };

  for (const product of allProducts) {
    product.priceUsd = adjusted(product, product.priceUsd);
    if (Array.isArray(product.pricesUsd)) {
      const factor =
        (1 + percentage / 100) / (1 + appliedProfitPercentage / 100);
      product.pricesUsd = product.pricesUsd.map((value) =>
        Number.isFinite(Number(value)) ? Number(value) * factor : value,
      );
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
  if (!Number.isFinite(percentage) || percentage <= -100)
    throw new Error("Ingresá un porcentaje mayor a -100.");

  addProfitToCatalog(percentage);
  priceSettings.showPrice = Boolean(settings.showPrice);
  priceSettings.showAvailableUnits = Boolean(settings.showAvailableUnits);
  document.body.classList.toggle("hide-sale-prices", !priceSettings.showPrice);

  for (const item of selectedItems.values()) {
    const product = allProducts.find((candidate) => candidate.id === item.id);
    const variant = product
      ? getVariants(product).find(
          (candidate) => candidate.color === item.selectedColor,
        )
      : null;
    if (variant) item.priceUsd = Number(variant.priceUsd ?? 0);
  }

  if (persist)
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify({
        percentage,
        showPrice: priceSettings.showPrice,
        showAvailableUnits: priceSettings.showAvailableUnits,
      }),
    );
}

function variablesFileContent() {
  return `# Variables de precios\n\n[ganancia]: ${appliedProfitPercentage}\n[mostrar_precio]: ${priceSettings.showPrice ? "S" : "N"}\n[mostrar_uds_dispo]: ${priceSettings.showAvailableUnits ? "S" : "N"}\n`;
}

async function loadPriceVariables() {
  const separator = PRICE_VARIABLES_FILE.includes("?") ? "&" : "?";
  const response = await fetch(
    `${PRICE_VARIABLES_FILE}${separator}v=${Date.now()}`,
    { cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      `No se pudo leer ${PRICE_VARIABLES_FILE} (${response.status}).`,
    );
  const variables = await response.text();
  const fileSettings = {
    percentage: parseProfitPercentage(variables),
    showPrice: parseYesNoVariable(variables, "mostrar_precio"),
    showAvailableUnits: parseYesNoVariable(variables, "mostrar_uds_dispo"),
  };
  applyPriceSettings({ ...fileSettings, ...readAdminOverrides() });
}

const state = {
  navGroup: "",
  navBrand: "",
  navType: "",
  navFamily: "",
  expandedModels: new Set(),
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

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );

const unique = (values) => [
  ...new Set(values.filter((value) => value != null && value !== "")),
];
const naturalSort = (a, b) =>
  String(a).localeCompare(String(b), "es", {
    numeric: true,
    sensitivity: "base",
  });
const memoryLabel = (gb) =>
  gb == null
    ? ""
    : Number(gb) >= 1024
      ? `${Number(gb) / 1024} TB`
      : `${Number(gb)} GB`;
const toArray = (value) =>
  Array.isArray(value) ? value : value == null ? [] : [value];

function formatMoney(value) {
  const numeric = Number(value ?? 0);
  return money
    .format(Number.isFinite(numeric) ? numeric : 0)
    .replace("US$", "US$");
}

function getModelFamily(product) {
  const model = String(product.model ?? "").trim();
  const brand = normalize(product.brand);
  const deviceType = normalize(product.deviceType);

  const patterns = [
    [
      /^(\d+E?)\b/i,
      (match) =>
        brand === "apple" && deviceType === "smartphone"
          ? `iPhone ${match[1].toUpperCase()}`
          : match[1].toUpperCase(),
    ],
    [
      /^(NOTE\s+\d+[A-Z]?|REDMI\s+\d+[A-Z]?|POCO\s+[A-Z]\d+)\b/i,
      (match) => match[1].toUpperCase(),
    ],
    [
      /^(S\d+|A\d+|Z\s+(?:FOLD|FLIP)\s*\d*|G\d+|EDGE\s+\d+)\b/i,
      (match) => match[1].toUpperCase().replace(/\s+/g, " "),
    ],
    [
      /^(IPAD(?:\s+AIR|\s+PRO)?|AIRPODS(?:\s+PRO|\s+MAX)?|APPLE WATCH(?:\s+SERIES|\s+SE|\s+ULTRA)?|MACBOOK(?:\s+AIR|\s+PRO|\s+NEO)?|MAC MINI)\b/i,
      (match) => match[1].replace(/\b\w/g, (char) => char.toUpperCase()),
    ],
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
    return [
      {
        color: "Standard",
        priceUsd: Number(
          product.priceUsd ?? getLowestVariantPrice(product) ?? 0,
        ),
        raw: rawVariants[0] ?? product,
      },
    ];
  }

  return colors.map((color) => {
    const raw =
      rawVariants.find(
        (variant) => normalize(variant?.color) === normalize(color),
      ) ?? null;
    return {
      color,
      priceUsd: Number(
        raw?.priceUsd ??
          product.priceUsd ??
          getLowestVariantPrice(product) ??
          0,
      ),
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
  const selected =
    variants.find((variant) => variant.color === requestedColor) ?? variants[0];
  if (selected) selectedColors.set(product.id, selected.color);
  return selected;
}

function numericStock(source) {
  if (!source || typeof source !== "object") return null;
  const keys = [
    "stockQuantity",
    "availableQuantity",
    "quantity",
    "stockQty",
    "units",
    "stock",
  ];

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value))
      return Math.max(0, Math.floor(value));
    if (typeof value === "string" && /^\d+$/.test(value.trim()))
      return Math.max(0, Number(value));
  }

  return null;
}

function getAvailability(product, variant = getSelectedVariant(product)) {
  const raw = variant?.raw ?? product;
  const quantity = numericStock(raw) ?? numericStock(product);
  const explicitlyOut =
    raw?.inStock === false ||
    raw?.available === false ||
    product?.inStock === false ||
    product?.available === false;

  if (explicitlyOut || quantity === 0) {
    return {
      quantity: 0,
      label: "Sin stock",
      className: "is-out",
      available: false,
    };
  }

  if (quantity != null) {
    if (!priceSettings.showAvailableUnits) {
      return { quantity, label: "Disponible", className: "", available: true };
    }
    if (quantity === 1)
      return {
        quantity,
        label: "1 unidad",
        className: "is-low",
        available: true,
      };
    if (quantity <= 3)
      return {
        quantity,
        label: `${quantity} unidades`,
        className: "is-low",
        available: true,
      };
    return {
      quantity,
      label: `${quantity} unidades`,
      className: "",
      available: true,
    };
  }

  return {
    quantity: null,
    label: "Disponible",
    className: "",
    available: true,
  };
}

function getSelectedPrice(product) {
  const variant = getSelectedVariant(product);
  const price = Number(
    variant?.priceUsd ?? getLowestVariantPrice(product) ?? 0,
  );
  return Number.isFinite(price) ? price : 0;
}

function getSimLabel(product) {
  if (product.configuration?.simMode) return product.configuration.simMode;
  const source = [
    ...toArray(product.connectivity),
    product.description,
    product.raw,
  ]
    .filter(Boolean)
    .join(" ");
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
    [
      ["gray", "grey", "gris", "titanium gray", "natural titanium", "natural"],
      "#b7aea3",
    ],
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
    product.memory?.storageGb != null
      ? memoryLabel(product.memory.storageGb)
      : null,
    product.memory?.ramGb != null
      ? `${memoryLabel(product.memory.ramGb)} RAM`
      : null,
    product.chip || null,
    ...toArray(product.connectivity).filter(
      (value) => !/\b(?:e?sim|physical sim)\b/i.test(value),
    ),
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
  return normalize(
    [
      product.brand,
      product.model,
      getModelFamily(product),
      product.deviceType,
      product.chip,
      product.memory?.storageGb,
      product.memory?.storageGb != null
        ? `${product.memory.storageGb}gb`
        : null,
      product.memory?.ramGb,
      product.memory?.ramGb != null ? `${product.memory.ramGb}gb ram` : null,
      ...toArray(product.connectivity),
      getSimLabel(product),
      ...(product.colors ?? []),
      ...(product.variants ?? []).map((variant) => variant?.color),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function queryMatches(product) {
  const query = buildSearchQuery(ui.search.value);
  if (!query.tokens.length) return true;

  const text = searchableText(product);
  const compactText = text.replace(/\s+/g, "");
  return query.tokens.every(
    (token) => text.includes(token) || compactText.includes(token),
  );
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

function navigationType(product) {
  const type = normalize(product.deviceType).replace(/_/g, " ");
  const model = normalize(product.model);
  const brand = normalize(product.brand);
  if (brand === "apple") {
    if (type === "smartphone" || /\biphone\b/.test(model) || /^\d+e?\b/.test(model)) return "iPhone";
    if (/macbook/.test(model) || ["notebook", "laptop"].includes(type)) return "MacBook";
    if (/mac mini/.test(model)) return "Mac mini";
    if (/ipad/.test(model) || type === "tablet") return "iPad";
    if (/watch/.test(model) || /watch/.test(type)) return "Apple Watch";
    if (/airpods/.test(model) || /auricular|headphone|audio/.test(type)) return "AirPods";
    return "Accesorios";
  }
  const labels = {
    smartphone: "Smartphones", tablet: "Tablets", smartwatch: "Watch",
    watch: "Watch", auriculares: "Audio", headphones: "Audio",
    notebook: "Notebooks", laptop: "Notebooks", consola: "Consolas",
    drone: "Drones", accesorio_drone: "Drones", accesorio_gaming: "Gaming",
    anteojos_inteligentes: "Anteojos", camara: "Cámaras", parlante: "Audio",
    accesorio: "Accesorios", control: "Gaming", microfono: "Micrófonos",
  };
  return labels[normalize(product.deviceType)] || humanType(product.deviceType);
}

function navigationModel(product) {
  return String(product.model || "Producto").trim();
}

function navigationGroup(product) {
  const type = navigationType(product);
  if (["Smartphones", "iPhone"].includes(type)) return "Smartphones";
  if (["Tablets", "iPad"].includes(type)) return "Tablets";
  if (["Notebooks", "MacBook", "Mac mini"].includes(type)) return "Computadoras";
  if (["Consolas", "Gaming"].includes(type)) return "Consolas";
  if (type === "Drones") return "Drones";
  return "Accesorios";
}

function navigationFamily(product) {
  return String(product.family || navigationModel(product)).trim();
}

function productMatchesNavigation(product) {
  return (!state.navGroup || navigationGroup(product) === state.navGroup) &&
    (!state.navBrand || product.brand === state.navBrand) &&
    (!state.navType || navigationType(product) === state.navType) &&
    (!state.navFamily || navigationFamily(product) === state.navFamily);
}

function selectedFilters(except = null) {
  return {
    deviceType: except === "deviceType" ? "" : ui.deviceType.value,
    brand: except === "brand" ? "" : ui.brand.value,
    family: except === "family" ? "" : ui.family.value,
    model: except === "model" ? "" : ui.model.value,
    storage: except === "storage" ? "" : ui.storage.value,
    ram: except === "ram" ? "" : ui.ram.value,
    chip: except === "chip" ? "" : ui.chip.value,
    sim: except === "sim" ? "" : ui.sim.value,
    color: except === "color" ? "" : ui.color.value,
    availability: except === "availability" ? "" : ui.availability.value,
    priceMin: ui.priceMin.value,
    priceMax: ui.priceMax.value,
  };
}

function productMatchesFilters(
  product,
  filters,
  { includeQuery = true, includeNavigation = true } = {},
) {
  const matches =
    (!filters.deviceType || product.deviceType === filters.deviceType) &&
    (!filters.brand || product.brand === filters.brand) &&
    (!filters.family || navigationFamily(product) === filters.family) &&
    (!filters.model || navigationModel(product) === filters.model) &&
    (!filters.storage ||
      Number(product.memory?.storageGb) === Number(filters.storage)) &&
    (!filters.ram || Number(product.memory?.ramGb) === Number(filters.ram)) &&
    (!filters.chip || product.chip === filters.chip) &&
    (!filters.sim || getSimLabel(product) === filters.sim) &&
    (!filters.color ||
      getVariants(product).some((variant) => variant.color === filters.color)) &&
    (!filters.availability || getVariants(product).some((variant) =>
      (filters.availability === "available") === getAvailability(product, variant).available)) &&
    (!filters.priceMin || getLowestVariantPrice(product) >= Number(filters.priceMin)) &&
    (!filters.priceMax || getLowestVariantPrice(product) <= Number(filters.priceMax));

  if (!matches) return false;
  if (includeNavigation && !productMatchesNavigation(product)) return false;
  if (includeQuery && !queryMatches(product)) return false;
  return true;
}

function getFilterValues(key, products) {
  return unique(
    products.flatMap((product) => {
      if (key === "deviceType")
        return product.deviceType ? [product.deviceType] : [];
      if (key === "brand") return product.brand ? [product.brand] : [];
      if (key === "family") return product.family ? [navigationFamily(product)] : [];
      if (key === "model")
        return product.model ? [navigationModel(product)] : [];
      if (key === "storage")
        return product.memory?.storageGb != null
          ? [product.memory.storageGb]
          : [];
      if (key === "ram")
        return product.memory?.ramGb != null ? [product.memory.ramGb] : [];
      if (key === "chip") return product.chip ? [product.chip] : [];
      if (key === "sim") return getSimLabel(product) ? [getSimLabel(product)] : [];
      if (key === "color")
        return getVariants(product).map((variant) => variant.color);
      if (key === "availability")
        return getVariants(product).map((variant) => getAvailability(product, variant).available ? "available" : "out");
      return [];
    }),
  );
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
    ...list.map(
      (value) =>
        `<option value="${escapeHtml(String(value))}">${escapeHtml(formatter(value))}</option>`,
    ),
  ].join("");

  element.value = list.map(String).includes(String(current)) ? current : "";
}

function refreshFilterOptions() {
  const labels = {
    deviceType: "Todos",
    brand: "Todas",
    family: "Todas",
    model: "Todos",
    storage: "Todos",
    ram: "Toda",
    chip: "Todos",
    sim: "Todas",
    color: "Todos",
    availability: "Toda",
  };

  const formatters = {
    storage: memoryLabel,
    ram: memoryLabel,
    deviceType: humanType,
    availability: (value) => value === "available" ? "Disponible" : "Sin stock",
  };

  for (const key of FILTER_KEYS) {
    const candidates = allProducts.filter((product) =>
      productMatchesFilters(product, selectedFilters(key), {
        includeQuery: true,
        includeNavigation: true,
      }),
    );
    fillSelect(
      ui[key],
      getFilterValues(key, candidates),
      labels[key],
      formatters[key] ?? ((value) => value),
    );
  }
}

function visibleProducts() {
  const filtered = allProducts.filter((product) =>
    productMatchesFilters(product, selectedFilters()),
  );

  if (ui.sort.value === "price-asc") {
    return [...filtered].sort(
      (a, b) => getSelectedPrice(a) - getSelectedPrice(b),
    );
  }

  if (ui.sort.value === "price-desc") {
    return [...filtered].sort(
      (a, b) => getSelectedPrice(b) - getSelectedPrice(a),
    );
  }

  const query = buildSearchQuery(ui.search.value);
  return [...filtered].sort((a, b) => {
    if (query.tokens.length) {
      const scoreDiff = searchScore(b) - searchScore(a);
      if (scoreDiff) return scoreDiff;
    }
    return `${a.brand} ${a.model}`.localeCompare(
      `${b.brand} ${b.model}`,
      "es",
      { numeric: true, sensitivity: "base" },
    );
  });
}

function renderQuickFilters() {
  const deviceGroups = ["Smartphones", "Tablets", "Computadoras", "Consolas", "Drones", "Accesorios"]
    .filter((group) => allProducts.some((product) => navigationGroup(product) === group));
  ui.quickFilters.innerHTML = ["", ...deviceGroups].map((group) => `
    <button class="chip ${state.navGroup === group ? "is-active" : ""}" type="button" data-nav-group="${escapeHtml(group)}">
      ${escapeHtml(group || "Todos")}
    </button>`).join("");
}

function renderModelFilters() {
  ui.modelFilters.innerHTML = "";
  const crumbs = [
    state.navGroup ? { level: "group", label: state.navGroup } : null,
    state.navBrand ? { level: "root", label: "Marcas" } : null,
    state.navBrand ? { level: "brand", label: state.navBrand } : null,
    state.navType ? { level: "type", label: state.navType } : null,
    state.navFamily ? { level: "family", label: state.navFamily } : null,
  ].filter(Boolean);
  ui.navContext.innerHTML = crumbs.map(({ level, label }, index) =>
    `${index ? '<span aria-hidden="true">›</span>' : ""}<button type="button" class="breadcrumb-link" data-breadcrumb="${level}">${escapeHtml(label)}</button>`,
  ).join("");
  ui.search.placeholder = state.navBrand || state.navGroup ? `Buscar dentro de ${state.navFamily || state.navType || state.navBrand || state.navGroup}…` : "Buscar modelo, capacidad, color o SIM…";
}

function activeFilterEntries() {
  const filters = selectedFilters();
  const labels = {
    deviceType: humanType(filters.deviceType),
    brand: filters.brand,
    family: filters.family,
    model: filters.model,
    storage: filters.storage ? memoryLabel(filters.storage) : "",
    ram: filters.ram ? `${memoryLabel(filters.ram)} RAM` : "",
    chip: filters.chip,
    sim: filters.sim,
    color: filters.color,
    availability: filters.availability === "available" ? "Disponible" : filters.availability === "out" ? "Sin stock" : "",
  };

  const entries = FILTER_KEYS.filter((key) => filters[key]).map((key) => ({
    key,
    label: labels[key],
  }));
  if (filters.priceMin || filters.priceMax) entries.push({ key: "price", label: filters.priceMin && filters.priceMax ? `US$ ${filters.priceMin}–${filters.priceMax}` : filters.priceMin ? `Desde US$ ${filters.priceMin}` : `Hasta US$ ${filters.priceMax}` });
  return entries;
}

function renderActiveFilters() {
  const entries = activeFilterEntries();
  ui.activeFilters.innerHTML = entries
    .map(
      ({ key, label }) => `
    <button class="chip chip-filter" type="button" data-remove-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>
  `,
    )
    .join("");
  if (ui.filterTriggerLabel) ui.filterTriggerLabel.textContent = entries.length ? `Filtros · ${entries.length}` : "Filtros";
}

function configurationLabel(product) {
  return [...specsFor(product), getSimLabel(product)].filter(Boolean).join(" · ") || "Configuración única";
}

function groupVisibleProducts(products) {
  const groups = new Map();
  for (const product of products) {
    const key = normalize(`${product.brand}|${navigationType(product)}|${navigationModel(product)}`);
    if (!groups.has(key)) groups.set(key, { key, model: navigationModel(product), brand: product.brand, type: navigationType(product), products: [] });
    groups.get(key).products.push(product);
  }
  return [...groups.values()];
}

function productCard(group) {
  const records = group.products;
  const expanded = state.expandedModels.has(group.key);
  const allVariants = records.flatMap((product) => getVariants(product).map((variant) => ({ product, variant })));
  const prices = allVariants.map(({ variant }) => Number(variant.priceUsd)).filter(Number.isFinite);
  const distinctPrices = unique(prices);
  const lowest = prices.length ? Math.min(...prices) : 0;
  const configs = unique(records.map(configurationLabel));
  const currentFilters = selectedFilters();
  const configurationAttributes = [];
  const seenAttributes = new Set();
  const addConfigurationAttribute = (key, value, label) => {
    if (value == null || value === "") return;
    const identity = `${key}:${value}`;
    if (seenAttributes.has(identity)) return;
    seenAttributes.add(identity);
    configurationAttributes.push({ key, value: String(value), label });
  };
  for (const product of records) {
    addConfigurationAttribute("storage", product.memory?.storageGb, memoryLabel(product.memory?.storageGb));
    addConfigurationAttribute("ram", product.memory?.ramGb, `${memoryLabel(product.memory?.ramGb)} RAM`);
    addConfigurationAttribute("chip", product.chip, product.chip);
    addConfigurationAttribute("sim", getSimLabel(product), getSimLabel(product));
  }
  const configurationGroups = new Map();
  for (const product of records) {
    const label = configurationLabel(product);
    if (!configurationGroups.has(label)) configurationGroups.set(label, []);
    configurationGroups.get(label).push(product);
  }
  const colors = unique(allVariants.map(({ variant }) => variant.color)).filter((color) => normalize(color) !== "standard");
  const available = allVariants.some(({ product, variant }) => getAvailability(product, variant).available);
  const knownQuantities = allVariants.map(({ product, variant }) => getAvailability(product, variant).quantity).filter((quantity) => quantity != null);
  const totalQuantity = knownQuantities.length ? knownQuantities.reduce((sum, quantity) => sum + quantity, 0) : null;
  const showContext = !state.navBrand || !state.navType;
  return `
    <article class="product grouped-product ${expanded ? "is-expanded" : ""}" data-model-key="${escapeHtml(group.key)}">
      <div class="product-summary">
        <span class="summary-copy">
          ${showContext ? `<span class="product-kicker">${escapeHtml(group.brand)} · ${escapeHtml(group.type)}</span>` : ""}
          <strong class="summary-model">${escapeHtml(group.model)}</strong>
          <span class="summary-configs filter-stack" aria-label="Filtrar por atributos de configuración">${configurationAttributes.map(({ key, value, label }) => `<button class="filter-chip config-filter-chip ${String(currentFilters[key]) === value ? "is-active" : ""}" type="button" data-filter-key="${key}" data-filter-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join("")}</span>
          <span class="summary-colors filter-stack" aria-label="Filtrar por color">${colors.slice(0, 8).map((color) => `<button class="color-label filter-chip color-filter-chip ${currentFilters.color === color ? "is-active" : ""}" type="button" data-filter-key="color" data-filter-value="${escapeHtml(color)}"><i class="color-swatch" style="--swatch:${colorToCss(color)}" aria-hidden="true"></i><span>${escapeHtml(color)}</span></button>`).join("")}${colors.length > 8 ? `<span>+${colors.length - 8}</span>` : ""}</span>
        </span>
        <span class="summary-side">
          <strong class="hero-price">${distinctPrices.length > 1 ? "Desde " : ""}${formatMoney(lowest)}</strong>
          <span class="availability ${available ? "" : "is-out"}">${available ? (priceSettings.showAvailableUnits && totalQuantity != null ? `${totalQuantity} ${totalQuantity === 1 ? "unidad total" : "unidades totales"}` : "Disponible") : "Sin stock"}</span>
          <button class="expand-label" type="button" data-expand-model="${escapeHtml(group.key)}" aria-expanded="${expanded}">${expanded ? "Ocultar variantes ↑" : `Ver ${allVariants.length} ${allVariants.length === 1 ? "variante" : "variantes"} ↓`}</button>
        </span>
      </div>
      <div class="group-variants" ${expanded ? "" : "hidden"}>
        ${[...configurationGroups.entries()].map(([configuration, products]) => `
          <section class="configuration-group">
            <h3>${escapeHtml(configuration)}</h3>
            ${products.flatMap((product) => getVariants(product).map((variant) => {
              const availability = getAvailability(product, variant);
              const compared = state.compareIds.includes(product.id);
              return `<div class="compact-variant-row">
                <strong class="variant-identity"><span class="color-label"><i class="color-swatch" style="--swatch:${colorToCss(variant.color)}" aria-hidden="true"></i><span>${escapeHtml(variant.color)}</span></span>${getSimLabel(product) ? `<small>${escapeHtml(getSimLabel(product))}</small>` : ""}</strong>
                <span class="availability ${availability.className}">${escapeHtml(availability.label)}</span>
                <span class="variant-row-price">${formatMoney(variant.priceUsd)}</span>
                <button class="more-button ${compared ? "is-active" : ""}" type="button" data-compare="${escapeHtml(product.id)}" data-action-color="${escapeHtml(variant.color)}" aria-label="${compared ? "Quitar de comparación" : "Comparar"}" title="Comparar">${compared ? "✓" : "⇄"}</button>
                <button class="more-button" type="button" data-copy-product="${escapeHtml(product.id)}" data-action-color="${escapeHtml(variant.color)}" aria-label="Copiar detalle" title="Copiar detalle">•••</button>
                <button class="add-button compact-add" type="button" data-add-variant="${escapeHtml(product.id)}" data-add-color="${escapeHtml(variant.color)}" ${availability.available ? "" : "disabled"}>Agregar</button>
              </div>`;
            })).join("")}
          </section>`).join("")}
      </div>
    </article>`;
}

function renderNavigationCards(products, level) {
  const selector = level === "brand" ? (product) => product.brand : level === "type" ? navigationType : navigationFamily;
  const groups = new Map();
  for (const product of products) {
    const label = selector(product);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(product);
  }
  const cards = [...groups.entries()].sort(([a], [b]) => naturalSort(a, b));
  ui.products.classList.add("navigation-grid");
  ui.resultsTitle.textContent = level === "brand" ? (state.navType || state.navGroup ? `Marcas de ${state.navType || state.navGroup}` : "Elegí una marca") : level === "type" ? `Explorar ${state.navBrand}` : state.navType;
  ui.resultCount.textContent = `${cards.length} ${cards.length === 1 ? "opción disponible" : "opciones disponibles"}`;
  ui.filterPreviewCount.textContent = `${products.length} configuraciones en esta selección`;
  ui.products.innerHTML = cards.map(([label, items]) => {
    const models = unique(items.map(navigationModel)).length;
    const configurations = unique(items.map((product) => `${navigationModel(product)}|${configurationLabel(product)}`)).length;
    const totalUnits = items.map((product) => numericStock(product)).filter((quantity) => quantity != null).reduce((sum, quantity) => sum + quantity, 0);
    return `<button class="navigation-card" type="button" data-body-nav="${level}" data-body-value="${escapeHtml(label)}">
      <span><strong>${escapeHtml(label)}</strong><small>${models} ${models === 1 ? "modelo" : "modelos"} · ${configurations} ${configurations === 1 ? "configuración" : "configuraciones"}${priceSettings.showAvailableUnits && totalUnits ? ` · ${totalUnits} unidades` : ""}</small></span>
      <b aria-hidden="true">→</b>
    </button>`;
  }).join("");
}

function renderProducts() {
  const products = visibleProducts();
  const groups = groupVisibleProducts(products);
  const configurationCount = unique(products.map((product) => `${navigationModel(product)}|${configurationLabel(product)}`)).length;
  const query = ui.search.value.trim();
  const hasAttributeFilters = activeFilterEntries().length > 0;
  if (!state.navBrand && !query && !hasAttributeFilters) {
    renderNavigationCards(products, "brand");
    return;
  }
  if (state.navBrand && !query && !hasAttributeFilters && !state.navType) {
    renderNavigationCards(products, "type");
    return;
  }
  if (state.navBrand && state.navType && !query && !hasAttributeFilters && !state.navFamily) {
    renderNavigationCards(products, "family");
    return;
  }
  ui.products.classList.remove("navigation-grid");
  ui.resultsTitle.textContent = state.navFamily || (query ? "Resultados de búsqueda" : "Productos disponibles");
  const context = [state.navBrand, state.navType, state.navFamily, query ? `“${query}”` : ""].filter(Boolean).join(" · ");
  ui.resultCount.textContent = `${groups.length} ${groups.length === 1 ? "modelo" : "modelos"} · ${configurationCount} ${configurationCount === 1 ? "configuración" : "configuraciones"}${context ? ` en ${context}` : ""}`;
  ui.filterPreviewCount.textContent = `${products.length} ${products.length === 1 ? "resultado" : "resultados"} con esta selecci\u00f3n`;

  // Search live counter
  if (query && ui.searchLiveCount) {
    ui.searchLiveCount.textContent = `${products.length}`;
    ui.searchLiveCount.classList.add("is-active");
  } else if (ui.searchLiveCount) {
    ui.searchLiveCount.classList.remove("is-active");
  }

  if (!products.length) {
    ui.products.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-icon icon-search"></div>
          <strong>No encontramos esa combinaci\u00f3n.</strong>
          <p>Prob\u00e1 con menos palabras, otro color o quitando alg\u00fan filtro.</p>
          <button class="empty-clear-action" type="button" data-empty-clear>Ver todos los productos</button>
        </div>
      </div>
    `;
    return;
  }

  ui.products.innerHTML = groups.map(productCard).join("");
}

function updateSortLabel() {
  const labels = {
    catalog: ui.search.value.trim() ? "Relevancia ▾" : "Ordenar ▾",
    "price-asc": "Menor precio",
    "price-desc": "Mayor precio",
  };
  ui.sortTrigger.textContent = labels[ui.sort.value] ?? "Ordenar";
}

function renderCatalogStatus() {
  const source = window.STOCK_DB ?? {};
  const rawDate =
    source.updatedAt ?? source.lastUpdated ?? source.stockUpdatedAt ?? null;

  if (rawDate) {
    const date = new Date(rawDate);
    if (!Number.isNaN(date.getTime())) {
      const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
      const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      ui.catalogStatus.textContent = minutes < 60
        ? `Actualizado hace ${minutes || 1} min`
        : `Stock actualizado ${date.toDateString() === new Date().toDateString() ? "hoy" : date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} · ${time}`;
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
    applyPriceSettings(
      {
        percentage: ui.adminProfit.value,
        showPrice: ui.adminShowPrice.value === "S",
        showAvailableUnits: ui.adminShowUnits.value === "S",
      },
      { persist: true },
    );
    renderEverything({ refreshFilters: true });
    closeSheet();
    showToast("Variables actualizadas", "success");
  } catch (error) {
    showToast(error.message || "Revis\u00e1 los valores ingresados", "error");
    ui.adminProfit.focus();
  }
}

function downloadVariablesFile() {
  const blob = new Blob([variablesFileContent()], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "variable_precios.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Archivo variable_precios.md descargado", "success");
}

function showToast(message, type = "default") {
  const icons = {
    success: "\u2713",
    error: "\u26a0",
    info: "\u2139",
    default: "",
  };
  const icon = icons[type] || "";
  ui.toast.className = `toast toast-${type}`;
  ui.toast.innerHTML = icon
    ? `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`
    : escapeHtml(message);
  ui.toast.classList.add("is-visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(
    () => ui.toast.classList.remove("is-visible"),
    1600,
  );
}

function openVariantSheet(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  const variants = getVariants(product);
  const selected = getSelectedVariant(product);

  ui.variantSheetTitle.textContent = product.model;
  ui.variantSheetSubtitle.textContent =
    variants.length > 1
      ? "Elegí color / variante disponible"
      : "Variante disponible";
  ui.variantList.innerHTML = variants
    .map((variant) => {
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
    })
    .join("");

  openSheet(ui.variantSheet);
  state.variantProductId = productId;
}

function selectVariant(color) {
  const productId = state.variantProductId;
  if (!productId) return;

  selectedColors.set(productId, color);
  closeSheet();
  renderProducts();
  showToast(`Variante: ${color}`, "info");
}

function toggleCompare(productId) {
  const index = state.compareIds.indexOf(productId);

  if (index >= 0) {
    state.compareIds.splice(index, 1);
  } else {
    if (state.compareIds.length >= 3) {
      showToast("Pod\u00e9s comparar hasta 3 productos.", "error");
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
  ui.compareBar.hidden = count < 2;
  ui.navCompare.hidden = count < 2;
  ui.compareBarTitle.textContent =
    count === 1 ? "1 producto para comparar" : `Comparar ${count} productos`;
  ui.compareBarSubtitle.textContent =
    count < 2 ? "Sumá otra alternativa" : "Ver diferencias clave";
  ui.compareSheetSubtitle.textContent = count
    ? `${count} ${count === 1 ? "producto seleccionado" : "productos seleccionados"}`
    : "Seleccioná entre 2 y 3 productos";
  ui.copyCompare.disabled = count < 2;
  ui.clearCompare.disabled = count === 0;

  if (!count) {
    ui.compareBody.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-icon icon-compare"></div>
          <strong>Todav\u00eda no hay productos para comparar.</strong>
          <p>Eleg\u00ed "Comparar" en 2 o 3 alternativas y las vas a ver ac\u00e1.</p>
        </div>
      </div>
    `;
    return;
  }

  const columns = count;
  const gridStyle = `grid-template-columns: 104px repeat(${columns}, minmax(138px, 1fr));`;

  const modelCells = products
    .map((product) => {
      const variant = getSelectedVariant(product);
      return `
      <div class="compare-cell compare-product">
        <button class="compare-remove" type="button" data-remove-compare="${escapeHtml(product.id)}" aria-label="Quitar ${escapeHtml(product.model)}">×</button>
        <strong>${escapeHtml(product.model)}</strong>
        <span>${escapeHtml(product.brand)} · ${escapeHtml(variant.color)}</span>
      </div>
    `;
    })
    .join("");

  ui.compareBody.innerHTML = `
    <div class="compare-scroll">
      <div class="compare-grid" style="${gridStyle}">
        <div class="compare-cell compare-label">Producto</div>
        ${modelCells}
        ${compareRow(
          "Almacenamiento",
          products.map((product) =>
            escapeHtml(
              product.memory?.storageGb != null
                ? memoryLabel(product.memory.storageGb)
                : "—",
            ),
          ),
        )}
        ${compareRow(
          "RAM",
          products.map((product) =>
            escapeHtml(
              product.memory?.ramGb != null
                ? memoryLabel(product.memory.ramGb)
                : "—",
            ),
          ),
        )}
        ${compareRow(
          "Chip",
          products.map((product) => escapeHtml(product.chip || "—")),
        )}
        ${compareRow(
          "Conectividad",
          products.map((product) =>
            escapeHtml(toArray(product.connectivity).join(" · ") || "—"),
          ),
        )}
        ${compareRow(
          "Color",
          products.map((product) =>
            escapeHtml(getSelectedVariant(product).color),
          ),
        )}
        ${compareRow(
          "Stock",
          products.map((product) => {
            const availability = getAvailability(product);
            return `<span class="availability ${availability.className}">${escapeHtml(availability.label)}</span>`;
          }),
        )}
        ${
          priceSettings.showPrice
            ? compareRow(
                "Precio",
                products.map((product) =>
                  escapeHtml(formatMoney(getSelectedPrice(product))),
                ),
                "compare-price",
              )
            : ""
        }
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
      product.memory?.storageGb != null
        ? memoryLabel(product.memory.storageGb)
        : null,
      product.memory?.ramGb != null
        ? `${memoryLabel(product.memory.ramGb)} RAM`
        : null,
      product.chip,
      variant.color,
    ]
      .filter(Boolean)
      .join(" · ");

    const price = priceSettings.showPrice
      ? `${formatMoney(variant.priceUsd)} · `
      : "";
    return `${index + 1}. ${product.brand} ${product.model}\n${specs}\n${price}${availability.label}`;
  });

  await copyText(
    ["Comparación Prime Store", "", ...lines].join("\n\n"),
    "Comparación copiada",
  );
}

function addProduct(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  const variant = getSelectedVariant(product);
  const availability = getAvailability(product, variant);
  if (!availability.available) {
    showToast("Esa variante no tiene stock.", "error");
    return;
  }

  const key = `${product.id}::${variant.color}`;
  const current = selectedItems.get(key);
  const nextQuantity = (current?.quantity ?? 0) + 1;

  if (availability.quantity != null && nextQuantity > availability.quantity) {
    showToast(
      `Solo hay ${availability.quantity} ${availability.quantity === 1 ? "unidad disponible" : "unidades disponibles"}.`,
      "error",
    );
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
  showToast("Agregado al pedido", "success");
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
    showToast(
      `Solo hay ${item.maxQuantity} ${item.maxQuantity === 1 ? "unidad disponible" : "unidades disponibles"}.`,
      "error",
    );
    return;
  }

  item.quantity = next;
  renderOrder();
}

function orderTotals() {
  const entries = [...selectedItems.values()];
  const units = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce(
    (sum, item) => sum + Number(item.priceUsd ?? 0) * item.quantity,
    0,
  );
  return { entries, units, total };
}

function renderOrder() {
  const { entries, units, total } = orderTotals();

  ui.orderBadge.hidden = units === 0;
  ui.orderBadge.textContent = units;
  ui.orderBar.hidden = units === 0;
  ui.orderBarTitle.textContent = `${units} ${units === 1 ? "producto" : "productos"}${priceSettings.showPrice ? ` · ${formatMoney(total)}` : ""}`;
  ui.orderBarSubtitle.textContent = "Pedido en curso";
  ui.orderSheetSubtitle.textContent = units
    ? `${units} ${units === 1 ? "unidad" : "unidades"}`
    : "Todavía no agregaste productos";
  ui.total.textContent = formatMoney(total);
  ui.copyOrder.disabled = !entries.length;
  ui.clearOrder.disabled = !entries.length;

  if (!entries.length) {
    ui.selected.innerHTML = `
      <div class="empty-state">
        <div>
          <div class="empty-icon icon-bag"></div>
          <strong>Tu pedido est\u00e1 vac\u00edo.</strong>
          <p>Agreg\u00e1 una variante desde los resultados para armar una cotizaci\u00f3n r\u00e1pida.</p>
        </div>
      </div>
    `;
    return;
  }

  ui.selected.innerHTML = entries
    .map(
      (item) => `
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
  `,
    )
    .join("");
}

async function copyOrder() {
  const { entries, total } = orderTotals();
  if (!entries.length) return;

  const lines = entries.map((item) => {
    const unitPrice = formatMoney(item.priceUsd);
    const lineTotal = formatMoney(Number(item.priceUsd ?? 0) * item.quantity);
    const price = priceSettings.showPrice
      ? ` | ${unitPrice}${item.quantity > 1 ? ` c/u | ${lineTotal}` : ""}`
      : "";
    return `- ${item.quantity}x ${item.brand} ${item.model} | ${item.selectedColor}${price}`;
  });

  const totalLine = priceSettings.showPrice
    ? [`Total: ${formatMoney(total)}`]
    : [];
  await copyText(
    ["Pedido Prime Store", ...lines, ...totalLine].join("\n"),
    "Pedido copiado",
  );
}

async function copyProduct(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) return;

  const variant = getSelectedVariant(product);
  const availability = getAvailability(product, variant);
  const details = [
    product.memory?.storageGb != null
      ? memoryLabel(product.memory.storageGb)
      : null,
    product.memory?.ramGb != null
      ? `${memoryLabel(product.memory.ramGb)} RAM`
      : null,
    ...toArray(product.connectivity),
    variant.color,
  ]
    .filter(Boolean)
    .join(" · ");

  const text = [
    `${product.brand} ${product.model}`,
    details,
    priceSettings.showPrice
      ? `${formatMoney(variant.priceUsd)} · ${availability.label}`
      : availability.label,
  ]
    .filter(Boolean)
    .join("\n");

  await copyText(text, "Producto copiado");
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, "success");
  } catch {
    window.prompt("Copiá el texto:", text);
  }
}

function clearAdvancedFilters({ keepSearch = true, keepQuick = true } = {}) {
  for (const key of FILTER_KEYS) ui[key].value = "";
  ui.priceMin.value = "";
  ui.priceMax.value = "";
  ui.sort.value = "catalog";
  if (!keepSearch) ui.search.value = "";
  if (!keepQuick) {
    state.navGroup = "";
    state.navBrand = "";
    state.navType = "";
    state.navFamily = "";
  }
  refreshFilterOptions();
  renderEverything();
}

function updateCatalog({ refreshFilters = true } = {}) {
  if (refreshFilters) refreshFilterOptions();
  renderEverything();
}

function setNavigation(level, value) {
  if (level === "brand") {
    state.navBrand = value;
    state.navFamily = "";
  } else if (level === "type") {
    state.navType = value;
    state.navFamily = "";
  } else if (level === "family") state.navFamily = value;
  if (!state.navBrand) ui.search.placeholder = "Buscar modelo, capacidad, color o SIM…";
  refreshFilterOptions();
  renderEverything();
}

function setDeviceGroup(value) {
  state.navGroup = value;
  state.navType = "";
  state.navBrand = "";
  state.navFamily = "";
  refreshFilterOptions();
  renderEverything();
}

function removeFilter(key) {
  if (key === "price") {
    ui.priceMin.value = "";
    ui.priceMax.value = "";
    refreshFilterOptions();
    renderEverything();
    return;
  }
  if (!FILTER_KEYS.includes(key)) return;
  ui[key].value = "";
  refreshFilterOptions();
  renderEverything();
}

let searchDebounceTimer = null;
ui.search.addEventListener("input", () => {
  ui.searchClear.hidden = !ui.search.value;
  window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    refreshFilterOptions();
    renderEverything();
  }, 150);
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
  const button = event.target.closest("[data-nav-group]");
  if (button) setDeviceGroup(button.dataset.navGroup);
});
ui.modelFilters.addEventListener("click", (event) => {
  const type = event.target.closest("[data-nav-type]");
  if (type) setNavigation("type", type.dataset.navType);
});
ui.navContext.addEventListener("click", (event) => {
  const crumb = event.target.closest("[data-breadcrumb]");
  if (!crumb) return;
  if (crumb.dataset.breadcrumb === "group") setDeviceGroup(state.navGroup);
  else if (crumb.dataset.breadcrumb === "root") {
    state.navBrand = "";
    state.navType = "";
    state.navFamily = "";
    refreshFilterOptions();
    renderEverything();
  } else if (crumb.dataset.breadcrumb === "brand") {
    state.navType = "";
    state.navFamily = "";
    refreshFilterOptions();
    renderEverything();
  }
  else if (crumb.dataset.breadcrumb === "type") setNavigation("type", state.navType);
  else renderEverything();
});

ui.activeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-filter]");
  if (button) removeFilter(button.dataset.removeFilter);
});

for (const key of FILTER_KEYS) {
  ui[key].addEventListener("change", () =>
    updateCatalog({ refreshFilters: true }),
  );
}
[ui.priceMin, ui.priceMax].forEach((input) => input.addEventListener("input", () => updateCatalog({ refreshFilters: false })));

ui.sort.addEventListener("change", () => renderEverything());
ui.sortTrigger.addEventListener("click", () => openSheet(ui.filtersSheet));
ui.openFilters.addEventListener("click", () => openSheet(ui.filtersSheet));
ui.applyFilters.addEventListener("click", () => closeSheet());
ui.clearFilters.addEventListener("click", () =>
  clearAdvancedFilters({ keepSearch: true, keepQuick: true }),
);

ui.products.addEventListener("click", (event) => {
  const modelCard = event.target.closest(".grouped-product[data-model-key]");
  const bodyNavigation = event.target.closest("[data-body-nav]");
  const attributeFilter = event.target.closest("[data-filter-key]");
  const expandModel = event.target.closest("[data-expand-model]");
  const emptyAction = event.target.closest("[data-empty-clear]");
  const cardVariant = event.target.closest("[data-card-variant-product]");
  const variant = event.target.closest("[data-open-variant]");
  const compare = event.target.closest("[data-compare]");
  const copy = event.target.closest("[data-copy-product]");
  const add = event.target.closest("[data-add]");
  const addVariant = event.target.closest("[data-add-variant]");

  if (attributeFilter) {
    const key = attributeFilter.dataset.filterKey;
    if (FILTER_KEYS.includes(key)) {
      const clear = attributeFilter.classList.contains("is-active");
      ui[key].value = clear ? "" : attributeFilter.dataset.filterValue || "";
      updateCatalog({ refreshFilters: true });
      showToast(clear ? "Filtro quitado" : `${attributeFilter.dataset.filterValue} aplicado`, "info");
    }
  } else if (bodyNavigation) {
    setNavigation(bodyNavigation.dataset.bodyNav, bodyNavigation.dataset.bodyValue);
  } else if (expandModel) {
    const key = expandModel.dataset.expandModel;
    if (state.expandedModels.has(key)) state.expandedModels.delete(key);
    else state.expandedModels.add(key);
    renderProducts();
  } else if (emptyAction) {
    ui.search.value = "";
    ui.searchClear.hidden = true;
    state.navGroup = "";
    state.navBrand = "";
    state.navType = "";
    state.navFamily = "";
    for (const key of FILTER_KEYS) ui[key].value = "";
    ui.sort.value = "catalog";
    refreshFilterOptions();
    renderEverything();
  } else if (addVariant) {
    selectedColors.set(addVariant.dataset.addVariant, addVariant.dataset.addColor);
    addProduct(addVariant.dataset.addVariant);
  } else if (cardVariant) {
    selectedColors.set(
      cardVariant.dataset.cardVariantProduct,
      cardVariant.dataset.cardVariantColor,
    );
    renderProducts();
    renderCompare();
  } else if (variant) openVariantSheet(variant.dataset.openVariant);
  else if (compare) {
    if (compare.dataset.actionColor) selectedColors.set(compare.dataset.compare, compare.dataset.actionColor);
    toggleCompare(compare.dataset.compare);
  }
  else if (copy) {
    if (copy.dataset.actionColor) selectedColors.set(copy.dataset.copyProduct, copy.dataset.actionColor);
    copyProduct(copy.dataset.copyProduct);
  }
  else if (add) addProduct(add.dataset.add);
  else if (modelCard) {
    const key = modelCard.dataset.modelKey;
    if (state.expandedModels.has(key)) state.expandedModels.delete(key);
    else state.expandedModels.add(key);
    renderProducts();
  }
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
  state.compareIds = state.compareIds.filter(
    (id) => id !== button.dataset.removeCompare,
  );
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
$$("[data-close-sheet]").forEach((button) =>
  button.addEventListener("click", () => closeSheet()),
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.activeSheet) closeSheet();
});

// --- Admin reveal on triple-click ---
let adminClickCount = 0;
let adminClickTimer = null;
if (ui.brandLockup) {
  ui.brandLockup.addEventListener("click", () => {
    adminClickCount++;
    window.clearTimeout(adminClickTimer);
    adminClickTimer = window.setTimeout(() => {
      adminClickCount = 0;
    }, 600);
    if (adminClickCount >= 3) {
      adminClickCount = 0;
      ui.openAdmin.classList.toggle("is-revealed");
      if (ui.openAdmin.classList.contains("is-revealed")) {
        showToast("Panel Admin desbloqueado", "info");
      }
    }
  });
}

function updateBrandSubtitle() {
  if (ui.brandSubtitle) {
    const models = groupVisibleProducts(allProducts).length;
    ui.brandSubtitle.textContent = `${models} modelos · ${allProducts.length} configuraciones`;
  }
}

async function initializeWidget() {
  try {
    await loadPriceVariables();
  } catch (error) {
    console.error(
      "No se pudo aplicar la variable de ganancia; se mostrar\u00e1n precios de lista.",
      error,
    );
    const overrides = readAdminOverrides();
    if (overrides) applyPriceSettings(overrides);
  }

  renderCatalogStatus();
  updateBrandSubtitle();
  refreshFilterOptions();
  renderEverything();
}

initializeWidget();

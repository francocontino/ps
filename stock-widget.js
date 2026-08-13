const all_products = window.STOCK_DB?.products ?? [];

if (!all_products.length) {
  throw new Error("No se pudo cargar la base de stock (window.STOCK_DB).");
}

const $ = (selector) => document.querySelector(selector);
const ui = {
  deviceType: $("#deviceType"),
  brand: $("#brand"),
  model: $("#model"),
  storage: $("#storage"),
  ram: $("#ram"),
  chip: $("#chip"),
  color: $("#color"),
  search: $("#search"),
  sort: $("#sort"),
  products: $("#products"),
  resultCount: $("#resultCount"),
  clearFilters: $("#clearFilters"),
  selected: $("#selected"),
  orderCount: $("#orderCount"),
  total: $("#total"),
  copyOrder: $("#copyOrder"),
  stockBadge: $("#stockBadge"),
};

const selectedItems = new Map();
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const unique = (values) => [...new Set(values.filter((value) => value != null && value !== ""))];
const naturalSort = (a, b) => String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const memoryLabel = (gb) => gb == null ? "" : gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
const toArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];

function getModelFamily(product) {
  const model = String(product.model ?? "").trim();
  const patterns = [
    [/^(\d+E?)\b/i, (match) => product.brand === "Apple" && product.deviceType === "smartphone" ? `iPhone ${match[1].toUpperCase()}` : match[1].toUpperCase()],
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

function getLowestVariantPrice(product) {
  const prices = (product.variants ?? []).map((variant) => Number(variant.priceUsd ?? 0)).filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : Number(product.priceUsd ?? 0) || 0;
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

function productMatchesFilters(product, filters, includeSearch = true) {
  const query = normalize(ui.search.value.trim());
  const searchableText = [product.brand, product.model, product.chip, ...(product.colors ?? [])].join(" ");

  return (
    (!filters.deviceType || product.deviceType === filters.deviceType) &&
    (!filters.brand || product.brand === filters.brand) &&
    (!filters.model || getModelFamily(product) === filters.model) &&
    (!filters.storage || Number(product.memory?.storageGb) === Number(filters.storage)) &&
    (!filters.ram || Number(product.memory?.ramGb) === Number(filters.ram)) &&
    (!filters.chip || product.chip === filters.chip) &&
    (!filters.color || (product.colors ?? []).includes(filters.color)) &&
    (!includeSearch || !query || normalize(searchableText).includes(query))
  );
}

function fillSelect(element, values, label, format = (value) => value) {
  if (!element) return;

  const current = element.value;
  const list = [...new Set(values.filter((value) => value != null && value !== ""))]
    .sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : naturalSort(a, b)));

  element.innerHTML = `<option value="">${label}</option>${list
    .map((value) => `<option value="${escapeHtml(String(value))}">${escapeHtml(format(value))}</option>`)
    .join("")}`;
  element.disabled = list.length === 0;
  element.value = list.map(String).includes(String(current)) ? current : "";
}

function getFilterValues(key, products) {
  const values = products.flatMap((product) => {
    if (key === "deviceType") return product.deviceType ? [product.deviceType] : [];
    if (key === "brand") return product.brand ? [product.brand] : [];
    if (key === "model") return product.model ? [getModelFamily(product)] : [];
    if (key === "storage") return product.memory?.storageGb != null ? [product.memory.storageGb] : [];
    if (key === "ram") return product.memory?.ramGb != null ? [product.memory.ramGb] : [];
    if (key === "chip") return product.chip ? [product.chip] : [];
    if (key === "color") return product.colors ?? [];
    if (key === "connectivity") return product.connectivity ?? [];
    return [];
  });
  return unique(values);
}

function refreshFilterOptions() {
  const filterLabels = {
    deviceType: "Todos los dispositivos",
    brand: "Todas las marcas",
    model: "Todos los modelos",
    storage: "Todo almacenamiento",
    ram: "Toda memoria RAM",
    chip: "Todos los chips",
    color: "Todos los colores",
    connectivity: "Toda la conectividad",
  };

  const formatters = {
    storage: memoryLabel,
    ram: memoryLabel,
  };

  for (const key of ["deviceType", "brand", "model", "storage", "ram", "chip", "color"]) {
    const candidates = all_products.filter((product) => productMatchesFilters(product, selectedFilters(key), false));
    const values = getFilterValues(key, candidates);
    fillSelect(ui[key], values, filterLabels[key], formatters[key] ?? ((value) => value));
  }
}

function specsFor(product) {
  return [
    product.memory?.ramGb != null ? `${memoryLabel(product.memory.ramGb)} RAM` : null,
    product.memory?.storageGb != null ? memoryLabel(product.memory.storageGb) : null,
    product.chip,
    ...(Array.isArray(product.connectivity) ? product.connectivity : []),
  ].filter(Boolean);
}

function visibleProducts() {
  const products = all_products.filter((product) => productMatchesFilters(product, selectedFilters()));

  if (ui.sort.value === "price-asc") return [...products].sort((a, b) => getLowestVariantPrice(a) - getLowestVariantPrice(b));
  if (ui.sort.value === "price-desc") return [...products].sort((a, b) => getLowestVariantPrice(b) - getLowestVariantPrice(a));

  return [...products].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "es", { numeric: true }));
}

function renderProducts() {
  const products = visibleProducts();
  ui.resultCount.textContent = `${products.length} ${products.length === 1 ? "opción encontrada" : "opciones encontradas"}`;

  if (!products.length) {
    ui.products.innerHTML = '<p class="empty">No existe una combinación con esos filtros. Probá quitar una especificación.</p>';
    return;
  }

  ui.products.innerHTML = products.map((product) => {
    const specs = specsFor(product).map((spec) => `<span class="spec">${escapeHtml(spec)}</span>`).join("");
    const colors = unique((product.colors ?? []).filter(Boolean));
    const colorOptions = colors.map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join("");

    return `
      <article class="product">
        <div class="product-top"><span class="brand">${escapeHtml(product.brand)}</span><span class="type">${escapeHtml(product.deviceType)}</span></div>
        <h2>${escapeHtml(product.model)}</h2>
        <div class="specs">${specs || '<span class="spec">Configuración única</span>'}</div>
        <div class="variant">
          <label for="color-${product.id}">Color disponible</label>
          <select id="color-${product.id}" data-product-color="${product.id}">${colorOptions}</select>
        </div>
        <div class="product-footer">
          <span class="price">${money.format(getLowestVariantPrice(product))}</span>
          <button class="add" type="button" data-add="${product.id}">Agregar</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderOrder() {
  const entries = [...selectedItems.values()];
  const units = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce((sum, item) => sum + Number(item.priceUsd ?? 0) * item.quantity, 0);
  ui.orderCount.textContent = `${units} ${units === 1 ? "unidad" : "unidades"}`;
  ui.total.textContent = money.format(total);
  ui.copyOrder.disabled = !entries.length;

  if (!entries.length) {
    ui.selected.innerHTML = '<p class="empty">Elegí un modelo para comenzar.</p>';
    return;
  }

  ui.selected.innerHTML = entries.map((item) => `
    <article class="selected-item">
      <p class="selected-name">${escapeHtml(item.brand)} ${escapeHtml(item.model)}</p>
      <p class="selected-variant">${escapeHtml([specsFor(item).join(" · "), item.selectedColor].filter(Boolean).join(" · "))}</p>
      <div class="selected-controls">
        <div class="quantity">
          <button type="button" data-change="-1" data-key="${escapeHtml(item.key)}" aria-label="Restar">−</button>
          <strong>${item.quantity}</strong>
          <button type="button" data-change="1" data-key="${escapeHtml(item.key)}" aria-label="Sumar">+</button>
        </div>
        <button class="remove" type="button" data-remove="${escapeHtml(item.key)}">Quitar</button>
      </div>
    </article>
  `).join("");
}

function addProduct(id) {
  const product = all_products.find((item) => item.id === id);
  if (!product) return;

  const selectedColor = document.querySelector(`[data-product-color="${CSS.escape(id)}"]`)?.value ?? product.colors?.[0] ?? "Standard";
  const key = `${id}::${selectedColor}`;
  const current = selectedItems.get(key);
  const selectedPrice = product.variants?.find((variant) => variant.color === selectedColor)?.priceUsd ?? getLowestVariantPrice(product);

  selectedItems.set(key, {
    ...product,
    key,
    selectedColor,
    quantity: (current?.quantity ?? 0) + 1,
    priceUsd: Number(selectedPrice ?? 0),
  });

  renderOrder();
}

function changeQuantity(key, difference) {
  const item = selectedItems.get(key);
  if (!item) return;

  item.quantity += difference;
  if (item.quantity < 1) selectedItems.delete(key);
  renderOrder();
}

async function copyOrder() {
  const entries = [...selectedItems.values()];
  const total = entries.reduce((sum, item) => sum + Number(item.priceUsd ?? 0) * item.quantity, 0);
  const lines = entries.map((item) => `- ${item.quantity}x ${item.brand} ${item.model}${item.selectedColor ? ` | ${item.selectedColor}` : ""} | ${money.format(Number(item.priceUsd ?? 0) * item.quantity)}`);
  const text = ["Pedido:", ...lines, `Total: ${money.format(total)}`].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    ui.copyOrder.textContent = "¡Pedido copiado!";
  } catch {
    window.prompt("Copiá el pedido:", text);
  }

  setTimeout(() => { ui.copyOrder.textContent = "Copiar pedido"; }, 1600);
}

function updateCatalog() {
  refreshFilterOptions();
  renderProducts();
}

for (const element of [ui.deviceType, ui.brand, ui.model, ui.storage, ui.ram, ui.chip, ui.color, ui.sort]) {
  element.addEventListener("change", updateCatalog);
}

ui.search.addEventListener("input", renderProducts);
ui.clearFilters.addEventListener("click", () => {
  for (const element of [ui.deviceType, ui.brand, ui.model, ui.storage, ui.ram, ui.chip, ui.color]) element.value = "";
  ui.search.value = "";
  ui.sort.value = "catalog";
  refreshFilterOptions();
  renderProducts();
});
ui.products.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addProduct(button.dataset.add);
});
ui.selected.addEventListener("click", (event) => {
  const change = event.target.closest("[data-change]");
  const remove = event.target.closest("[data-remove]");
  if (change) changeQuantity(change.dataset.key, Number(change.dataset.change));
  if (remove) {
    selectedItems.delete(remove.dataset.remove);
    renderOrder();
  }
});
ui.copyOrder.addEventListener("click", copyOrder);
ui.stockBadge.textContent = `${all_products.length} productos disponibles`;
refreshFilterOptions();
renderProducts();
renderOrder();

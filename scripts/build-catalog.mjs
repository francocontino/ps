import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceFile = resolve(root, "stock.md");
const outputFile = resolve(root, "src/data/catalog.js");
const browserOutputFile = resolve(root, "src/data/catalog.browser.js");

const sectionMarkers = [
  ["*APPLE NEW*", "apple_new"],
  ["*📲 IPHONE (Reacondicionados x apple) CPO*", "apple_cpo"],
  ["*SAMSUNG* *SmartWatch* *Tablet*", "samsung"],
  ["*XIAOMI*", "xiaomi"],
  ["*MOTOROLA*", "motorola"],
  ["📱 *IPADS-AIRPODS-WATCH*", "apple_accessories"],
  ["💻 *MACBOOK*", "mac"],
  ["🎮Sony PlayStation", "gaming"],
  ["👓 RAYBAN META", "smart_glasses"],
  ["*CÁMARAS DEPORTIVAS*", "cameras"],
  ["*DRONES*", "drones"],
  ["*MICRÓFONOS INALÁMBRICOS*", "microphones"],
  ["⌚ * RELOJES GARMIN*", "garmin"],
  ["🔥JBL Charge", "jbl"],
  ["*NOTEBOOK*", "notebooks"],
];

const subSections = new Map([
  ["*Tablet*", "samsung_tablets"],
  ["*SmartWatch Samsung*", "samsung_watches"],
]);

const categoryLabels = {
  apple_new: "Apple nuevos",
  apple_cpo: "iPhone reacondicionados Apple CPO",
  samsung: "Samsung",
  samsung_tablets: "Tablets Samsung",
  samsung_watches: "Smartwatches Samsung",
  xiaomi: "Xiaomi",
  motorola: "Motorola",
  apple_accessories: "iPad, AirPods y Apple Watch",
  mac: "Mac y MacBook",
  gaming: "Consolas y gaming",
  smart_glasses: "Anteojos inteligentes",
  cameras: "Cámaras deportivas",
  drones: "Drones",
  microphones: "Micrófonos inalámbricos",
  garmin: "Relojes Garmin",
  jbl: "JBL",
  notebooks: "Notebooks",
};

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

const colorAliases = {
  "Space Black": ["space black"], "Space Gray": ["space gray", "space grey"],
  "Mist Blue": ["mist blue"], "Sky Blue": ["sky blue"], "Light Blue": ["light blue"],
  "Silver Blue": ["silverblue"], "Rose Gold": ["rose gold"], "Light Gray": ["lightgray", "light gray"],
  "Sage Green": ["sage green"], "Graphite": ["graphite", "grafite"],
  "Midnight": ["midnight"], "Starlight": ["starlight"], "Ultramarine": ["ultramarine"],
  "Black": ["black", "negro"], "White": ["white", "blanco"], "Blue": ["blue", "azul", "celeste"],
  "Silver": ["silver", "plata"], "Gray": ["gray", "grey", "gris", "gary"],
  "Green": ["green", "verde"], "Purple": ["purple", "violet", "violeta", "lilac", "lilca"],
  "Pink": ["pink", "rosa"], "Orange": ["orange", "naranja"], "Gold": ["gold", "oro"],
  "Red": ["red", "rojo", "cereza", "arandano", "arándano"], "Yellow": ["yellow", "amarillo"],
  "Teal": ["teal", "cyan"], "Cream": ["cream"], "Khaki": ["khaki"],
  "Navy": ["navy"], "Lavender": ["lavender"], "Citrus": ["citrus"],
  "Indigo": ["indigo", "índigo"], "Blush": ["blush"], "Camo": ["camo"],
};

function getBrand(description, category) {
  if (["apple_new", "apple_cpo", "apple_accessories", "mac"].includes(category)) return "Apple";
  if (category.startsWith("samsung")) return "Samsung";
  if (category === "xiaomi") return "Xiaomi";
  if (category === "motorola") return "Motorola";
  if (category === "garmin") return "Garmin";
  if (category === "jbl") return "JBL";
  if (["drones", "microphones"].includes(category)) return "DJI";
  if (category === "gaming" && /^JOYSTICK PS5\b/i.test(description)) return "Sony";
  const known = ["Sony", "Nintendo", "Logitech", "WD_Black", "Rayban", "Oakley", "GoPro", "DJI", "INSTA360", "Acer", "Asus", "Dell", "Lenovo", "HP"];
  return known.find((brand) => description.toLowerCase().includes(brand.toLowerCase()))?.replace("Rayban", "Ray-Ban") ?? "Otra";
}

function getDeviceType(description, category) {
  const text = description.toLowerCase();
  if (["apple_new", "apple_cpo", "samsung", "motorola"].includes(category)) {
    if (/buds/.test(text)) return "auriculares";
    return "smartphone";
  }
  if (category === "xiaomi") return /pad/.test(text) ? "tablet" : "smartphone";
  if (category === "samsung_tablets") return "tablet";
  if (["samsung_watches", "garmin"].includes(category)) return "smartwatch";
  if (category === "apple_accessories") {
    if (/ipad/.test(text)) return "tablet";
    if (/airpods/.test(text)) return "auriculares";
    if (/watch/.test(text)) return "smartwatch";
    if (/pencil/.test(text)) return "stylus";
    if (/airtag/.test(text)) return "localizador";
  }
  if (category === "mac") return /mac mini/.test(text) ? "computadora_escritorio" : "notebook";
  if (category === "notebooks") return "notebook";
  if (category === "smart_glasses") return "anteojos_inteligentes";
  if (category === "cameras") return "camara";
  if (category === "drones") return /goggles/.test(text) ? "accesorio_drone" : "drone";
  if (category === "microphones") return "microfono";
  if (category === "jbl") return /earbuds/.test(text) ? "auriculares" : "parlante";
  if (category === "gaming") {
    if (/playstation|nintendo switch/.test(text)) return "consola";
    if (/joystick/.test(text)) return "control";
    return "accesorio_gaming";
  }
  return "otro";
}

function extractMemory(description) {
  const text = description.toUpperCase();
  const paired = text.match(/(\d+)\s*(?:GB)?\s*[+/]\s*(\d+)\s*(GB|TB|SSD)?/);
  if (paired) {
    const first = Number(paired[1]);
    const second = Number(paired[2]);
    const storageFirst = first > 64 && second <= 64;
    return {
      ramGb: storageFirst ? second : first,
      storageGb: (storageFirst ? first : second) * (paired[3] === "TB" ? 1024 : 1),
    };
  }
  const separated = text.match(/(\d+)\s*GB\s+(\d+)\s*(GB|TB)/);
  if (separated) {
    return {
      ramGb: Number(separated[1]),
      storageGb: Number(separated[2]) * (separated[3] === "TB" ? 1024 : 1),
    };
  }
  const storage = text.match(/(?:^|\s)(\d+)\s*(GB|TB)(?!\s*\+)/);
  return {
    ramGb: null,
    storageGb: storage ? Number(storage[1]) * (storage[2] === "TB" ? 1024 : 1) : null,
  };
}

function extractChip(description) {
  const patterns = [
    /\b(?:APPLE\s+)?(?:M[1-9]|A\d{2})\b/i,
    /\bAMD RYZEN(?: AI)? [3579](?:[- ]\w+)?/i,
    /\bRYZEN(?: AI)? [3579](?:[- ]\w+)?/i,
    /\bINTEL (?:CORE )?(?:ULTRA )?[I3579]\s*[- ]?\d*[A-Z]*/i,
    /\bCORE (?:ULTRA )?[I3579]\s*[- ]?\d*[A-Z]*/i,
    /\bI[3579]-\d+[A-Z]*/i,
  ];
  return patterns.map((pattern) => description.match(pattern)?.[0]).find(Boolean) ?? null;
}

function extractColors(description) {
  const normalized = ` ${description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()} `;
  return Object.entries(colorAliases)
    .filter(([, aliases]) => aliases.some((alias) => new RegExp(`(?:^|[^a-z])${alias.replace(" ", "\\s+")}(?:$|[^a-z])`, "i").test(normalized)))
    .map(([canonical]) => canonical)
    // Evita duplicados genéricos cuando existe un color compuesto.
    .filter((color, _, colors) => !colors.some((other) => other !== color && other.includes(color)));
}

function extractModel(description, deviceType, brand) {
  let model = description
    .replace(/(?:USD|U\$|\$)\s*[\d.]+.*$/i, "")
    .replace(/\b\d+\s*(?:GB)?\s*[+/]\s*\d+\s*(?:GB|TB|SSD)?\b.*$/i, "")
    .replace(/\b\d+\s*(?:GB|TB)\b.*$/i, "")
    .trim();
  if (brand !== "Otra") model = model.replace(new RegExp(`^${brand.replace("-", "[- ]?")}\\s*`, "i"), "");
  if (!model) model = description.split(/(?:USD|U\$|\$)/i)[0].trim();
  return model.replace(/[·▸-]+$/g, "").trim();
}

const clean = (line) => line
  .replace(/[📱📲▪️🎧⌚️⌚💻🎮💥👓🔥✅🖊️⭐️⭐]/gu, " ")
  .replace(/\*/g, "")
  .replace(/\s+/g, " ")
  .trim();

const slug = (text) => text
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 64);

function extractPrices(text) {
  const explicit = [...text.matchAll(/(?:USD|U\$|\$)\s*([\d.]+)/gi)]
    .map((match) => Number(match[1].replace(/\./g, "")))
    .filter((value) => value >= 15 && value <= 10000);

  if (explicit.length) return [...new Set(explicit)];

  // Algunas filas del proveedor omiten el símbolo de moneda.
  const candidates = [...text.matchAll(/(?:^|\s|▸)(\d{2,4})(?!\s*(?:GB|TB|MB|MM|SSD|CPU|GPU|K)\b)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 50 && value <= 3000);
  return candidates.length ? [candidates[0]] : [];
}

function isProduct(line, category) {
  if (!category || !line || /^_+$/.test(line) || /^____$/.test(line)) return false;
  if (/GARANT[IÍ]A/i.test(line)) return false;
  if (/^(✔️|⭐️Band|🔥Shiny|🔥Black\/|🔥White\/|\(Titanium)/.test(line)) return false;
  if (/^\*[^*]+\*\s*$/.test(line)) return false;
  return /[\d$]|USD|U\$/i.test(line) && /^[📱📲▪🎧⌚💻🎮💥👓🔥✅🖊]/u.test(line);
}

const markdown = await readFile(sourceFile, "utf8");
const collections = Object.fromEntries(Object.keys(categoryLabels).map((key) => [key, []]));
let category = null;
let pendingDetails = [];

for (const original of markdown.split(/\r?\n/)) {
  const line = original.trim();
  const exactSection = sectionMarkers.find(([marker]) => line.startsWith(marker));

  if (exactSection) {
    category = exactSection[1];
    // Hay marcadores que también contienen el primer producto.
    if (line !== exactSection[0] && !line.startsWith("🎮Sony") && !line.startsWith("🔥JBL")) continue;
  }
  if (subSections.has(line)) {
    category = subSections.get(line);
    continue;
  }
  if (!isProduct(line, category)) continue;

  const description = clean(line);
  const pricesUsd = extractPrices(description);
  const brand = getBrand(description, category);
  const deviceType = getDeviceType(description, category);
  const memory = extractMemory(description);
  const baseId = `${category}-${slug(description.replace(/(?:USD|U\$|\$).*$/i, ""))}`;
  const duplicate = collections[category].filter((item) => item.id.startsWith(baseId)).length;

  collections[category].push({
    id: duplicate ? `${baseId}-${duplicate + 1}` : baseId,
    category,
    deviceType,
    brand,
    model: extractModel(description, deviceType, brand),
    memory,
    chip: extractChip(description),
    colors: extractColors(description),
    description,
    priceUsd: pricesUsd[0] ?? null,
    pricesUsd,
    raw: line,
  });
}

const compareProducts = (a, b) =>
  collator.compare(a.deviceType, b.deviceType) ||
  collator.compare(a.brand, b.brand) ||
  collator.compare(a.model, b.model) ||
  (a.memory.storageGb ?? 0) - (b.memory.storageGb ?? 0) ||
  (a.memory.ramGb ?? 0) - (b.memory.ramGb ?? 0);

for (const products of Object.values(collections)) products.sort(compareProducts);

const banner = `// AUTO-GENERATED by scripts/build-catalog.mjs. Do not edit manually.\n// Source: stock.md\n\n`;
const declarations = Object.entries(collections)
  .map(([name, products]) => `export const ${name} = ${JSON.stringify(products, null, 2)};`)
  .join("\n\n");
const catalogEntries = Object.keys(collections).join(",\n  ");
const output = `${banner}${declarations}\n\nexport const category_labels = ${JSON.stringify(categoryLabels, null, 2)};\n\nexport const catalog_by_category = {\n  ${catalogEntries}\n};\n\nconst catalog_collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });\nconst catalog_sort = (a, b) => catalog_collator.compare(a.deviceType, b.deviceType) || catalog_collator.compare(a.brand, b.brand) || catalog_collator.compare(a.model, b.model) || (a.memory.storageGb ?? 0) - (b.memory.storageGb ?? 0) || (a.memory.ramGb ?? 0) - (b.memory.ramGb ?? 0);\nconst groupBy = (items, field) => items.reduce((groups, item) => { (groups[item[field]] ??= []).push(item); return groups; }, {});\n\nexport const all_products = Object.values(catalog_by_category).flat().sort(catalog_sort);\nexport const catalog_by_device_type = groupBy(all_products, "deviceType");\nexport const catalog_by_brand = groupBy(all_products, "brand");\n`;

await mkdir(resolve(root, "src/data"), { recursive: true });
await writeFile(outputFile, output);
const allProducts = Object.values(collections).flat().sort(compareProducts);
const browserOutput = `${banner}window.STOCK_DB = ${JSON.stringify({
  products: allProducts,
  categoryLabels,
}, null, 2)};\n`;
await writeFile(browserOutputFile, browserOutput);
console.log(`Generated ${outputFile} and ${browserOutputFile} with ${allProducts.length} products.`);

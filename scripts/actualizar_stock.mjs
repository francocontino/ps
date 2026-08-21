import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const oldFile = resolve(root, "stock.md");
const sourceFile = resolve(root, "private/texto-6E8227E2D050-1.txt");
const outputFile = resolve(root, "stock_2.md");
const reportFile = resolve(root, "stock_2.report.json");

const COLOR_ALIASES = {
  "Space Black": ["space black"], "Space Gray": ["space gray", "space grey"],
  "Mist Blue": ["mist blue"], "Sky Blue": ["sky blue"], "Light Blue": ["light blue"],
  "Silver Blue": ["silver blue", "silverblue"], "White Silver": ["white silver", "whitesilver"],
  "Rose Gold": ["rose gold"], "Pink Gold": ["pink gold"], "Sage Green": ["sage green"],
  "Light Gray": ["light gray", "lightgray"], "Jet Black": ["jet black", "jetblack"],
  "Chalky Grey": ["chalky grey"], "Mystic Violet": ["mystic violet"],
  "Graphite": ["graphite", "grafite"], "Midnight": ["midnight"], "Starlight": ["starlight"],
  "Ultramarine": ["ultramarine"], "Black": ["black", "negro"], "White": ["white", "blanco"],
  "Blue": ["blue", "azul", "celeste"], "Silver": ["silver", "plata"],
  "Gray": ["gray", "grey", "gris", "gary"], "Green": ["green", "verde"],
  "Purple": ["purple", "violet", "violeta", "lilac", "lilca", "uva"],
  "Pink": ["pink", "rosa"], "Orange": ["orange", "naranja"], "Gold": ["gold", "oro"],
  "Red": ["red", "rojo", "cereza", "arandano", "arándano"], "Yellow": ["yellow", "amarillo"],
  "Teal": ["teal", "cyan"], "Cream": ["cream"], "Khaki": ["khaki"], "Navy": ["navy"],
  "Lavender": ["lavender"], "Citrus": ["citrus"], "Indigo": ["indigo", "índigo"],
  "Blush": ["blush"], "Camo": ["camo"], "Desert": ["desert"], "Natural": ["natural"],
  "Charcoal": ["charcoal"], "Olive": ["olive"], "Sage": ["sage"], "Grafito": ["grafito"],
};

const COLOR_TERMS = Object.entries(COLOR_ALIASES)
  .flatMap(([name, aliases]) => aliases.map((alias) => ({ name, alias })))
  .sort((a, b) => b.alias.length - a.alias.length);

const normalize = (value) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(?:usd|u\$s|u\$)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

const clean = (line) => String(line)
  .replace(/^\s*\d+\s*\|\s*/, "")
  .replace(/[📱📲▪️🎧⌚️⌚💻🎮💥👓🔥✅🖊️⭐️⭐🔌]/gu, " ")
  .replace(/\*/g, "").replace(/\s+/g, " ").trim();

function detectSection(line, current = null) {
  const heading = clean(line).replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  if (/^APPLE NEW$/.test(heading)) return "apple_new";
  if (/IPHONE.*REACONDICIONADOS/.test(heading)) return "apple_cpo";
  if (/^SAMSUNG\b/.test(heading)) return "samsung";
  if (heading === "TABLET" && current?.startsWith("samsung")) return "samsung_tablets";
  if (heading === "SMARTWATCH SAMSUNG") return "samsung_watches";
  if (heading === "XIAOMI") return "xiaomi";
  if (heading === "MOTOROLA") return "motorola";
  if (/IPADS?-AIRPODS-WATCH/.test(heading)) return "apple_accessories";
  if (heading === "MACBOOK") return "mac";
  if (/^CONSOLAS\b/.test(heading)) return "gaming";
  if (/RAYBAN META/.test(heading)) return "smart_glasses";
  if (heading === "CÁMARAS DEPORTIVAS" || heading === "CAMARAS DEPORTIVAS") return "cameras";
  if (heading === "DRONES") return "drones";
  if (heading === "MICRÓFONOS INALÁMBRICOS" || heading === "MICROFONOS INALAMBRICOS") return "microphones";
  if (/RELOJES GARMIN/.test(heading)) return "garmin";
  if (heading === "NOTEBOOK") return "notebooks";
  return null;
}

function findColors(text) {
  let remaining = ` ${normalize(text)} `;
  const found = [];
  for (const { name, alias } of COLOR_TERMS) {
    const term = normalize(alias);
    const pattern = new RegExp(`(^|\\s)${term.replace(/\s+/g, "\\s+")}(?=\\s|$)`, "g");
    if (pattern.test(remaining)) {
      if (!found.includes(name)) found.push(name);
      remaining = remaining.replace(pattern, " ");
    }
  }
  return found;
}

function priceData(text) {
  const matches = [...String(text).matchAll(/(?:USD|U\$S|U\$|\$)\s*([\d.]+)/gi)]
    .map((match) => ({ value: Number(match[1].replace(/\./g, "")), index: match.index, length: match[0].length }));
  if (matches.length) return { primary: matches[0], all: matches };
  const candidates = [...String(text).matchAll(/(?:^|\s)(\d{2,4})(?!\s*(?:GB|TB|SSD|CPU|GPU|MM|K)\b)/gi)]
    .map((match) => ({ value: Number(match[1]), index: match.index + match[0].indexOf(match[1]), length: match[1].length }))
    .filter(({ value }) => value >= 50 && value <= 5000);
  return { primary: candidates.at(-1) ?? null, all: candidates };
}

function colorSpecificPrices(text, generalPrice) {
  const result = new Map();
  for (const match of String(text).matchAll(/\(([^)]*)\)/g)) {
    if (/\bX\d+\b/i.test(match[1])) continue;
    const colors = findColors(match[1]);
    const price = priceData(match[1]).primary?.value ?? generalPrice;
    for (const color of colors) result.set(normalize(color), price);
  }
  return result;
}

function stripColors(text, colors) {
  let output = String(text);
  for (const color of colors) {
    const aliases = COLOR_ALIASES[color] ?? [color];
    for (const alias of [...aliases].sort((a, b) => b.length - a.length))
      output = output.replace(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
  }
  return output;
}

function baseDescription(text, colors, primaryPrice = null) {
  let value = clean(text).replace(/\bX3\s*(?:USD|U\$S|U\$|\$)?\s*[\d.]+/gi, " ");
  value = value.replace(/\b\d{3,4}\b(?=\s*\))/g, " ");
  const hadCurrency = /(?:USD|U\$S|U\$|\$)\s*[\d.]+/i.test(value);
  value = value.replace(/(?:USD|U\$S|U\$|\$)\s*[\d.]+/gi, " ");
  if (!hadCurrency && primaryPrice != null) {
    const pricePattern = new RegExp(`\\b${String(primaryPrice).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?!.*\\b${String(primaryPrice)}\\b)`);
    value = value.replace(pricePattern, " ");
  }
  value = stripColors(value, colors).replace(/[(),]+/g, " ").replace(/[./-]+\s*$/g, " ").replace(/\s+/g, " ").trim();
  return value;
}

function canonicalBase(value, section) {
  let text = normalize(value)
    .replace(/\b(?:apple|samsung)\b/g, " ")
    .replace(/\bgb\b/g, "gb").replace(/\besim\s+esim\b/g, "esim")
    .replace(/\bz\s*(fold|flip)\b/g, "z$1").replace(/\b16\s+e\b/g, "16e")
    .replace(/\s+/g, " ").trim();
  if (["apple_new", "apple_cpo"].includes(section)) text = text.replace(/^iphone\s+/, "");
  return text;
}

function tokenSimilarity(a, b) {
  const aa = new Set(a.split(" ").filter(Boolean)), bb = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aa].filter((token) => bb.has(token)).length;
  return intersection / Math.max(aa.size, bb.size, 1);
}

function identityNumbers(value) {
  return [...canonicalBase(value).matchAll(/(\d+(?:\.\d+)?)\s*(tb|gb|mm)?/g)]
    .map((match) => String(match[2] === "tb" ? Number(match[1]) * 1024 : Number(match[1])))
    .filter((value) => Number(value) >= 4);
}

function compatibleNumbers(a, b) {
  const important = (values) => [...new Set(values)].sort((a, b) => Number(a) - Number(b));
  const aa = important(identityNumbers(a)), bb = important(identityNumbers(b));
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function compatibleModelFlags(a, b) {
  const flags = ["pro", "max", "ultra", "plus", "air", "fe", "fold", "flip", "neo"];
  const aa = new Set(a.split(" ")), bb = new Set(b.split(" "));
  const explicitSim = (value) => /\b(?:esim|sim)\b/.test(value);
  return flags.every((flag) => aa.has(flag) === bb.has(flag)) && (explicitSim(a) === explicitSim(b));
}

function parseOld(markdown) {
  const rows = [];
  const lines = markdown.split(/\r?\n/);
  let section = null;
  lines.forEach((line, index) => {
    const detected = detectSection(line, section);
    if (detected) section = detected;
    const quantity = line.match(/^\s*(\d+)\s*\|\s*(.+)$/);
    if (!quantity) return;
    const description = clean(quantity[2]);
    const prices = priceData(description);
    const colors = findColors(description);
    const color = colors.at(-1) ?? "Standard";
    const base = baseDescription(description, colors, prices.primary?.value);
    rows.push({ index, section, line, quantity: Number(quantity[1]), description, price: prices.primary?.value ?? null, color, base, canonical: canonicalBase(base, section), matched: false });
  });
  return { lines, rows };
}

function isSourceProduct(line, section) {
  if (!section || !line || /^[_\s]+$/.test(line)) return false;
  if (/GARANT[IÍ]A|CAJA SELLADA/i.test(line)) return false;
  return /(?:USD|U\$S|U\$|\$)\s*[\d.]|\b\d{2,4}\s*(?:USD)?\s*$/i.test(line) && !/^\*/.test(line.trim());
}

function parseSource(markdown) {
  const variants = [];
  const ambiguities = [];
  let section = null;
  let parent = null;
  for (const original of markdown.split(/\r?\n/)) {
    const detected = detectSection(original, section);
    if (detected) { section = detected; parent = null; continue; }
    if (!isSourceProduct(original, section)) {
      // Ray-Ban/Oakley y Watch usan detalles subordinados sin precio.
      if (parent && /^[🔥(]/u.test(original.trim()) && findColors(original).length) {
        const colors = findColors(original);
        for (const color of colors) variants.push({ ...parent, color, price: parent.generalPrice, sourceLine: original, base: `${parent.base} ${clean(original)}`.trim(), inherited: true });
      }
      continue;
    }
    const cleaned = clean(original);
    const prices = priceData(cleaned);
    if (!prices.primary) { ambiguities.push({ line: original, reason: "No se pudo identificar el precio unitario" }); continue; }
    let colors = findColors(cleaned);
    if (!colors.length) colors = ["Standard"];
    const specific = colorSpecificPrices(cleaned, prices.primary.value);
    const base = baseDescription(cleaned, colors, prices.primary.value);
    const item = { section, base, canonical: canonicalBase(base, section), generalPrice: prices.primary.value };
    parent = item;
    for (const color of colors) variants.push({ ...item, color, price: specific.get(normalize(color)) ?? prices.primary.value, sourceLine: original });
    if (/\b(?:silverblue|whitesilver)\b/i.test(cleaned)) ambiguities.push({ line: original, reason: "Color unido interpretado como nombre compuesto" });
    if (/\besim\s+esim\b/i.test(cleaned)) ambiguities.push({ line: original, reason: "Texto eSIM duplicado; normalizado como eSIM" });
  }
  return { variants, ambiguities };
}

function bestOldMatch(source, oldRows) {
  const sameSection = oldRows.filter((row) => !row.matched && row.section === source.section && normalize(row.color) === normalize(source.color));
  const exact = sameSection.filter((row) => row.canonical === source.canonical);
  if (exact.length === 1) return { row: exact[0], score: 1 };
  const scored = sameSection
    .filter((row) => compatibleNumbers(row.canonical, source.canonical) && compatibleModelFlags(row.canonical, source.canonical))
    .map((row) => ({ row, score: tokenSimilarity(row.canonical, source.canonical) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 0.72 && (!scored[1] || scored[0].score - scored[1].score >= 0.08)) return scored[0];
  return { row: null, score: scored[0]?.score ?? 0, candidates: scored.slice(0, 3) };
}

function formatVariant(variant) {
  const base = variant.base.replace(/^iPhone\s+/i, "iPhone ").replace(/\s+/g, " ").trim();
  return `5 | ${base} $${variant.price}${variant.color === "Standard" ? "" : ` ${variant.color}`}`;
}

function insertionIndexes(lines) {
  const result = new Map();
  let section = null;
  lines.forEach((line, index) => {
    const detected = detectSection(line, section);
    if (detected) section = detected;
    if (/^\s*\d+\s*\|/.test(line) && section) result.set(section, index);
  });
  return result;
}

const [oldMarkdown, sourceMarkdown] = await Promise.all([readFile(oldFile, "utf8"), readFile(sourceFile, "utf8")]);
const old = parseOld(oldMarkdown);
const source = parseSource(sourceMarkdown);
const report = { source: sourceFile, output: outputFile, generatedAt: new Date().toISOString(), summary: {}, ambiguities: [...source.ambiguities], newVariants: [], priceChanges: [] };
const sourceByIdentity = new Map();
for (const variant of source.variants) {
  const key = `${variant.section}|${variant.canonical}|${normalize(variant.color)}`;
  if (sourceByIdentity.has(key)) {
    const previous = sourceByIdentity.get(key);
    if (previous.price !== variant.price)
      report.ambiguities.push({ reason: "La fuente repite una variante con precios distintos", key, prices: [previous.price, variant.price], lines: [previous.sourceLine, variant.sourceLine] });
    continue;
  }
  sourceByIdentity.set(key, variant);
}
const sourceVariants = [...sourceByIdentity.values()];

// Regla base: todo lo anterior queda sin stock hasta que una variante nueva lo confirme.
for (const row of old.rows) old.lines[row.index] = row.line.replace(/^\s*\d+\s*\|/, "0 |");

const additions = new Map();
for (const variant of sourceVariants) {
  const match = bestOldMatch(variant, old.rows);
  if (process.env.DEBUG_STOCK_MATCH && /EPIX PRO/i.test(variant.sourceLine))
    console.log("DEBUG", variant.base, variant.color, "=>", match.row?.line, match.score);
  if (match.row) {
    const row = match.row; row.matched = true;
    if (row.price !== variant.price) report.priceChanges.push({ from: row.price, to: variant.price, old: row.line, source: variant.sourceLine });
    const description = row.description
      .replace(/(?:USD|U\$S|U\$|\$)\s*[\d.]+/i, `$${variant.price}`)
      .replace(/(^|\s)\d{2,4}(?=\s+[^\d]+$)/, (full, prefix) => row.price == null ? full : `${prefix}${variant.price}`);
    old.lines[row.index] = `5 | ${description}`;
  } else {
    if (match.score >= 0.55) report.ambiguities.push({ line: variant.sourceLine, variant: `${variant.base} / ${variant.color}`, reason: "Matching no concluyente", candidates: match.candidates?.map(({ row, score }) => ({ score, line: row.line })) });
    const line = formatVariant(variant);
    if (!additions.has(variant.section)) additions.set(variant.section, []);
    if (!additions.get(variant.section).includes(line)) additions.get(variant.section).push(line);
    report.newVariants.push({ section: variant.section, line });
  }
}

const indexes = insertionIndexes(old.lines);
const orderedInsertions = [...additions.entries()]
  .map(([section, lines]) => ({ section, lines, index: indexes.get(section) }))
  .filter(({ index, section }) => index != null || report.ambiguities.push({ section, reason: "No se encontró sección de destino para variantes nuevas" }))
  .sort((a, b) => b.index - a.index);
for (const { lines, index } of orderedInsertions) old.lines.splice(index + 1, 0, "", ...lines);

const sourceDate = sourceMarkdown.match(/^\s*(\d{1,2}\/\d{1,2})\s+LISTA/i)?.[1] ?? "20/8";
old.lines[0] = old.lines[0].replace(/^\s*\d{1,2}\/\d{1,2}/, sourceDate);

const output = `${old.lines.join("\n").replace(/\n+$/g, "")}\n`;
await writeFile(outputFile, output, "utf8");

const finalParsed = parseOld(output);
const duplicateKeys = new Map();
for (const row of finalParsed.rows) {
  const key = `${row.section}|${row.canonical}|${normalize(row.color)}`;
  if (!duplicateKeys.has(key)) duplicateKeys.set(key, []);
  duplicateKeys.get(key).push(row.line);
}
const duplicates = [...duplicateKeys.entries()].filter(([, lines]) => lines.length > 1).map(([key, lines]) => ({ key, lines }));
if (duplicates.length) report.ambiguities.push(...duplicates.map((duplicate) => ({ reason: "Posible variante duplicada", ...duplicate })));

report.summary = {
  sourceVariantsDetected: source.variants.length,
  uniqueSourceVariants: sourceVariants.length,
  variantsWithStock5: finalParsed.rows.filter((row) => row.quantity === 5).length,
  variantsSetToStock0: finalParsed.rows.filter((row) => row.quantity === 0).length,
  newVariantsAdded: report.newVariants.length,
  pricesModified: report.priceChanges.length,
  possibleDuplicates: duplicates.length,
  ambiguities: report.ambiguities.length,
};
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Generado: ${outputFile}`);
console.log(`Reporte: ${reportFile}`);
console.table(report.summary);
if (report.ambiguities.length) console.warn(`Revisar ${report.ambiguities.length} ambigüedades antes de usar stock_2.md.`);

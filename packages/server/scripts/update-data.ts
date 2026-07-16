/**
 * Офлайн-обновление статических данных (`pnpm update:data`).
 *
 * Разбирает сохранённые HAR-снапшоты в `pages/` (реальные ответы megamarket.ru, захваченные
 * браузером вручную) и пишет `packages/server/data/market.json` — единственный источник
 * данных для MCP-инструментов. Сеть/браузер не трогает; запускается вручную после того, как
 * в `pages/` положили новые снапшоты.
 *
 * Идемпотентен: повторный прогон просто перезаписывает файл.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// --- типы совпадают по форме с zod-схемами server/src/megamarket/product.ts и
// server/src/megamarket/cart.ts, но не импортируются оттуда: скрипт живёт вне `rootDir: src`
// пакета (не участвует в `tsc` сборке) и не должен тянуть рантайм-зависимость от
// собираемого кода.
interface Product {
  id: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  discountPercent: number | null;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  url: string | null;
  brand: string | null;
}

interface ProductSpec {
  name: string;
  value: string;
}

interface ProductDetailExtra {
  images: string[];
  specs: ProductSpec[];
  description: string | null;
}

const GALLERY_LIMIT = 6;
const SPECS_LIMIT = 12;

/** Подняться вверх по дереву каталогов до корня воркспейса (`pnpm-workspace.yaml`). */
function findRepoRoot(start = dirname(fileURLToPath(import.meta.url))): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Корень репозитория (pnpm-workspace.yaml) не найден");
    dir = parent;
  }
}

interface HarEntry {
  request: { url: string; method: string };
  response: { content: { text?: string; encoding?: string; mimeType?: string } };
}

/**
 * Прочитать HAR и вернуть тела JSON-ответов, чей URL содержит один из `urlIncludes`.
 * `body: any` — форма ответа разная для каждого эндпоинта (tile/list, catalog/search,
 * депозитный виджет); вызывающий код узко деструктурирует нужные поля сразу после чтения.
 */
function readHarJsonResponses(harPath: string, urlIncludes: string[]): Array<{ url: string; body: any }> {
  if (!existsSync(harPath)) return [];
  const har = JSON.parse(readFileSync(harPath, "utf8"));
  const entries: HarEntry[] = har.log.entries;
  const out: Array<{ url: string; body: any }> = [];
  for (const entry of entries) {
    const { url } = entry.request;
    if (!urlIncludes.some((needle) => url.includes(needle))) continue;
    const content = entry.response.content;
    if (!content.text) continue;
    // HAR может base64-кодировать бинарные тела; JSON-ответы сайтов в собранных снапшотах —
    // всегда plain text, но проверяем явно, чтобы не тихо получить мусор при будущих снапшотах.
    const text = content.encoding === "base64" ? Buffer.from(content.text, "base64").toString("utf8") : content.text;
    try {
      out.push({ url, body: JSON.parse(text) });
    } catch {
      // Не каждый матч по подстроке URL — валидный JSON (бывают пустые/ошибочные ответы) — пропускаем.
    }
  }
  return out;
}

/** Единая форма товарной позиции в ответах Megamarket (tile/list, catalog/search). */
interface MegamarketGoods {
  goodsId: string;
  title: string;
  titleImage: string | null;
  images?: string[];
  webUrl: string | null;
  brand?: string | null;
  description?: string | null;
  attributes?: Array<{ title: string; value: string; isWebListing?: boolean }>;
}
interface MegamarketItem {
  goods: MegamarketGoods;
  price: number | null;
  finalPrice: number | null;
  crossedPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
}

/** Смаппить один элемент выдачи Megamarket в `Product` + `ProductDetailExtra`. */
function mapMegamarketItem(item: MegamarketItem): { product: Product; detail: ProductDetailExtra } {
  const { goods } = item;
  // В выдаче/тайлах `goodsId` составной (`<id>_<merchantId>` — конкретное предложение конкретного
  // продавца), а в корзине/чекауте (см. pages/market/checkout) — голый `<id>`. Нормализуем к
  // голому id как канонической идентичности товара, иначе add_to_cart(id из корзины) не найдёт
  // товар в каталоге.
  const id = goods.goodsId.split("_")[0];
  const price = item.finalPrice ?? item.price ?? null;
  const oldPrice = item.crossedPrice && item.crossedPrice > 0 ? item.crossedPrice : null;
  const discountPercent =
    oldPrice && price ? Math.round(((oldPrice - price) / oldPrice) * 100) : null;

  const product: Product = {
    id,
    title: goods.title,
    price,
    oldPrice,
    discountPercent,
    imageUrl: goods.titleImage ?? null,
    rating: item.rating && item.rating > 0 ? item.rating : null,
    reviewCount: item.reviewCount && item.reviewCount > 0 ? item.reviewCount : null,
    url: goods.webUrl ?? null,
    brand: goods.brand ?? null,
  };

  const specs: ProductSpec[] = (goods.attributes ?? [])
    .filter((a) => a.isWebListing !== false && a.title && a.value)
    .slice(0, SPECS_LIMIT)
    .map((a) => ({ name: a.title, value: a.value }));

  const images = (goods.images && goods.images.length > 0 ? goods.images : goods.titleImage ? [goods.titleImage] : []).slice(
    0,
    GALLERY_LIMIT,
  );

  const detail: ProductDetailExtra = {
    images,
    specs,
    description: goods.description ? stripHtml(goods.description) : null,
  };

  return { product, detail };
}

/** Описание с реального сайта приходит с `<br/>`-разметкой — для текстового поля убираем теги. */
function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

/** Разобрать каталог Megamarket из трёх снапшотов (main tile/list, search-results, open-search-modal). */
function parseMarketCatalog(pagesDir: string): { products: Product[]; details: Record<string, ProductDetailExtra> } {
  const products = new Map<string, Product>();
  const details: Record<string, ProductDetailExtra> = {};

  const consume = (item: MegamarketItem) => {
    if (!item?.goods?.goodsId || !item.goods.title) return;
    const { product, detail } = mapMegamarketItem(item);
    products.set(product.id, product); // более поздний источник в списке ниже перезаписывает более ранний
    if (detail.images.length > 0 || detail.specs.length > 0 || detail.description) {
      details[product.id] = detail;
    }
  };

  // main/: тайлы главной — и ADVERT (items[]), и ITEM (item) варианты.
  for (const { body } of readHarJsonResponses(join(pagesDir, "market/main/megamarket.ru.har"), [
    "mainPageService/tile/list",
  ])) {
    for (const tile of body.tiles ?? []) {
      if (tile.type === "ITEM" && tile.item) consume(tile.item);
      if (tile.type === "ADVERT" && tile.advert?.items) for (const it of tile.advert.items) consume(it);
    }
  }

  // search-results/ и open-search-modal/: выдача поиска (только ответы с непустым items[] —
  // HAR содержит и пустой предзапрос до ввода текста, и финальный с результатами).
  for (const dir of ["market/search-results", "market/open-search-modal"]) {
    for (const { body } of readHarJsonResponses(join(pagesDir, dir, "megamarket.ru.har"), [
      "catalogService/catalog/search",
    ])) {
      for (const it of body.items ?? []) consume(it);
    }
  }

  return { products: [...products.values()], details };
}

function resolveDataDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data");
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const repoRoot = findRepoRoot();
  const pagesDir = join(repoRoot, "pages");
  if (!existsSync(pagesDir)) {
    throw new Error(`Каталог pages/ не найден по пути ${pagesDir} — положи туда HAR/HTML-снапшоты`);
  }

  const market = parseMarketCatalog(pagesDir);

  console.error(`[update:data] Megamarket: ${market.products.length} товаров, ${Object.keys(market.details).length} с деталью`);
  if (market.products.length > 0) {
    const sample = market.products[0];
    console.error(`[update:data]   пример: ${sample.id} — «${sample.title}» — ${sample.price ?? "?"} ₽`);
  }

  if (dryRun) {
    console.error("[update:data] --dry-run: файлы не записаны.");
    return;
  }

  if (market.products.length === 0) throw new Error("пустой каталог Megamarket — данные не записаны");

  const dataDir = resolveDataDir();
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "market.json"), JSON.stringify(market, null, 2) + "\n");
  console.error(`[update:data] готово. Данные — в ${dataDir}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error("[update:data] fatal:", error);
      process.exit(1);
    },
  );
}

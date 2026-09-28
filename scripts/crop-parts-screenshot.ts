// Crops the tall "Parts Catalog, new category" screenshot down to just its
// relevant bottom 500px (where the "+ New category..." form is). Run once per
// language, after capture-manual-screenshots.spec.ts produces the full-page
// version.
//
// Uses Playwright (already a dependency) instead of an image library: the PNG
// is rendered pixel-for-pixel in Chromium and the bottom strip screenshotted.
//
// Run via `make docs/manual-images/m_parts_cropped.png`. Optional argument: a
// language suffix for the image directory (e.g. "-de"). Replaces
// crop-parts-screenshot.py (this project ships no Python).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
const CROP_HEIGHT = 500;

const langSuffix = process.argv[2] ?? '';
const imgDir = join(DOCS, `manual-images${langSuffix}`);
const source = join(imgDir, 'm_items_new_category_full.png');
const target = join(imgDir, 'm_parts_cropped.png');

async function main(): Promise<void> {
  const bytes = readFileSync(source);
  // A PNG's width and height are the two big-endian 32-bit integers at byte 16.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (height < CROP_HEIGHT) throw new Error(`${source} is only ${height}px tall - nothing to crop.`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;padding:0}img{display:block;width:${width}px;height:${height}px}</style>` +
        `<img src="data:image/png;base64,${bytes.toString('base64')}">`,
    );
    await page.locator('img').evaluate((img) => (img as HTMLImageElement).decode());
    await page.screenshot({ path: target, clip: { x: 0, y: height - CROP_HEIGHT, width, height: CROP_HEIGHT } });
  } finally {
    await browser.close();
  }
  console.log(`Cropped ${source} (${width}x${height}) -> m_parts_cropped.png (${width}x${CROP_HEIGHT})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

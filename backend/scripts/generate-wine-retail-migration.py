import random

# Recreate the exact same data structure as generate-wine-retail-seed.py
locations = [
    ('Head Office', 'Springfield', 'warehouse', True, None, None),
    ('Riverside Cellars', 'Springfield', 'retail', False, 2200, 320),
    ('Uptown Wine & Spirits', 'Springfield', 'retail', False, 1600, 240),
    ('Warehouse B', 'Rivertown', 'warehouse', False, None, None),
    ('Harbourside Bottle Shop', 'Rivertown', 'retail', False, 1900, 280),
    ('Market Square Liquor', 'Rivertown', 'retail', False, 1400, 200),
    ('Eastside Cellar Door', 'Rivertown', 'retail', False, 1100, 160),
]

subcat_defs = {
    'Red Wine': ['Merlot', 'Cabernet Sauvignon', 'Pinot Noir', 'Shiraz'],
    'White Wine': ['Chardonnay', 'Sauvignon Blanc', 'Chablis', 'Riesling'],
    'Sparkling Wine': ['Champagne', 'Prosecco', 'Cava'],
    'Beer': ['Lager', 'Ale', 'Stout'],
    'Spirits': ['Whisky', 'Vodka', 'Gin', 'Rum'],
}

products = {
    'Merlot': ['Château Dubois Merlot 2021', 'Barossa Valley Merlot 2022'],
    'Cabernet Sauvignon': ['Napa Ridge Cabernet Sauvignon 2020', 'Coonawarra Cabernet 2021'],
    'Pinot Noir': ['Central Otago Pinot Noir 2022', 'Côte de Nuits Pinot Noir 2021'],
    'Shiraz': ['Barossa Shiraz 2021', 'Hunter Valley Shiraz 2020'],
    'Chardonnay': ['Margaret River Chardonnay 2022', 'Sonoma Chardonnay 2021'],
    'Sauvignon Blanc': ['Marlborough Sauvignon Blanc 2023', 'Loire Valley Sauvignon Blanc 2022'],
    'Chablis': ['Chablis Premier Cru 2021', 'Petit Chablis 2022'],
    'Riesling': ['Mosel Riesling 2022', 'Clare Valley Riesling 2021'],
    'Champagne': ['Grande Maison Champagne Brut', 'Grande Maison Champagne Rosé'],
    'Prosecco': ['Veneto Prosecco DOC', 'Prosecco Extra Dry'],
    'Cava': ['Penedès Cava Brut', 'Cava Rosé'],
    'Lager': ['Golden Lager 330ml', 'Premium Pilsner 330ml'],
    'Ale': ['Amber Ale 330ml', 'Pale Ale 330ml'],
    'Stout': ['Classic Stout 330ml', 'Imperial Stout 330ml'],
    'Whisky': ['Highland Single Malt 700ml', 'Blended Scotch 700ml'],
    'Vodka': ['Premium Vodka 700ml', 'Craft Vodka 700ml'],
    'Gin': ['London Dry Gin 700ml', 'Botanical Gin 700ml'],
    'Rum': ['Spiced Rum 700ml', 'Dark Rum 700ml'],
}

location_names = [l[0] for l in locations]
head_office, retail_a1, retail_a2, warehouse_b, retail_b1, retail_b2, retail_b3 = location_names

random.seed(42)
city_a_retail = [retail_a1, retail_a2]
city_b_retail = [retail_b1, retail_b2, retail_b3]
shelf_sides = ['Front', 'Back']

product_list = []
for subcat, names in products.items():
    for name in names:
        product_list.append((name, subcat))

part_location_rows = []
for i, (name, subcat) in enumerate(product_list):
    warehouse = head_office if i % 2 == 0 else warehouse_b
    wh_qty = random.randint(120, 480)
    part_location_rows.append((name, warehouse, wh_qty, 48, 720, 96, None, None, None))

    retail = city_a_retail[i % 2] if i % 4 < 2 else city_b_retail[i % 3]
    retail_qty = random.randint(6, 48)
    side = shelf_sides[i % 2]
    rack = chr(ord('A') + (i % 4))
    level = (i % 5) + 1
    part_location_rows.append((name, retail, retail_qty, 12, 60, 18, side, rack, level))

# Now generate TypeScript migration code
lines = []
lines.append("function migrateForWineRetailDemoData() {")
lines.append("  if (db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get('Head Office')) return; // already seeded")
lines.append("")
lines.append("  for (const cat of ['Red Wine', 'White Wine', 'Sparkling Wine', 'Beer', 'Spirits']) {")
lines.append("    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(cat)) createEntity({ name: cat, parent: 'Parts' }, 1);")
lines.append("  }")
lines.append("")
lines.append("  const subcatDefs: Record<string, string[]> = {")
for cat, subs in subcat_defs.items():
    subs_str = ", ".join(f"'{s}'" for s in subs)
    lines.append(f"    '{cat}': [{subs_str}],")
lines.append("  };")
lines.append("  for (const [cat, subs] of Object.entries(subcatDefs)) {")
lines.append("    for (const sub of subs) {")
lines.append("      if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(sub)) createEntity({ name: sub, parent: cat }, 1);")
lines.append("    }")
lines.append("  }")
lines.append("")
lines.append("  const locations: [string, string, 'retail' | 'warehouse', boolean, number | null, number | null][] = [")
for name, city, ltype, billing, bcap, ccap in locations:
    lines.append(f"    ['{name}', '{city}', '{ltype}', {str(billing).lower()}, {bcap if bcap is not None else 'null'}, {ccap if ccap is not None else 'null'}],")
lines.append("  ];")
lines.append("  for (const [name, city, locationType, isBilling, bottleCap, cartonCap] of locations) {")
lines.append("    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name)) createEntity({ name, parent: 'Locations' }, 1);")
lines.append("    setLocation(name, { city, location_type: locationType, is_billing_address: isBilling, bottle_capacity: bottleCap, carton_capacity: cartonCap });")
lines.append("  }")
lines.append("")
lines.append("  const products: [string, string][] = [")
for name, subcat in product_list:
    n = name.replace("'", "\\'")
    lines.append(f"    ['{n}', '{subcat}'],")
lines.append("  ];")
lines.append("  for (const [name, subcat] of products) {")
lines.append("    if (!db.prepare(`SELECT 1 FROM current_entities WHERE name = ?`).get(name)) createPart(name, subcat, 1);")
lines.append("  }")
lines.append("")
lines.append("  const stockRows: [string, string, number, number, number, number, string | null, string | null, number | null][] = [")
for name, loc, qty, minl, maxl, reorder, side, rack, level in part_location_rows:
    n = name.replace("'", "\\'")
    s = f"'{side}'" if side else 'null'
    r = f"'{rack}'" if rack else 'null'
    l = level if level is not None else 'null'
    lines.append(f"    ['{n}', '{loc}', {qty}, {minl}, {maxl}, {reorder}, {s}, {r}, {l}],")
lines.append("  ];")
lines.append("  for (const [partName, locationName, qty, minLevel, maxLevel, reorderLevel, shelfSide, rack, level] of stockRows) {")
lines.append("    receiveStockAtLocation('My Business', 'Actual', `WINE-SEED-${partName}-${locationName}`, partName, locationName, qty, 1, '2026-01-01');")
lines.append("    setPartLocationLevels(partName, locationName, { minLevel, maxLevel, reorderLevel, shelfSide, rack, level });")
lines.append("  }")
lines.append("}")
lines.append("migrateForWineRetailDemoData();")

with open('/tmp/migration_wine_retail.ts', 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print("done,", len(part_location_rows), "stock rows,", len(product_list), "products")

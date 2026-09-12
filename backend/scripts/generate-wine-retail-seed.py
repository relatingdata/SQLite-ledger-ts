lines = []
next_id = 122

def entity(name, parent_expr_or_id, is_id=True):
    global next_id
    eid = next_id
    next_id += 1
    parent = str(parent_expr_or_id) if is_id else f"(SELECT id FROM current_entities WHERE name = '{parent_expr_or_id}')"
    lines.append(f"INSERT INTO entity_ids (id) VALUES ({eid});")
    lines.append(f"INSERT INTO entities (row_id, entity_id, name, parent_id, created_at, created_by) VALUES ({eid}, {eid}, '{name}', {parent}, '2026-01-01', 1);")
    return eid

# --- Locations ---
lines.append("-- Wine/Beer/Spirits retail demonstration data: locations")
head_office = entity('Head Office', 'Locations', is_id=False)
retail_a1 = entity('Riverside Cellars', 'Locations', is_id=False)
retail_a2 = entity('Uptown Wine & Spirits', 'Locations', is_id=False)
warehouse_b = entity('Warehouse B', 'Locations', is_id=False)
retail_b1 = entity('Harbourside Bottle Shop', 'Locations', is_id=False)
retail_b2 = entity('Market Square Liquor', 'Locations', is_id=False)
retail_b3 = entity('Eastside Cellar Door', 'Locations', is_id=False)

lines.append("")
lines.append("INSERT INTO location (entity_id, city, location_type, is_billing_address, bottle_capacity, carton_capacity) VALUES")
lines.append(f"  ({head_office}, 'Springfield', 'warehouse', 1, NULL, NULL),")
lines.append(f"  ({retail_a1}, 'Springfield', 'retail', 0, 2200, 320),")
lines.append(f"  ({retail_a2}, 'Springfield', 'retail', 0, 1600, 240),")
lines.append(f"  ({warehouse_b}, 'Rivertown', 'warehouse', 0, NULL, NULL),")
lines.append(f"  ({retail_b1}, 'Rivertown', 'retail', 0, 1900, 280),")
lines.append(f"  ({retail_b2}, 'Rivertown', 'retail', 0, 1400, 200),")
lines.append(f"  ({retail_b3}, 'Rivertown', 'retail', 0, 1100, 160);")

# --- Categories ---
lines.append("")
lines.append("-- Categories and subcategories")
cats = {}
for cat in ['Red Wine', 'White Wine', 'Sparkling Wine', 'Beer', 'Spirits']:
    cats[cat] = entity(cat, 'Parts', is_id=False)

subcats = {}
subcat_defs = {
    'Red Wine': ['Merlot', 'Cabernet Sauvignon', 'Pinot Noir', 'Shiraz'],
    'White Wine': ['Chardonnay', 'Sauvignon Blanc', 'Chablis', 'Riesling'],
    'Sparkling Wine': ['Champagne', 'Prosecco', 'Cava'],
    'Beer': ['Lager', 'Ale', 'Stout'],
    'Spirits': ['Whisky', 'Vodka', 'Gin', 'Rum'],
}
for cat, subs in subcat_defs.items():
    for sub in subs:
        subcats[sub] = entity(sub, cat, is_id=False)

# --- Products ---
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

product_ids = {}
lines.append("")
lines.append("-- Products (a part row for each, description/UOM/UPC left for the business to fill in)")
for subcat, names in products.items():
    for name in names:
        pid = entity(name, subcat, is_id=False)
        product_ids[name] = pid

lines.append("")
lines.append("INSERT INTO part (entity_id, description, unit_of_measure, upc) VALUES")
part_rows = []
for name, pid in product_ids.items():
    uom = 'bottle'
    part_rows.append(f"  ({pid}, NULL, '{uom}', NULL)")
lines.append(",\n".join(part_rows) + ";")

with open('/tmp/wine_seed_entities.sql', 'w') as f:
    f.write("\n".join(lines))

print("Generated", len(product_ids), "products,", next_id - 122, "total entities, next_id now", next_id)
print("Location IDs:", head_office, retail_a1, retail_a2, warehouse_b, retail_b1, retail_b2, retail_b3)

# --- Per-location stock: bulk at the warehouses, smaller selling quantities at retail ---
import random
random.seed(42)

city_a_retail = [retail_a1, retail_a2]
city_b_retail = [retail_b1, retail_b2, retail_b3]

pl_lines = []
pl_lines.append("")
pl_lines.append("-- Per-location stock: bulk at the two warehouses, smaller selling quantities")
pl_lines.append("-- at retail outlets, with real min/max/reorder levels and shelf positions.")
pl_lines.append("INSERT INTO part_location (part_id, location_id, quantity_on_hand, min_level, max_level, reorder_level, shelf_side, rack, level) VALUES")

rows = []
shelf_sides = ['Front', 'Back']
for i, (name, pid) in enumerate(product_ids.items()):
    # Warehouse stock (bulk, in whichever city's warehouse — alternate)
    warehouse = head_office if i % 2 == 0 else warehouse_b
    wh_qty = random.randint(120, 480)
    rows.append(f"  ({pid}, {warehouse}, {wh_qty}, 48, 720, 96, NULL, NULL, NULL)")

    # One retail outlet per product, alternating cities, with real shelf position
    retail = city_a_retail[i % 2] if i % 4 < 2 else city_b_retail[i % 3]
    retail_qty = random.randint(6, 48)
    side = shelf_sides[i % 2]
    rack = chr(ord('A') + (i % 4))
    level = (i % 5) + 1
    rows.append(f"  ({pid}, {retail}, {retail_qty}, 12, 60, 18, '{side}', '{rack}', {level})")

pl_lines.append(",\n".join(rows) + ";")

with open('/tmp/wine_seed_part_location.sql', 'w') as f:
    f.write("\n".join(pl_lines))
print("part_location rows:", len(rows))

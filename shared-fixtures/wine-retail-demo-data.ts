// The real, comprehensive loader for Wine Retail Company's demo
// data - locations, product catalog, and initial stock levels - per
// direct, absolute instruction: plain ASCII CSV, not hardcoded
// TypeScript arrays.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface DemoLocation {
  name: string;
  city: string;
  locationType: 'Retail' | 'Warehouse';
  isBilling: boolean;
  bottleCap: number | null;
  cartonCap: number | null;
  timezone: string;
}

export function loadDemoLocations(): DemoLocation[] {
  const text = fs.readFileSync(path.join(here, 'locations.csv'), 'utf-8');
  return readCsv(text).map((row) => ({
    name: row.name,
    city: row.city,
    locationType: row.locationType as 'retail' | 'warehouse',
    isBilling: row.isBilling === 'true',
    bottleCap: row.bottleCap ? Number(row.bottleCap) : null,
    cartonCap: row.cartonCap ? Number(row.cartonCap) : null,
    timezone: row.timezone,
  }));
}

export interface DemoCategory {
  category: string;
  subcategory: string;
}

export function loadDemoCategories(): DemoCategory[] {
  const text = fs.readFileSync(path.join(here, 'categories.csv'), 'utf-8');
  return readCsv(text).map((row) => ({ category: row.category, subcategory: row.subcategory }));
}

export interface DemoProduct {
  name: string;
  subcategory: string;
}

export function loadDemoProducts(): DemoProduct[] {
  const text = fs.readFileSync(path.join(here, 'products.csv'), 'utf-8');
  return readCsv(text).map((row) => ({ name: row.name, subcategory: row.subcategory }));
}

export interface DemoStockLevel {
  itemName: string;
  locationName: string;
  qty: number;
  minLevel: number;
  maxLevel: number;
  reorderLevel: number;
  shelfSide: string | null;
  rack: string | null;
  level: number | null;
}

export function loadDemoStockLevels(): DemoStockLevel[] {
  const text = fs.readFileSync(path.join(here, 'stock-levels.csv'), 'utf-8');
  return readCsv(text).map((row) => ({
    itemName: row.itemName,
    locationName: row.locationName,
    qty: Number(row.qty),
    minLevel: Number(row.minLevel),
    maxLevel: Number(row.maxLevel),
    reorderLevel: Number(row.reorderLevel),
    shelfSide: row.shelfSide || null,
    rack: row.rack || null,
    level: row.level ? Number(row.level) : null,
  }));
}

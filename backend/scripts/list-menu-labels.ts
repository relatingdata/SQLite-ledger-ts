// A real, permanent, reusable diagnostic: lists every real, distinct
// section and link label the live menu tree actually produces - used
// to find every real string that needs a translation, without
// guessing or hardcoding a separate, parallel list that could drift.
import { getMenuTree } from '../src/db.js';

const tree = getMenuTree();
const labels = new Set<string>();
for (const section of tree) {
  labels.add(section.label);
  for (const link of section.links) {
    if (!link.notImplemented) labels.add(link.label);
  }
}
console.log(JSON.stringify(Array.from(labels).sort(), null, 2));

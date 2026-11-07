// entity-driver-select.ts — the ONE module in the backend allowed to import
// every concrete EntityDriver implementation. Everything else (primitives.ts,
// and eventually the ~470 call sites migrated in Stage C) imports only
// `entityDriver` from here, never a concrete driver module directly —
// that's the isolation boundary the whole plan exists to create.
//
// `ENTITY_DRIVER=sql|kaappi|memory`, default `sql`. The Kaappi driver's
// constructor spawns a worker thread (and, inside it, the Kaappi
// subprocess) synchronously at module load; MemoryEntityDriver's
// constructor replays the same kaappi_wal op log into its own in-process
// box/version model, no subprocess involved — either way, only when
// actually selected, so the default `sql` path pays no cost for either's
// existence.
import { SqlEntityDriver } from './drivers/sql-entity-driver.js';
import { KaappiEntityDriver } from './drivers/kaappi-entity-driver.js';
import { MemoryEntityDriver } from './drivers/memory-entity-driver.js';
import type { EntityDriver } from './entity-driver.js';

function selectDriver(): EntityDriver {
  const choice = process.env.ENTITY_DRIVER ?? 'sql';
  if (choice === 'kaappi') return new KaappiEntityDriver();
  if (choice === 'memory') return new MemoryEntityDriver();
  if (choice === 'sql') return new SqlEntityDriver();
  throw new Error(`ENTITY_DRIVER must be "sql", "kaappi", or "memory", got "${choice}".`);
}

export const entityDriver: EntityDriver = selectDriver();

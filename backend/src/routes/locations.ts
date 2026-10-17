import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth-middleware.js';
import {
  getEntityTree,
  setLocation,
  stageLocation,
  postLocation,
  getLocation,
  getItemLocation,
  setItemLocationLevels,
  receiveItems,
  receiveStockPhysical,
  resolveReceiveAccounts,
  convertStorageSpace,
  openStorageContainer,
  dispatchItems,
  transferItems,
  transferStock,
  resolveTransferAccounts,
  resolveOpenContainerAccounts,
  getBelowReorderStock,
  getStockOutRiskReport,
  setItemSourceLeadTime,
  getInventoryListing,
  getInventoryListingByLocation,
  getStorageSpaceReport,
  getStockMovementReport,
  countInventoryListing,
  createStockTake,
  getStockTake,
  recordStockTakeCount,
  completeStockTake,
  getRestockPickingList,
  confirmRestockPickedLine,
  dispatchRestockFromPickingList,
  setLocationOpenHours,
  getLocationOpenHours,
  setEmployeeSchedule,
  getEmployeeSchedule,
  getScheduleAtLocation,
  ValidationError,
  NotFoundError,
  asBusinessName,
  asLedgerName,
  asAccountName,
  asItemName,
  asLocationName,
  asProviderName,
  asUserId,
  getLocationTypes,
  createLocationType,
  nominateLocationCurrency,
  getLocationCurrencies,
  resolveBusinessLocationsRootId,
} from '../db.js';

export const locationsRouter = Router();

locationsRouter.get('/', (req, res) => {
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required — locations are scoped per business.' });
  const entities = getEntityTree();
  // Legacy-root aware (see resolveBusinessLocationsRootId, backend/
  // src/db.ts) — the same, exact "Locations" child requirement this
  // route used to apply directly, plus a real, read-only fallback for
  // the one, specific, pre-existing demo business ("Wine Retail
  // Business") that still uses the legacy, combined-name root.
  const locationsParentId = resolveBusinessLocationsRootId(business);
  const locationEntities = locationsParentId ? entities.filter((e) => e.parent_id === locationsParentId) : [];
  const result = locationEntities.map((e) => ({ name: e.name, ...getLocation(e.name) }));
  res.json(result);
});

locationsRouter.get('/types', (_req, res) => {
  res.json(getLocationTypes());
});

const createLocationTypeSchema = z.object({ name: z.string().min(1) });

locationsRouter.post('/types', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createLocationTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    createLocationType(parsed.data.name, asUserId(req.user!.id));
    res.status(201).json({ name: parsed.data.name });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create location type.' });
  }
});

// Per direct instruction: the real, rate-based storage conversion
// (e.g. Hot to Cold) - a real, defined, one-directional exchange rate
// between two real storage combinations. Placed here, before the
// generic '/:name' route below, since Express matches route
// definitions in order - '/:name' would otherwise wrongly treat
// "convert-storage"/"open-container" as a real location's own name.
const convertStorageSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  itemName: z.string().min(1),
  definitionDimensions: z.array(z.tuple([z.string(), z.string()])),
  fromValues: z.array(z.string()),
  toValues: z.array(z.string()),
  quantity: z.number().int().positive(),
  reference: z.string().optional(),
});
locationsRouter.post('/convert-storage', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = convertStorageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    convertStorageSpace(asBusinessName(d.business), asLedgerName(d.ledger), asItemName(d.itemName), d.definitionDimensions, d.fromValues, d.toValues, d.quantity, asUserId(req.user!.id), d.reference);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not convert storage.' });
  }
});

// Per direct instruction: the real, independent, non-rate-linked
// container-opening case - never a "conversion," two real, unrelated
// space movements that merely happen together.
const openContainerSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  location: z.string().min(1),
  item: z.string().min(1),
  definitionDimensions: z.array(z.tuple([z.string(), z.string()])),
  containerValues: z.array(z.string()),
  cartonsOpened: z.number().int().positive(),
  unitValues: z.array(z.string()),
  unitsProduced: z.number().int().positive(),
  reference: z.string().optional(),
});
locationsRouter.post('/open-container', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = openContainerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    openStorageContainer(asBusinessName(d.business), asLedgerName(d.ledger), asLocationName(d.location), asItemName(d.item), d.definitionDimensions, d.containerValues, d.cartonsOpened, d.unitValues, d.unitsProduced, asUserId(req.user!.id), d.reference);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not open container.' });
  }
});

// Per docs/canned-journal-to-frontend-design.md Phase 1: the real,
// account-resolution counterpart to /open-container above — resolves/
// creates every real storage-space and Inventory account Open
// Container needs, so the frontend-driven Open Container screen can
// build and post both of its own real journal entries (the space
// movement, and the dollar Inventory-value movement) itself, through
// the generic /journal/staging+/journal/post calls. /open-container
// itself is left completely unchanged for every other, real,
// backend-to-backend caller (the tutorial's own step-runner, every
// existing test).
const resolveOpenContainerAccountsSchema = z.object({
  business: z.string().min(1),
  location: z.string().min(1),
  item: z.string().min(1),
  definitionDimensions: z.array(z.tuple([z.string(), z.string()])),
  containerValues: z.array(z.string()),
  unitValues: z.array(z.string()),
});
locationsRouter.post('/resolve-open-container-accounts', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = resolveOpenContainerAccountsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    const result = resolveOpenContainerAccounts(
      asBusinessName(d.business),
      asLocationName(d.location),
      asItemName(d.item),
      d.definitionDimensions,
      d.containerValues,
      d.unitValues,
      asUserId(req.user!.id)
    );
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not resolve accounts.' });
  }
});

const resolveReceiveAccountsSchema = z.object({
  business: z.string().min(1),
  itemName: z.string().min(1),
  combinationValues: z.array(z.string()).optional(),
  combinationShape: z.array(z.tuple([z.string(), z.string()])).optional(),
});

locationsRouter.post('/resolve-receive-accounts', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = resolveReceiveAccountsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    const result = resolveReceiveAccounts(asBusinessName(d.business), asItemName(d.itemName), d.combinationShape, d.combinationValues, asUserId(req.user!.id));
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not resolve accounts.' });
  }
});

// Per a real, confirmed bug found and fixed directly while verifying
// Phase 1 against a real, live browser: every bare, single-path-
// segment POST route below this comment used to be registered AFTER
// the catch-all `POST /:name` location-creation route further down
// this file — since Express matches routes in registration order,
// any request to e.g. "/locations/transfer" was actually caught by
// that earlier, generic `/:name` handler first (treating "transfer"
// itself as a location name to create), never reaching its own,
// real, intended handler at all. This affected /transfer itself (pre-
// existing, not introduced by this session's own Phase 1 work) as
// well as every new, single-segment Phase 1 endpoint added alongside
// it (/transfer-stock, /resolve-transfer-accounts, the
// /resolve-receive-accounts route just above). Every real route with
// more than one path segment (e.g. /:name/receive-stock) was never
// affected, since `/:name` only ever matches one, bare segment.
// Fixed by moving every real, single-segment POST route to before
// the catch-all, exactly where the pre-existing /convert-storage,
// /open-container, and /resolve-open-container-accounts routes above
// already correctly lived — confirmed directly via a real Playwright
// run against the real, live Stock Transfer screen, not assumed.
const transferSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  itemName: z.string().min(1),
  fromLocationName: z.string().min(1),
  toLocationName: z.string().min(1),
  quantity: z.number().int().positive(),
  reference: z.string().min(1),
  transdate: z.string().optional(),
});

locationsRouter.post('/transfer', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    transferItems(asBusinessName(d.business), asLedgerName(d.ledger), asItemName(d.itemName), asLocationName(d.fromLocationName), asLocationName(d.toLocationName), d.quantity, d.reference, asUserId(req.user!.id), d.transdate);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not transfer stock.' });
  }
});

// Per docs/canned-journal-to-frontend-design.md Phase 1: the real,
// narrow, physical-only counterpart to /transfer above — quantity
// movement and location-capacity adjustment only, no real dollar
// VALUE journal entry, used by the frontend-driven Stock Transfer
// screen, which posts that VALUE entry itself via the generic
// /journal/staging+/journal/post calls. /transfer itself is left
// completely unchanged for every other, real, backend-to-backend
// caller (restocking, proof scripts, every existing test).
locationsRouter.post('/transfer-stock', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    transferStock(
      {
        business: asBusinessName(d.business),
        ledger: asLedgerName(d.ledger),
        itemName: asItemName(d.itemName),
        fromLocationName: asLocationName(d.fromLocationName),
        toLocationName: asLocationName(d.toLocationName),
        quantity: d.quantity,
        reference: d.reference,
        transdate: d.transdate,
      },
      asUserId(req.user!.id)
    );
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not transfer stock.' });
  }
});

const resolveTransferAccountsSchema = z.object({
  business: z.string().min(1),
  itemName: z.string().min(1),
  fromLocationName: z.string().min(1),
  toLocationName: z.string().min(1),
});

locationsRouter.post('/resolve-transfer-accounts', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = resolveTransferAccountsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    const result = resolveTransferAccounts(
      asBusinessName(d.business),
      asItemName(d.itemName),
      asLocationName(d.fromLocationName),
      asLocationName(d.toLocationName),
      asUserId(req.user!.id)
    );
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not resolve accounts.' });
  }
});

locationsRouter.get('/:name', (req, res) => {
  const location = getLocation(req.params.name);
  if (!location) return res.status(404).json({ error: 'No such location.' });
  res.json({ name: req.params.name, ...location });
});

const locationSchema = z.object({
  city: z.string().min(1),
  location_type: z.string().min(1),
  is_billing_address: z.boolean(),
  bottle_capacity: z.number().int().nullable().optional(),
  carton_capacity: z.number().int().nullable().optional(),
  // A real, direct IANA timezone identifier — required, since a real,
  // physical location's own transactions must record against that
  // location's own real, local calendar day, never the server's own.
  timezone: z.string().min(1),
});

locationsRouter.post('/:name', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  try {
    const reference = `LOC-${req.params.name}-${Date.now()}`;
    stageLocation({
      reference,
      business: asBusinessName(business),
      location_name: req.params.name,
      city: parsed.data.city,
      location_type: parsed.data.location_type,
      bottle_capacity: parsed.data.bottle_capacity ?? null,
      carton_capacity: parsed.data.carton_capacity ?? null,
      timezone: parsed.data.timezone,
    });
    postLocation(reference, asBusinessName(business), asUserId(req.user!.id));
    // 204, not 201: no body is returned (the frontend's createLocation
    // declares request<void>), and every sibling "nothing to return"
    // route in this file already uses 204 - 201 with an empty body
    // was a real, confirmed bug: the frontend's generic request<T>
    // helper only skips res.json() for status 204, so a 201 with an
    // empty body made it throw a raw SyntaxError on res.json(), which
    // the page then miscaught as a generic "Could not create
    // location." - hiding a call that had actually already succeeded.
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create location.' });
  }
});

// Per a real, confirmed bug found and fixed directly while verifying
// Phase 1 against a real, live browser: this route used to call
// setLocation with no business at all, so its lookup fell back to the
// exact, same, bare, unscoped name match the comment on setLocation's
// own definition already warns is dangerous - except that warning was
// only ever about two DIFFERENT businesses sharing a location name.
// Within a single business, once any real storage-combination action
// (Receive Into Storage, Open Container, Convert Storage) has touched
// a location, that location's own GL "Storage" account root gets a
// child node with the exact, same literal name as the location itself
// - so a bare lookup can resolve to that GL node instead of the real
// location contact, and this route would then silently write the
// location's own real capacity onto it, confirmed directly against
// the database. The sibling POST /:name route (location creation)
// already required and used a real business query parameter for the
// exact, same reason; this one simply never did.
locationsRouter.put('/:name', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const business = req.query.business as string;
  if (!business) return res.status(400).json({ error: 'business query parameter is required.' });
  try {
    setLocation(
      req.params.name,
      {
        city: parsed.data.city,
        location_type: parsed.data.location_type,
        is_billing_address: parsed.data.is_billing_address,
        bottle_capacity: parsed.data.bottle_capacity ?? null,
        carton_capacity: parsed.data.carton_capacity ?? null,
        timezone: parsed.data.timezone,
      },
      asBusinessName(business)
    );
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not save location.' });
  }
});

// Per docs/multicurrency-design.md: a location's own, real, nominated
// SET of further currencies it trades in, alongside its own implicit
// home currency. Nearly every real location's set stays empty.
locationsRouter.get('/:name/currencies', (req, res) => {
  res.json(getLocationCurrencies(req.params.name));
});

const currencySchema = z.object({ currencyCode: z.string().min(1).max(6) });

locationsRouter.post('/:name/currencies', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = currencySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    nominateLocationCurrency(req.params.name, parsed.data.currencyCode, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not nominate that currency.' });
  }
});

locationsRouter.get('/:name/items/:itemName', (req, res) => {
  res.json(getItemLocation(asItemName(req.params.itemName), asLocationName(req.params.name)));
});

const levelsSchema = z.object({
  minLevel: z.number().int().nullable().optional(),
  maxLevel: z.number().int().nullable().optional(),
  reorderLevel: z.number().int().nullable().optional(),
  shelfSide: z.string().nullable().optional(),
  rack: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  // Per the real, confirmed bug fixed directly in
  // setItemLocationLevelDetails (backend/src/db-stock.ts): this route
  // never had a real business/ledger to pass at all before now,
  // relying entirely on an ambient session context this application
  // never actually establishes per-request — every real call threw.
  // business is required; ledger defaults to "Actual", the real,
  // ordinary ledger every other screen already defaults to.
  business: z.string().min(1),
  ledger: z.string().min(1).optional(),
});

locationsRouter.put('/:name/items/:itemName', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = levelsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setItemLocationLevels(asItemName(req.params.itemName), asLocationName(req.params.name), parsed.data, asBusinessName(parsed.data.business), asLedgerName(parsed.data.ledger ?? 'Actual'), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not save levels.' });
  }
});

const movementSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  reference: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  transdate: z.string().optional(),
  combinationValues: z.array(z.string()).optional(),
  combinationShape: z.array(z.tuple([z.string(), z.string()])).optional(),
});

locationsRouter.post('/:name/receive', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    receiveItems(asBusinessName(d.business), asLedgerName(d.ledger), d.reference, asItemName(d.itemName), asLocationName(req.params.name), d.quantity, asUserId(req.user!.id), d.transdate, d.combinationValues, d.combinationShape);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not receive stock.' });
  }
});

// Per docs/canned-journal-to-frontend-design.md Phase 1: the real,
// physical-and-unit-tracking-only counterpart to /:name/receive above —
// used by the frontend-driven Receive Into Storage screen, which posts
// its own real dollar VALUE entry itself (a real, combination-tracked
// receipt only — an ordinary, plain receipt has no dollar journal
// entry at all, before or after this migration). /:name/receive itself
// is left completely unchanged for every other, real, backend-to-
// backend caller (Cash Purchase's own /pos/receive-stock, proof
// scripts, every existing test).
locationsRouter.post('/:name/receive-stock', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    receiveStockPhysical(
      {
        business: asBusinessName(d.business),
        ledger: asLedgerName(d.ledger),
        reference: d.reference,
        itemName: asItemName(d.itemName),
        locationName: asLocationName(req.params.name),
        quantity: d.quantity,
        transdate: d.transdate,
        combinationValues: d.combinationValues,
        combinationShape: d.combinationShape,
      },
      asUserId(req.user!.id)
    );
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not receive stock.' });
  }
});

locationsRouter.post('/:name/dispatch', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    dispatchItems(asBusinessName(d.business), asLedgerName(d.ledger), d.reference, asItemName(d.itemName), asLocationName(req.params.name), d.quantity, asUserId(req.user!.id), d.transdate);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not dispatch stock.' });
  }
});

const restockLinesSchema = z.array(z.object({ item: z.string().min(1), quantity: z.number().int().positive() }));

locationsRouter.post('/restock/:runReference/picking-list', (req, res) => {
  const warehouseName = req.body.warehouseName as string;
  const linesParsed = restockLinesSchema.safeParse(req.body.lines);
  if (!warehouseName || !linesParsed.success) return res.status(400).json({ error: 'warehouseName and lines are required.' });
  try {
    res.json(getRestockPickingList(req.params.runReference, asLocationName(warehouseName), linesParsed.data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load the real restocking picking list.' });
  }
});

const confirmRestockSchema = z.object({ item: z.string().min(1), business: z.string().min(1), ledger: z.string().min(1) });
locationsRouter.post('/restock/:runReference/confirm-picked', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = confirmRestockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    confirmRestockPickedLine(req.params.runReference, d.item, asBusinessName(d.business), asLedgerName(d.ledger), asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not confirm this line as picked.' });
  }
});

const dispatchRestockSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  warehouseName: z.string().min(1),
  retailOutletName: z.string().min(1),
  lines: restockLinesSchema,
  transdate: z.string().optional(),
});
locationsRouter.post('/restock/:runReference/dispatch', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = dispatchRestockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    dispatchRestockFromPickingList(req.params.runReference, asBusinessName(d.business), asLedgerName(d.ledger), asLocationName(d.warehouseName), asLocationName(d.retailOutletName), d.lines, asUserId(req.user!.id), d.transdate);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not dispatch this restocking run.' });
  }
});

const openHoursSchema = z.object({
  hours: z.array(z.object({ day: z.string().min(1), opens_at: z.string().min(1), closes_at: z.string().min(1) })),
});
locationsRouter.put('/:name/open-hours', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = openHoursSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setLocationOpenHours(req.params.name, parsed.data.hours);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not set open hours.' });
  }
});
locationsRouter.get('/:name/open-hours', (req, res) => {
  res.json(getLocationOpenHours(req.params.name));
});
locationsRouter.get('/:name/schedule', (req, res) => {
  res.json(getScheduleAtLocation(req.params.name));
});

const employeeScheduleSchema = z.object({
  locationName: z.string().min(1),
  schedule: z.array(z.object({ day: z.string().min(1), starts_at: z.string().min(1), ends_at: z.string().min(1) })),
});
locationsRouter.put('/employees/:employeeName/schedule', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = employeeScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setEmployeeSchedule(req.params.employeeName, parsed.data.locationName, parsed.data.schedule);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Could not set this employee's schedule." });
  }
});
locationsRouter.get('/employees/:employeeName/schedule', (req, res) => {
  res.json(getEmployeeSchedule(req.params.employeeName));
});

export const belowReorderRouter = Router();
belowReorderRouter.get('/', (_req, res) => {
  res.json(getBelowReorderStock());
});

export const stockOutRiskRouter = Router();
stockOutRiskRouter.get('/', (req, res) => {
  const windowDays = req.query.windowDays ? Number(req.query.windowDays) : 2;
  res.json(getStockOutRiskReport(windowDays));
});

const setLeadTimeSchema = z.object({ item: z.string().min(1), vendor: z.string().min(1), days: z.number().int().positive() });
stockOutRiskRouter.post('/lead-time', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = setLeadTimeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    setItemSourceLeadTime(asItemName(parsed.data.item), asProviderName(parsed.data.vendor), parsed.data.days, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save this lead time.' });
  }
});

export const stockListingRouter = Router();
stockListingRouter.get('/', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  res.json({ rows: getInventoryListing(limit, offset), totalCount: countInventoryListing() });
});
stockListingRouter.get('/by-location', (req, res) => {
  const business = req.query.business;
  if (typeof business !== 'string' || !business) return res.status(400).json({ error: 'business is required.' });
  const hierarchyName = typeof req.query.hierarchyName === 'string' && req.query.hierarchyName ? req.query.hierarchyName : undefined;
  res.json(getInventoryListingByLocation(asBusinessName(business), hierarchyName));
});
stockListingRouter.get('/storage-space', (_req, res) => {
  res.json(getStorageSpaceReport());
});
stockListingRouter.get('/movement', (req, res) => {
  const business = req.query.business;
  const ledger = req.query.ledger;
  if (typeof business !== 'string' || !business) return res.status(400).json({ error: 'business is required.' });
  if (typeof ledger !== 'string' || !ledger) return res.status(400).json({ error: 'ledger is required.' });
  const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
  const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
  const hierarchyName = typeof req.query.hierarchyName === 'string' && req.query.hierarchyName ? req.query.hierarchyName : undefined;
  try {
    res.json(getStockMovementReport(business, ledger, fromDate, toDate, hierarchyName));
  } catch (err) {
    if (err instanceof ValidationError) return res.status(404).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not load the stock movement report.' });
  }
});

export const stockTakesRouter = Router();

const createTakeSchema = z.object({ locationName: z.string().min(1), takeDate: z.string().min(1), business: z.string().min(1).optional() });
stockTakesRouter.post('/', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = createTakeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const id = createStockTake(asLocationName(parsed.data.locationName), parsed.data.takeDate, asUserId(req.user!.id), parsed.data.business ? asBusinessName(parsed.data.business) : undefined);
    res.status(201).json({ id });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not create stock take.' });
  }
});

stockTakesRouter.get('/:id', (req, res) => {
  const take = getStockTake(Number(req.params.id));
  if (!take) return res.status(404).json({ error: 'No such stock take.' });
  res.json(take);
});

const countSchema = z.object({ itemName: z.string().min(1), countedQuantity: z.number().int().nonnegative() });
stockTakesRouter.post('/:id/count', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = countSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    recordStockTakeCount(Number(req.params.id), asItemName(parsed.data.itemName), parsed.data.countedQuantity);
    res.status(204).end();
  } catch (err) {
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not record count.' });
  }
});

const completeSchema = z.object({
  business: z.string().min(1),
  ledger: z.string().min(1),
  varianceExpenseAccount: z.string().min(1),
  inventoryAccount: z.string().min(1),
  unitCostMinorByItem: z.record(z.number().int()),
});
stockTakesRouter.post('/:id/complete', requireRole('Administrator', 'Bookkeeper'), (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const d = parsed.data;
    completeStockTake(Number(req.params.id), asBusinessName(d.business), asLedgerName(d.ledger), asAccountName(d.varianceExpenseAccount), d.inventoryAccount, d.unitCostMinorByItem, asUserId(req.user!.id));
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ValidationError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Could not complete stock take.' });
  }
});

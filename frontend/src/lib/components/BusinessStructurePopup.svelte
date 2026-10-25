<script lang="ts">
  // The "Business Structure" popup — a graphical, editable view over a
  // business's Locations, Divisions, Item Categories, and any other
  // generic Hierarchy, all in one place. See docs/pm-frontend-reference.md
  // for the full design and the hierarchy-tag-vs-structural-reparent
  // distinction this component depends on.
  //
  // Deliberately calls no new backend endpoints: every add/move action
  // below reuses the exact same, already-existing functions the
  // Locations, Setup → Hierarchies, and Items Catalog screens call
  // directly — this is a unified graphical front end over those same
  // capabilities, not a replacement for them.
  import {
    asBusinessName,
    createLocation,
    listLocations,
    getLocationTypes,
    getHierarchy,
    getHierarchyTag,
    setHierarchyTag,
    deleteHierarchyTag,
    createHierarchyGrouping,
    createHierarchyValue,
    getEntityTree,
    createEntity,
    supersedeEntity,
    revokeEntity,
    deleteLocation,
    deleteHierarchyGrouping,
    deleteHierarchyValue,
    listItems,
    listDepartments,
    createDepartment,
    deleteDepartment,
    getOrgChartStructure,
    setEmployeeDepartment,
    deleteEmployeeDepartment,
    setEmployeeManager,
    deleteEmployeeManager,
    ApiError,
    type LocationRecord,
    type HierarchyGroupingWithValues,
    type EntityNode,
    type ItemSummary,
    type DepartmentRecord,
    type OrgChartStructure,
    type OrgChartEmployee,
  } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import StructureTreeNode, { type StructureNode } from './StructureTreeNode.svelte';
  import OrgChartNode, { type OrgChartBox } from './OrgChartNode.svelte';
  import Form, { type FormField } from './Form.svelte';

  let { business, onClose }: { business: string; onClose: () => void } = $props();

  // A step-by-step wizard, not a free-form tabbed modal — every step is optional and skippable,
  // because a business (a sole trader working from home, say) can finish having added nothing at
  // all: no locations, no divisions, no categories, no other hierarchy. See
  // docs/pm-frontend-reference.md.
  type Tab = 'structure' | 'categories' | 'hierarchies';
  const STEPS: { id: Tab; title: string; blurb: string }[] = [
    { id: 'structure', title: 'Org Chart', blurb: 'Where this business physically operates, and who works there — locations, divisions, departments, and employees, all in one chart. Add as many as you like, or skip this entirely and come back to it later from the Locations and Employees screens.' },
    { id: 'categories', title: 'Item Categories', blurb: 'An optional way to group what this business sells or stocks. Plenty of businesses never need one — items can always live with no category at all.' },
    { id: 'hierarchies', title: 'Other Hierarchies', blurb: 'Any further grouping this business wants to report by — region, bottle size, storage area — beyond Division. Most businesses never need this.' },
  ];
  let stepIndex = $state(0);
  let activeTab: Tab = $derived(STEPS[stepIndex].id);

  const DIVISION = 'Division';
  const UNASSIGNED_KEY = '__unassigned__';
  const UNASSIGNED_DEPT_KEY = '__unassigned_dept__';

  // A single selection, shared across all three tabs — cleared on every
  // tab/step switch (see goToStep below), since a key from one tree has no
  // meaning in another. The "+ Add"/"Move…" per-node link-buttons stay
  // exactly as they were (see /root/.claude/plans/stateful-snacking-adleman.md's
  // "Open items" — deliberately not folded into this selection model); only
  // Delete (scoped to this modal's own keydown, below) acts on it.
  let selectedKey: string | null = $state(null);
  function selectNode(node: { key: string }) {
    selectedKey = node.key;
  }
  function findNode(tree: StructureNode[], key: string): StructureNode | null {
    for (const n of tree) {
      if (n.key === key) return n;
      const found = findNode(n.children, key);
      if (found) return found;
    }
    return null;
  }

  // ---------------------------------------------------------------
  // Org Chart — Locations, Divisions, Departments, Employees, all
  // together on one graphical OrgChartNode canvas. See
  // /root/.claude/plans/stateful-snacking-adleman.md.
  // ---------------------------------------------------------------
  let locations: LocationRecord[] = $state([]);
  let locationDivision: Record<string, string | null> = $state({});
  let divisionValues: string[] = $state([]);
  let locationTypes: string[] = $state([]);
  let departments: DepartmentRecord[] = $state([]);
  let orgChart: OrgChartStructure | null = $state(null);
  let structureError = $state('');
  let structureLoading = $state(true);

  async function loadStructureTab() {
    structureLoading = true;
    structureError = '';
    try {
      const biz = asBusinessName(business);
      const [locs, hierarchy, types, depts, chart] = await Promise.all([
        listLocations(biz),
        getHierarchy(business),
        getLocationTypes(),
        listDepartments(business),
        getOrgChartStructure(business),
      ]);
      locations = locs;
      locationTypes = types;
      departments = depts;
      orgChart = chart;
      divisionValues = hierarchy.find((h: HierarchyGroupingWithValues) => h.grouping === DIVISION)?.values ?? [];
      // One bulk read, not a per-location getHierarchyTag loop — see
      // getOrgChartStructure/getHierarchyTag's own N+1 note in the plan
      // for why this was worth avoiding for Division too, while already here.
      const tags = await Promise.all(locs.map((l) => getHierarchyTag(l.name, DIVISION).catch(() => ({ parentName: null }))));
      locationDivision = Object.fromEntries(locs.map((l, i) => [l.name, tags[i].parentName]));
    } catch (e) {
      structureError = e instanceof ApiError ? e.message : 'Could not load the org chart.';
    } finally {
      structureLoading = false;
    }
  }

  // One flat box list for OrgChartNode — Locations/Divisions on the left
  // half of the containment forest, Departments/Employees on the right,
  // with Employee.managerId drawing the one, independent, dashed
  // "reports to" connector OrgChartNode's layout handles on its own.
  let orgChartNodes: OrgChartBox[] = $derived.by(() => {
    const nodes: OrgChartBox[] = [];
    for (const v of divisionValues.slice().sort((a, b) => a.localeCompare(b))) {
      nodes.push({ key: `div:${v}`, parentId: null, label: v, kind: 'division', canMove: false });
    }
    nodes.push({ key: UNASSIGNED_KEY, parentId: null, label: 'Unassigned (no division)', kind: 'unassigned' });
    for (const l of locations.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const d = locationDivision[l.name] ?? null;
      nodes.push({ key: `loc:${l.name}`, parentId: d ? `div:${d}` : UNASSIGNED_KEY, label: l.name, kind: 'location', canMove: true });
    }

    for (const d of departments.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      nodes.push({ key: `dept:${d.name}`, parentId: null, label: d.name, kind: 'department', canMove: false });
    }
    nodes.push({ key: UNASSIGNED_DEPT_KEY, parentId: null, label: 'Unassigned (no department)', kind: 'unassigned' });
    const employeeNode = (e: OrgChartEmployee, departmentName: string | null): OrgChartBox => ({
      key: `emp:${e.name}`,
      parentId: departmentName ? `dept:${departmentName}` : UNASSIGNED_DEPT_KEY,
      label: e.name,
      kind: 'employee',
      canMove: true,
      canReassignManager: true,
      managerId: e.managerName ? `emp:${e.managerName}` : null,
    });
    for (const d of orgChart?.departments ?? []) {
      for (const e of d.employees) nodes.push(employeeNode(e, d.name));
    }
    for (const e of orgChart?.unassignedEmployees ?? []) nodes.push(employeeNode(e, null));
    return nodes;
  });
  function findStructureNode(key: string): OrgChartBox | undefined {
    return orgChartNodes.find((n) => n.key === key);
  }
  function allEmployeeNames(): string[] {
    const fromDepartments = (orgChart?.departments ?? []).flatMap((d) => d.employees.map((e) => e.name));
    const unassigned = (orgChart?.unassignedEmployees ?? []).map((e) => e.name);
    return [...fromDepartments, ...unassigned];
  }

  // Add forms — a new Location, or a new Division value.
  let addingLocationForm = $state(false);
  let newLocationValues: Record<string, string | number | string[]> = $state({ name: '', city: '', locationType: 'Retail', bottleCapacity: '', cartonCapacity: '' });
  // Capacity fields, added here — previously this quick-add form had none at all, which is the
  // real root cause of a newly-added location (e.g. a Head Office warehouse) showing a storage
  // capacity of zero: there was never anywhere to enter one. Both optional/blank for a location
  // that doesn't track storage capacity at all (an office, a sole trader's home). See
  // docs/pm-frontend-reference.md.
  const locationFields: FormField[] = $derived.by(() => [
    { name: 'name', label: 'Location name', type: 'text' },
    { name: 'city', label: 'City', type: 'text' },
    { name: 'locationType', label: 'Location type', type: 'select', options: locationTypes },
    { name: 'bottleCapacity', label: 'Bottle capacity (optional)', type: 'text' },
    { name: 'cartonCapacity', label: 'Carton capacity (optional)', type: 'text' },
  ]);
  function parseOptionalInt(v: string | number | string[] | undefined): number | null {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  async function submitNewLocation(values: Record<string, string | number | string[]>) {
    await createLocation(
      String(values.name ?? '').trim(),
      business,
      {
        city: String(values.city ?? '').trim(),
        location_type: String(values.locationType ?? 'Retail'),
        is_billing_address: false,
        bottle_capacity: parseOptionalInt(values.bottleCapacity),
        carton_capacity: parseOptionalInt(values.cartonCapacity),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      'Business Structure Popup'
    );
    addingLocationForm = false;
    newLocationValues = { name: '', city: '', locationType: 'Retail', bottleCapacity: '', cartonCapacity: '' };
    await loadStructureTab();
  }

  let addingDivisionValue = $state(false);
  let newDivisionValueName = $state('');
  async function submitNewDivisionValue() {
    if (!newDivisionValueName.trim()) return;
    try {
      await createHierarchyGrouping(business, DIVISION);
      await createHierarchyValue(business, DIVISION, newDivisionValueName.trim());
      newDivisionValueName = '';
      addingDivisionValue = false;
      await loadStructureTab();
    } catch (e) {
      structureError = e instanceof ApiError ? e.message : 'Could not create division.';
    }
  }

  let addingDepartmentForm = $state(false);
  let newDepartmentName = $state('');
  async function submitNewDepartment() {
    if (!newDepartmentName.trim()) return;
    try {
      await createDepartment(business, newDepartmentName.trim());
      newDepartmentName = '';
      addingDepartmentForm = false;
      await loadStructureTab();
    } catch (e) {
      structureError = e instanceof ApiError ? e.message : 'Could not create department.';
    }
  }

  // "+ Add" is unused on this canvas — no org-chart box sets canAddChild
  // (new Locations/Divisions/Departments all have their own standalone
  // "+ New …" button below the canvas instead); kept only so OrgChartNode's
  // generic contract doesn't need a dead branch for this one caller.
  function onAddChildStructureTab(_node: OrgChartBox) {}

  // "Move…" means "change Division" for a Location, "change Department"
  // for an Employee — one shared moving/options state, dispatched by the
  // currently-moving node's own kind.
  let movingStructureKey: string | null = $state(null);
  let moveStructureOptions: { value: string | null; label: string }[] = $derived.by(() => {
    const node = movingStructureKey ? findStructureNode(movingStructureKey) : undefined;
    if (node?.kind === 'location') {
      return [{ value: null, label: translations.current['Unassigned (no division)'] ?? 'Unassigned (no division)' }, ...divisionValues.map((v) => ({ value: v, label: v }))];
    }
    if (node?.kind === 'employee') {
      return [
        { value: null, label: translations.current['Unassigned (no department)'] ?? 'Unassigned (no department)' },
        ...departments.map((d) => ({ value: d.name, label: d.name })),
      ];
    }
    return [];
  });
  function startMoveStructureNode(node: OrgChartBox) {
    reassigningManagerKey = null;
    movingStructureKey = node.key;
  }
  async function confirmMoveStructureNode(node: OrgChartBox, destination: string | null) {
    try {
      if (node.kind === 'location') {
        if (destination) await setHierarchyTag(node.label, DIVISION, destination);
        else await deleteHierarchyTag(node.label, DIVISION);
      } else if (node.kind === 'employee') {
        if (destination) await setEmployeeDepartment(node.label, destination);
        else await deleteEmployeeDepartment(node.label);
      }
      movingStructureKey = null;
      await loadStructureTab();
    } catch (e) {
      structureError = e instanceof ApiError ? e.message : 'Could not move that.';
    }
  }

  // "Reports to…" — only ever offered on an Employee box; entirely
  // independent of "Move…"/Department (see setEmployeeManager/
  // setEmployeeDepartment's own independent setEntityLink facts).
  let reassigningManagerKey: string | null = $state(null);
  let managerOptions: { value: string | null; label: string }[] = $derived.by(() => {
    const node = reassigningManagerKey ? findStructureNode(reassigningManagerKey) : undefined;
    if (!node) return [];
    return [
      { value: null, label: translations.current['No manager'] ?? 'No manager' },
      ...allEmployeeNames()
        .filter((n) => n !== node.label)
        .sort((a, b) => a.localeCompare(b))
        .map((n) => ({ value: n, label: n })),
    ];
  });
  function startReassignManager(node: OrgChartBox) {
    movingStructureKey = null;
    reassigningManagerKey = node.key;
  }
  async function confirmReassignManager(node: OrgChartBox, managerName: string | null) {
    try {
      if (managerName) await setEmployeeManager(node.label, managerName);
      else await deleteEmployeeManager(node.label);
      reassigningManagerKey = null;
      await loadStructureTab();
    } catch (e) {
      structureError = e instanceof ApiError ? e.message : 'Could not reassign that manager.';
    }
  }

  // Delete, off the shared selection. A real Location/Department deletes
  // itself; a synthetic Division grouping (not the "Unassigned"
  // placeholder, which has no real entity at all) deletes that Division
  // value via the same name-based hierarchy wrapper the Hierarchies tab
  // below uses directly. An Employee box is never created or deleted from
  // here at all (see the Employees screen) — only (re)assigned.
  async function deleteSelectedStructureNode() {
    if (!selectedKey) return;
    const node = findStructureNode(selectedKey);
    if (!node) return;
    if (node.kind === 'location') {
      if (!confirm(`Delete "${translations.current[node.label] ?? node.label}"? This cannot be undone.`)) return;
      try {
        await deleteLocation(node.label, business);
        selectedKey = null;
        await loadStructureTab();
      } catch (e) {
        structureError = e instanceof ApiError ? e.message : 'Could not delete location.';
      }
    } else if (node.kind === 'division' ) {
      if (!confirm(`Delete the "${translations.current[node.label] ?? node.label}" division? This cannot be undone.`)) return;
      try {
        await deleteHierarchyValue(business, DIVISION, node.label);
        selectedKey = null;
        await loadStructureTab();
      } catch (e) {
        structureError = e instanceof ApiError ? e.message : 'Could not delete division.';
      }
    } else if (node.kind === 'department') {
      if (!confirm(`Delete the "${translations.current[node.label] ?? node.label}" department? This cannot be undone.`)) return;
      try {
        await deleteDepartment(node.label, business);
        selectedKey = null;
        await loadStructureTab();
      } catch (e) {
        structureError = e instanceof ApiError ? e.message : 'Could not delete department.';
      }
    }
  }

  // ---------------------------------------------------------------
  // Item Categories
  // ---------------------------------------------------------------
  let entities: EntityNode[] = $state([]);
  let items: ItemSummary[] = $state([]);
  let categoriesError = $state('');
  let categoriesLoading = $state(true);

  async function loadCategoriesTab() {
    categoriesLoading = true;
    categoriesError = '';
    try {
      const [tree, itemsResult] = await Promise.all([getEntityTree(business), listItems(business)]);
      entities = tree;
      items = itemsResult.rows;
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not load item categories.';
    } finally {
      categoriesLoading = false;
    }
  }

  function itemsRootEntity(): EntityNode | undefined {
    const biz = entities.find((e) => e.name === business);
    if (biz) {
      const scoped = entities.find((e) => e.name === 'Items' && e.parent_id === biz.id);
      if (scoped) return scoped;
    }
    return entities.find((e) => e.name === 'Items');
  }

  let categoryTree: StructureNode[] = $derived.by(() => {
    const root = itemsRootEntity();
    if (!root) return [];
    const itemNames = new Set(items.map((i) => i.name));
    const byParentId = new Map<number, EntityNode[]>();
    for (const e of entities) {
      if (e.parent_id == null) continue;
      const list = byParentId.get(e.parent_id) ?? [];
      list.push(e);
      byParentId.set(e.parent_id, list);
    }
    const build = (categoryEntity: EntityNode): StructureNode => {
      const kids = (byParentId.get(categoryEntity.id) ?? []).filter((k) => !itemNames.has(k.name)).sort((a, b) => a.name.localeCompare(b.name));
      return { key: `cat:${categoryEntity.id}`, name: categoryEntity.name, kind: 'category', canAddChild: true, canMove: categoryEntity.id !== root.id, children: kids.map(build) };
    };
    return (byParentId.get(root.id) ?? [])
      .filter((e) => !itemNames.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(build);
  });

  let allCategoryNames: string[] = $derived.by(() => {
    const root = itemsRootEntity();
    const itemNames = new Set(items.map((i) => i.name));
    return entities.filter((e) => e.id !== root?.id && !itemNames.has(e.name) && isUnderItemsRoot(e)).map((e) => e.name);
  });
  function isUnderItemsRoot(e: EntityNode): boolean {
    const root = itemsRootEntity();
    if (!root) return false;
    let cur: EntityNode | undefined = e;
    const byId = new Map(entities.map((x) => [x.id, x]));
    let guard = 0;
    while (cur && guard++ < 50) {
      if (cur.id === root.id) return true;
      cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  }

  let addingCategoryUnder: StructureNode | 'root' | null = $state(null);
  let newCategoryName = $state('');
  function onAddChildCategoriesTab(node: StructureNode) {
    addingCategoryUnder = node;
    newCategoryName = '';
  }
  function addTopLevelCategory() {
    addingCategoryUnder = 'root';
    newCategoryName = '';
  }
  async function submitNewCategory() {
    if (!newCategoryName.trim() || !addingCategoryUnder) return;
    const root = itemsRootEntity();
    if (!root) return;
    const parentId = addingCategoryUnder === 'root' ? root.id : entities.find((e) => e.name === (addingCategoryUnder as StructureNode).name)?.id;
    if (!parentId) return;
    try {
      await createEntity({ name: newCategoryName.trim(), parentId }, 'Business Structure Popup');
      addingCategoryUnder = null;
      newCategoryName = '';
      await loadCategoriesTab();
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not create category.';
    }
  }

  // supersedeEntity's own reparent API (backend/src/db.ts:402, api.ts:148)
  // takes a bare parent NAME, not a parent id — a pre-existing
  // limitation this popup inherits rather than introduces (the
  // Structured Editor's own reparent dropdown has the same one). Every
  // business's Items root is literally named "Items" (only unique
  // among siblings under the same parent, per schema/00-core.sql's
  // entities_name_unique trigger), so "move to top level" is reliable
  // only while at most one business's Items root is reachable by that
  // bare name at once — true for this app's own single-business-at-a-
  // time demo/test setup, but worth fixing in supersedeEntity itself
  // (accepting a parent id) before this popup is trusted multi-business.
  let movingCategoryKey: string | null = $state(null);
  let moveCategoryOptions: { value: string | null; label: string }[] = $derived.by(() => {
    const root = itemsRootEntity();
    const options = root ? [{ value: root.name, label: `${translations.current['Top level'] ?? 'Top level'} (${root.name})` }] : [];
    return [...options, ...allCategoryNames.sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n }))];
  });
  function startMoveCategory(node: StructureNode) {
    movingCategoryKey = node.key;
  }
  async function confirmMoveCategory(node: StructureNode, destination: string | null) {
    if (!destination) return;
    const entity = entities.find((e) => e.name === node.name);
    if (!entity) return;
    try {
      await supersedeEntity(entity.id, { parent: destination });
      movingCategoryKey = null;
      await loadCategoriesTab();
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not move category.';
    }
  }

  async function deleteSelectedCategoryNode() {
    if (!selectedKey) return;
    const node = findNode(categoryTree, selectedKey);
    if (!node || node.kind !== 'category') return;
    const entity = entities.find((e) => e.name === node.name);
    if (!entity) return;
    if (!confirm(`Delete "${translations.current[node.name] ?? node.name}"? This cannot be undone.`)) return;
    try {
      await revokeEntity(entity.id);
      selectedKey = null;
      await loadCategoriesTab();
    } catch (e) {
      categoriesError = e instanceof ApiError ? e.message : 'Could not delete category.';
    }
  }

  // ---------------------------------------------------------------
  // Other Hierarchies (any grouping other than Division)
  // ---------------------------------------------------------------
  let hierarchy: HierarchyGroupingWithValues[] = $state([]);
  let hierarchiesError = $state('');
  let hierarchiesLoading = $state(true);

  async function loadHierarchiesTab() {
    hierarchiesLoading = true;
    hierarchiesError = '';
    try {
      hierarchy = (await getHierarchy(business)).filter((h) => h.grouping !== DIVISION);
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not load hierarchies.';
    } finally {
      hierarchiesLoading = false;
    }
  }

  let hierarchiesTree: StructureNode[] = $derived.by(() =>
    hierarchy
      .slice()
      .sort((a, b) => a.grouping.localeCompare(b.grouping))
      .map((h) => ({
        key: `grp:${h.grouping}`,
        name: h.grouping,
        kind: 'hierarchy-value',
        canAddChild: true,
        children: h.values
          .slice()
          .sort((a, b) => a.localeCompare(b))
          .map((v) => ({ key: `grp:${h.grouping}:${v}`, name: v, kind: 'hierarchy-value', children: [] }) as StructureNode),
      }))
  );

  let addingGrouping = $state(false);
  let newGroupingName = $state('');
  async function submitNewGrouping() {
    if (!newGroupingName.trim()) return;
    try {
      await createHierarchyGrouping(business, newGroupingName.trim());
      newGroupingName = '';
      addingGrouping = false;
      await loadHierarchiesTab();
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not create hierarchy.';
    }
  }

  let addingValueUnderGrouping: string | null = $state(null);
  let newHierarchyValueName = $state('');
  function onAddChildHierarchiesTab(node: StructureNode) {
    // Only grouping-level nodes (no ':' in their key beyond "grp:<name>")
    // offer "+ Add" here, to add a new value under that grouping.
    if (node.key.split(':').length === 2) {
      addingValueUnderGrouping = node.name;
      newHierarchyValueName = '';
    }
  }
  async function submitNewHierarchyValue() {
    if (!newHierarchyValueName.trim() || !addingValueUnderGrouping) return;
    try {
      await createHierarchyValue(business, addingValueUnderGrouping, newHierarchyValueName.trim());
      addingValueUnderGrouping = null;
      newHierarchyValueName = '';
      await loadHierarchiesTab();
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not create hierarchy value.';
    }
  }

  // Keys are 'grp:<name>' for a grouping, 'grp:<name>:<value>' for a value
  // under it — same convention onAddChildHierarchiesTab above already uses.
  async function deleteSelectedHierarchyNode() {
    if (!selectedKey) return;
    const node = findNode(hierarchiesTree, selectedKey);
    if (!node) return;
    const parts = node.key.split(':');
    if (!confirm(`Delete "${translations.current[node.name] ?? node.name}"? This cannot be undone.`)) return;
    try {
      if (parts.length === 2) await deleteHierarchyGrouping(business, node.name);
      else await deleteHierarchyValue(business, parts[1], node.name);
      selectedKey = null;
      await loadHierarchiesTab();
    } catch (e) {
      hierarchiesError = e instanceof ApiError ? e.message : 'Could not delete hierarchy.';
    }
  }

  function deleteSelectedNode() {
    if (activeTab === 'structure') deleteSelectedStructureNode();
    else if (activeTab === 'categories') deleteSelectedCategoryNode();
    else deleteSelectedHierarchyNode();
  }

  function loadStep(tab: Tab) {
    if (tab === 'structure' && locations.length === 0 && structureLoading) loadStructureTab();
    if (tab === 'categories' && entities.length === 0 && categoriesLoading) loadCategoriesTab();
    if (tab === 'hierarchies' && hierarchy.length === 0 && hierarchiesLoading) loadHierarchiesTab();
  }
  function goToStep(index: number) {
    if (index < 0 || index >= STEPS.length) return;
    stepIndex = index;
    selectedKey = null;
    loadStep(STEPS[index].id);
  }

  // Delete, scoped to this modal only (never window/document) — the
  // existing onclick={(e) => e.stopPropagation()} below already keeps
  // every keydown here from reaching +layout.svelte's own global handler;
  // this adds the one real key this modal now needs to act on.
  function onPanelKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    e.stopPropagation();
    if (e.key === 'Delete' && target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      deleteSelectedNode();
    }
  }
  function nextStep() {
    if (stepIndex < STEPS.length - 1) goToStep(stepIndex + 1);
    else onClose();
  }
  function prevStep() {
    goToStep(stepIndex - 1);
  }

  // Load the first step eagerly on mount.
  loadStructureTab();
</script>

<div class="overlay" role="presentation" onclick={onClose}>
  <div class="panel" role="dialog" aria-modal="true" tabindex="-1" aria-label={translations.current['Business Structure'] ?? 'Business Structure'} onclick={(e) => e.stopPropagation()} onkeydown={onPanelKeydown}>
    <header>
      <h2>{translations.current['Business Structure'] ?? 'Business Structure'}</h2>
      <button type="button" class="close-btn" onclick={onClose} aria-label="Close">×</button>
    </header>
    <nav class="stepper" aria-label="Setup steps">
      {#each STEPS as step, i (step.id)}
        <button
          type="button"
          class="step"
          class:active={i === stepIndex}
          class:done={i < stepIndex}
          onclick={() => goToStep(i)}
        >
          <span class="step-num">{i < stepIndex ? '✓' : i + 1}</span>
          <span class="step-title">{translations.current[step.title] ?? step.title}</span>
        </button>
        {#if i < STEPS.length - 1}<span class="step-sep"></span>{/if}
      {/each}
    </nav>
    <p class="step-blurb">{translations.current[STEPS[stepIndex].blurb] ?? STEPS[stepIndex].blurb}</p>

    <div class="tab-body">
      {#if activeTab === 'structure'}
        {#if structureError}<p class="error">{structureError}</p>{/if}
        {#if structureLoading}
          <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
        {:else}
          <div class="org-chart">
            <OrgChartNode
              nodes={orgChartNodes}
              onAddChild={onAddChildStructureTab}
              onStartMove={startMoveStructureNode}
              movingKey={movingStructureKey}
              moveOptions={moveStructureOptions}
              onConfirmMove={confirmMoveStructureNode}
              onCancelMove={() => (movingStructureKey = null)}
              onStartReassignManager={startReassignManager}
              reassigningManagerKey={reassigningManagerKey}
              {managerOptions}
              onConfirmReassignManager={confirmReassignManager}
              onCancelReassignManager={() => (reassigningManagerKey = null)}
              {selectedKey}
              onSelect={selectNode}
            />
          </div>
          <p class="keyboard-hint">{translations.current['Select a box, then press Delete to remove it. Locations/Divisions and Departments delete here; Employees are only (re)assigned here — see the Employees screen to add or remove one.'] ?? 'Select a box, then press Delete to remove it. Locations/Divisions and Departments delete here; Employees are only (re)assigned here — see the Employees screen to add or remove one.'}</p>
          <div class="tab-actions">
            {#if !addingLocationForm}
              <button type="button" class="btn" onclick={() => (addingLocationForm = true)}>+ {translations.current['New Location'] ?? 'New Location'}</button>
            {/if}
            {#if !addingDivisionValue}
              <button type="button" class="btn secondary" onclick={() => (addingDivisionValue = true)}>+ {translations.current['New Division'] ?? 'New Division'}</button>
            {/if}
            {#if !addingDepartmentForm}
              <button type="button" class="btn secondary" onclick={() => (addingDepartmentForm = true)}>+ {translations.current['New Department'] ?? 'New Department'}</button>
            {/if}
          </div>
          {#if addingLocationForm}
            <Form fields={locationFields} values={newLocationValues} onSubmit={submitNewLocation} submitLabel="Create Location" />
          {/if}
          {#if addingDivisionValue}
            <div class="inline-form">
              <input bind:value={newDivisionValueName} placeholder={translations.current['Division name, e.g. Adelaide Metro'] ?? 'Division name, e.g. Adelaide Metro'} />
              <button type="button" class="btn" onclick={submitNewDivisionValue}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingDivisionValue = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
          {#if addingDepartmentForm}
            <div class="inline-form">
              <input bind:value={newDepartmentName} placeholder={translations.current['Department name, e.g. Sales'] ?? 'Department name, e.g. Sales'} />
              <button type="button" class="btn" onclick={submitNewDepartment}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingDepartmentForm = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        {/if}
      {:else if activeTab === 'categories'}
        {#if categoriesError}<p class="error">{categoriesError}</p>{/if}
        {#if categoriesLoading}
          <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
        {:else}
          <div class="tree">
            {#each categoryTree as node (node.key)}
              <StructureTreeNode {node} onAddChild={onAddChildCategoriesTab} onStartMove={startMoveCategory} movingKey={movingCategoryKey} moveOptions={moveCategoryOptions} onConfirmMove={confirmMoveCategory} onCancelMove={() => (movingCategoryKey = null)} {selectedKey} onSelect={selectNode} />
            {/each}
          </div>
          <p class="keyboard-hint">{translations.current['Select a category, then press Delete to remove it.'] ?? 'Select a category, then press Delete to remove it.'}</p>
          <div class="tab-actions">
            <button type="button" class="btn" onclick={addTopLevelCategory}>+ {translations.current['New top-level category'] ?? 'New top-level category'}</button>
          </div>
          {#if addingCategoryUnder}
            <div class="inline-form">
              <input bind:value={newCategoryName} placeholder={translations.current['Category name'] ?? 'Category name'} />
              <button type="button" class="btn" onclick={submitNewCategory}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingCategoryUnder = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        {/if}
      {:else}
        {#if hierarchiesError}<p class="error">{hierarchiesError}</p>{/if}
        {#if hierarchiesLoading}
          <p>{translations.current['Loading…'] ?? 'Loading…'}</p>
        {:else}
          <p class="field-note">{translations.current['Any further grouping your business wants to report by — region, bottle size, storage area — beyond Division.'] ?? 'Any further grouping your business wants to report by — region, bottle size, storage area — beyond Division.'}</p>
          <div class="tree">
            {#each hierarchiesTree as node (node.key)}
              <StructureTreeNode {node} onAddChild={onAddChildHierarchiesTab} onStartMove={() => {}} movingKey={null} moveOptions={[]} onConfirmMove={() => {}} onCancelMove={() => {}} {selectedKey} onSelect={selectNode} />
            {/each}
          </div>
          <p class="keyboard-hint">{translations.current['Select a grouping or value, then press Delete to remove it.'] ?? 'Select a grouping or value, then press Delete to remove it.'}</p>
          <div class="tab-actions">
            {#if !addingGrouping}
              <button type="button" class="btn" onclick={() => (addingGrouping = true)}>+ {translations.current['New Hierarchy'] ?? 'New Hierarchy'}</button>
            {/if}
          </div>
          {#if addingGrouping}
            <div class="inline-form">
              <input bind:value={newGroupingName} placeholder={translations.current['Hierarchy name, e.g. Storage'] ?? 'Hierarchy name, e.g. Storage'} />
              <button type="button" class="btn" onclick={submitNewGrouping}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingGrouping = false)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
          {#if addingValueUnderGrouping}
            <div class="inline-form">
              <input bind:value={newHierarchyValueName} placeholder={translations.current['Value name, e.g. Secure'] ?? 'Value name, e.g. Secure'} />
              <button type="button" class="btn" onclick={submitNewHierarchyValue}>{translations.current['Create'] ?? 'Create'}</button>
              <button type="button" class="btn secondary" onclick={() => (addingValueUnderGrouping = null)}>{translations.current['Cancel'] ?? 'Cancel'}</button>
            </div>
          {/if}
        {/if}
      {/if}
    </div>

    <footer class="wizard-nav">
      <button type="button" class="btn secondary" onclick={prevStep} disabled={stepIndex === 0}>{translations.current['Back'] ?? 'Back'}</button>
      <span class="step-count">{translations.current['Step'] ?? 'Step'} {stepIndex + 1} {translations.current['of'] ?? 'of'} {STEPS.length}</span>
      <button type="button" class="btn" onclick={nextStep}>
        {stepIndex === STEPS.length - 1 ? (translations.current['Finish'] ?? 'Finish') : (translations.current['Next'] ?? 'Next')}
      </button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 20, 20, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .panel {
    background: var(--paper);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
    width: min(44rem, 92vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.2rem;
    border-bottom: 1px solid var(--rule);
  }
  header h2 {
    margin: 0;
    font-size: var(--font-size-large);
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    color: var(--ink-soft);
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 1rem 1.2rem 0;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    padding: 0.3rem 0.4rem;
    cursor: pointer;
    font: inherit;
    color: var(--ink-soft);
  }
  .step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    border: 2px solid var(--rule);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .step.active .step-num {
    border-color: var(--brass);
    background: var(--brass);
    color: var(--paper);
  }
  .step.done .step-num {
    border-color: var(--brass);
    color: var(--brass);
  }
  .step.active .step-title {
    color: var(--ink);
    font-weight: 600;
  }
  .step-sep {
    flex: 1;
    height: 1px;
    background: var(--rule);
    margin: 0 0.2rem;
  }
  .step-blurb {
    margin: 0.6rem 1.2rem 0;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid var(--rule);
    color: var(--ink-soft);
    font-size: var(--font-size-small, 0.9rem);
  }
  .wizard-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem 1.2rem;
    border-top: 1px solid var(--rule);
  }
  .step-count {
    color: var(--ink-soft);
    font-size: var(--font-size-small, 0.9rem);
  }
  .tab-body {
    padding: 1rem 1.2rem;
    overflow-y: auto;
  }
  .tree {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 0.5rem;
    margin-bottom: 0.8rem;
    max-height: 18rem;
    overflow-y: auto;
  }
  .org-chart {
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 0.8rem;
    margin-bottom: 0.8rem;
    max-height: 22rem;
    overflow: auto;
  }
  .tab-actions {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 0.8rem;
  }
  .inline-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .keyboard-hint {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin: -0.4rem 0 0.8rem;
  }
</style>

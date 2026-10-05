<script lang="ts">
  import { onMount } from 'svelte';
  import { Tree, type LTreeNode } from '@keenmate/svelte-treeview';
  import { getEntityTree, createEntity, supersedeEntity, deleteEntity, ApiError, type EntityNode } from '$lib/api';
  import { toTreePaths, type TreeItem } from '$lib/treeAdapter';
  import { auth, session } from '$lib/state.svelte';
  import { formatAmount } from '$lib/format';
  import { translations } from '$lib/state.svelte';

  /** The real, single source of truth for any real, dynamic entity
   * name's own display — never the raw, English name directly. */
  function T(name: string): string {
    return translations.current[name] ?? name;
  }

  // Real, direct, structural anchors — the Balance Sheet and P&L's
  // own shape rests on these existing exactly where they are. Never
  // offered for rename or delete here, regardless of whether the
  // real, underlying deleteEntity safeguards (no children, no
  // postings) would technically allow it — this is a real, additional,
  // deliberate guard rail for the accounting structure itself, not
  // just data integrity.
  const SACROSANCT = new Set([
    'Chart of Accounts',
    'Asset',
    'Liability',
    'Equity',
    'Income',
    'Expense',
    'Sales Revenue',
    'Cost of Goods Sold',
    'Inventory',
  ]);

  let allEntities: EntityNode[] = $state([]);
  let treeData: TreeItem[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let message = $state('');

  let selectedNode: LTreeNode<TreeItem> | null = $state(null);
  let selectedEntity: EntityNode | null = $state(null);

  let newChildName = $state('');
  let renameValue = $state('');
  let renaming = $state(false);
  let adding = $state(false);
  let deleting = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      allEntities = await getEntityTree();
      const biz = allEntities.find((e) => e.name === session.current?.businessName);
      if (!biz) {
        error = 'No real business selected.';
        return;
      }
      const coaRoot = allEntities.find((e) => e.name === 'Chart of Accounts' && e.parent_id === biz.id);
      if (!coaRoot) {
        error = 'No real "Chart of Accounts" entity found for this business.';
        return;
      }
      const included = new Set<number>([coaRoot.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of allEntities) {
          if (e.parent_id != null && included.has(e.parent_id) && !included.has(e.id)) {
            included.add(e.id);
            changed = true;
          }
        }
      }
      const subset = allEntities
        .filter((e) => included.has(e.id))
        .map((e) => (e.id === coaRoot.id ? { ...e, parent_id: null } : e));
      treeData = toTreePaths(subset);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function minorUnitsToStr(minorUnits: number | null): string {
    if (minorUnits == null) return '';
    return formatAmount(minorUnits, auth.current?.user.number_format ?? '1 000.00');
  }

  function onNodeClicked(node: LTreeNode<TreeItem>) {
    selectedNode = node;
    error = '';
    message = '';
    newChildName = '';
    renaming = false;
    selectedEntity = node.data ? allEntities.find((e) => e.id === node.data!.id) ?? null : null;
    if (selectedEntity) renameValue = selectedEntity.name;
  }

  let isSacrosanct = $derived.by(() => selectedEntity ? SACROSANCT.has(selectedEntity.name) : false);

  async function addChild() {
    if (!selectedEntity || !newChildName.trim()) return;
    adding = true;
    error = '';
    try {
      await createEntity({ name: newChildName.trim(), parent: selectedEntity.name });
      message = `"${newChildName.trim()}" ${T('added under')} "${T(selectedEntity.name)}".`;
      newChildName = '';
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not add this account.';
    } finally {
      adding = false;
    }
  }

  async function rename() {
    if (!selectedEntity || !renameValue.trim() || renameValue === selectedEntity.name) {
      renaming = false;
      return;
    }
    renaming = true;
    error = '';
    try {
      await supersedeEntity(selectedEntity.id, { name: renameValue.trim() });
      message = `${T('Renamed to')} "${renameValue.trim()}".`;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not rename this account.';
    } finally {
      renaming = false;
    }
  }

  async function remove() {
    if (!selectedEntity) return;
    if (!confirm(`${T('Delete')} "${T(selectedEntity.name)}"? ${T("This can't be undone.")}`)) return;
    deleting = true;
    error = '';
    try {
      await deleteEntity(selectedEntity.id);
      message = `"${T(selectedEntity.name)}" ${T('deleted.')}`;
      selectedNode = null;
      selectedEntity = null;
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not delete this account.';
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:head><title>{translations.current['Chart of Accounts'] ?? 'Chart of Accounts'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Chart of Accounts'] ?? 'Chart of Accounts'}</legend>
  <p class="intro">
    {translations.current["Every real account, in hierarchy order, under Asset, Liability, Equity, Income, and Expense. The Balance Sheet and P&L's own structure rests on this tree — the five top-level categories, and a few further, established anchors, can't be renamed or deleted here."] ?? "Every real account, in hierarchy order, under Asset, Liability, Equity, Income, and Expense. The Balance Sheet and P&L's own structure rests on this tree — the five top-level categories, and a few further, established anchors, can't be renamed or deleted here."}
  </p>

  {#if loading}
    <p>Loading…</p>
  {:else if error && treeData.length === 0}
    <p class="error">{error}</p>
  {:else}
    <div class="layout">
      <div class="card tree-card">
        <Tree
          data={treeData}
          idMember="path"
          pathMember="path"
          displayValueMember="name"
          expandLevel={2}
          {onNodeClicked}
          bind:selectedNode
          selectedNodeClass="node-selected"
        >
          {#snippet nodeTemplate(node: LTreeNode<TreeItem>)}
            {#if node.data}
              <span class="node-label">{T(node.data.name)}</span>
              {#if node.data.accountnumber}
                <span class="mono account-tag">{node.data.accountnumber}</span>
              {/if}
              {#if node.data.balance_minor != null && node.data.balance_minor !== 0}
                <span
                  class="mono balance-tag"
                  class:amount-debit={node.data.balance_minor > 0}
                  class:amount-credit={node.data.balance_minor < 0}
                >
                  {minorUnitsToStr(node.data.balance_minor)}
                </span>
              {/if}
            {/if}
          {/snippet}
        </Tree>
      </div>

      <div class="card detail-card">
        {#if !selectedEntity}
          <p class="hint">{translations.current['Select an account on the left.'] ?? 'Select an account on the left.'}</p>
        {:else}
          <h3>{T(selectedEntity.name)}</h3>
          {#if selectedEntity.accountnumber}<p class="mono">{selectedEntity.accountnumber}</p>{/if}
          {#if selectedEntity.balance_minor != null}
            <p class="mono" class:amount-debit={selectedEntity.balance_minor > 0} class:amount-credit={selectedEntity.balance_minor < 0}>
              {minorUnitsToStr(selectedEntity.balance_minor)}
            </p>
          {/if}

          {#if isSacrosanct}
            <p class="sacrosanct-note">
              {translations.current["This account is structural to the Balance Sheet/P&L's own shape and can't be renamed or deleted here."] ?? "This account is structural to the Balance Sheet/P&L's own shape and can't be renamed or deleted here."}
            </p>
          {/if}

          <fieldset class="action">
            <legend>{translations.current['Add a new account under this one'] ?? 'Add a new account under this one'}</legend>
            <input bind:value={newChildName} placeholder="e.g. Office Supplies" onkeydown={(e) => e.key === 'Enter' && addChild()} />
            <button class="btn" onclick={addChild} disabled={adding || !newChildName.trim()}>
              {translations.current['Add'] ?? 'Add'}
            </button>
          </fieldset>

          {#if !isSacrosanct}
            <fieldset class="action">
              <legend>{translations.current['Rename'] ?? 'Rename'}</legend>
              <input bind:value={renameValue} onkeydown={(e) => e.key === 'Enter' && rename()} />
              <button class="btn" onclick={rename} disabled={renaming || !renameValue.trim()}>
                {translations.current['Save'] ?? 'Save'}
              </button>
            </fieldset>

            <button class="btn danger" onclick={remove} disabled={deleting}>
              {translations.current['Delete'] ?? 'Delete'}
            </button>
          {/if}
        {/if}

        {#if error}<p class="error">{error}</p>{/if}
        {#if message}<p class="success">{message}</p>{/if}
      </div>
    </div>
  {/if}
</fieldset>

<style>
  .layout {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .tree-card {
    padding: 1rem 1.2rem;
    flex: 2;
    min-width: 0;
  }

  .detail-card {
    padding: 1rem 1.2rem;
    flex: 1;
    min-width: 260px;
  }

  .node-label {
    margin-right: 0.6rem;
  }

  .account-tag {
    font-size: var(--font-size-small);
    color: var(--ink-soft);
    margin-right: 0.6rem;
  }

  .balance-tag {
    font-size: var(--font-size-small);
  }

  .hint {
    color: var(--ink-soft);
  }

  .sacrosanct-note {
    font-size: var(--font-size-base);
    color: var(--ink-soft);
    background: var(--paper-alt, #f5f2ea);
    border-radius: 4px;
    padding: 0.5rem 0.7rem;
  }

  .action {
    margin-top: 0.8rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action input {
    flex: 1;
  }

  .danger {
    margin-top: 0.8rem;
    background: var(--danger, #b3382c);
    color: white;
  }

  :global(.node-selected) {
    background: var(--accent-soft, #f0e6cf);
  }
</style>

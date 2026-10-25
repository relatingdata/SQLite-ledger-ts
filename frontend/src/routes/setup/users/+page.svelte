<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, hasRole } from '$lib/state.svelte';
  import { translations } from '$lib/state.svelte';
  import {
    getUsers,
    getRoles,
    createUserAccount,
    setUserRolesApi,
    setUserActiveApi,
    changeUserPassword,
    getBusinesses,
    getUserRoleMatrix,
    setUserRoleInBusiness,
    unsetUserRoleInBusiness,
    ApiError,
    type UserSummary,
    type UserRoleMatrix,
  } from '$lib/api';

  import Form from '$lib/components/Form.svelte';

  let users: UserSummary[] = [];
  let roles: { id: number; name: string }[] = [];
  let loading = true;
  let error = '';
  let message = '';

  // Per-business User x Role matrix, additive — see docs/pm-frontend-reference.md.
  let businesses: { id: number; name: string }[] = [];
  let matrixBusiness = '';
  let matrix: UserRoleMatrix | null = null;
  let matrixError = '';

  async function loadMatrix() {
    if (!matrixBusiness) {
      matrix = null;
      return;
    }
    matrixError = '';
    try {
      matrix = await getUserRoleMatrix(matrixBusiness);
    } catch (e) {
      matrixError = e instanceof ApiError ? e.message : 'Could not load the role matrix.';
    }
  }

  async function toggleMatrixCell(username: string, roleName: string) {
    if (!matrixBusiness || !matrix) return;
    matrixError = '';
    const isSet = matrix.assignments.some((a) => a.user === username && a.role === roleName);
    try {
      if (isSet) await unsetUserRoleInBusiness(matrixBusiness, username, roleName);
      else await setUserRoleInBusiness(matrixBusiness, username, roleName);
      await loadMatrix();
    } catch (e) {
      matrixError = e instanceof ApiError ? e.message : 'Could not update the role matrix.';
    }
  }

  let newUserValues: Record<string, string | number | string[]> = { username: '', password: '', roles: [] };

  // Selection + Insert/Delete model (see docs/pm-frontend-reference.md,
  // "Insert/Enter/Escape/Delete"). This page has no $state/$props runes
  // anywhere else, so these stay plain `let` too, matching its existing
  // legacy-reactivity style rather than mixing modes within one file.
  let selectedUserId: number | null = null;
  let inserting = false;

  function selectUser(e: MouseEvent | KeyboardEvent, u: UserSummary) {
    selectedUserId = u.id;
    (e.currentTarget as HTMLElement)?.focus();
  }

  function openInsert() {
    inserting = true;
  }

  function closeInsert() {
    inserting = false;
    newUserValues = { username: '', password: '', roles: [] };
  }

  // Scoped to the user-list card's own toolbar div, target-tag-filtered
  // the same way every other converted screen's handler is, so typing in
  // the checkbox/password/reset-password inputs never fires these.
  function handleTableKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    if (e.key === 'Insert') {
      e.preventDefault();
      openInsert();
    } else if (e.key === 'Delete' && selectedUserId != null) {
      const u = users.find((x) => x.id === selectedUserId);
      if (u && u.active) {
        e.preventDefault();
        deactivate(u);
      }
    }
  }

  async function load() {
    loading = true;
    try {
      [users, roles, businesses] = await Promise.all([getUsers(), getRoles(), getBusinesses()]);
      if (!matrixBusiness && businesses[0]) matrixBusiness = businesses[0].name;
      await loadMatrix();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load.';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function create(values: Record<string, string | number | string[]>) {
    const username = String(values.username ?? '');
    const password = String(values.password ?? '');
    const roleNames = (values.roles as string[] | undefined) ?? [];
    if (!username || password.length < 8 || roleNames.length === 0) {
      throw new Error('Username, a password of at least 8 characters, and at least one role are all required.');
    }
    await createUserAccount(username, password, roleNames);
    closeInsert();
    await load();
  }

  async function toggleRole(user: UserSummary, roleName: string) {
    error = '';
    const nextRoles = user.roles.includes(roleName) ? user.roles.filter((r) => r !== roleName) : [...user.roles, roleName];
    try {
      await setUserRolesApi(user.id, nextRoles);
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not update roles.';
    }
  }

  // Delete only naturally maps to deactivation, per the plan — reactivation
  // stays a real, explicit button below (an Inactive row has nothing
  // selectable about it that Delete could sensibly mean).
  async function deactivate(user: UserSummary) {
    error = '';
    try {
      await setUserActiveApi(user.id, false);
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not deactivate user.';
    }
  }

  async function reactivate(user: UserSummary) {
    error = '';
    try {
      await setUserActiveApi(user.id, true);
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not reactivate user.';
    }
  }

  let resettingId: number | null = null;
  let resetPassword = '';

  async function submitReset(userId: number) {
    error = '';
    if (resetPassword.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }
    try {
      await changeUserPassword(userId, resetPassword);
      resettingId = null;
      resetPassword = '';
      message = 'Password changed.';
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not change password.';
    }
  }
</script>

<svelte:head><title>{translations.current['Users'] ?? 'Users'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Users'] ?? 'Users'}</legend>
{#if !hasRole(auth.current, 'Administrator')}
  <p class="error">{translations.current['Only an Administrator can manage users.'] ?? 'Only an Administrator can manage users.'}</p>
{:else if loading}
  <p>Loading…</p>
{:else}
  {#if error}<p class="error">{error}</p>{/if}
  {#if message}<p class="success">{message}</p>{/if}

  <div class="card" role="toolbar" tabindex="0" aria-keyshortcuts="Insert Delete" onkeydown={handleTableKeydown}>
    <table>
      <thead>
        <tr>
          <th>{translations.current['Username'] ?? 'Username'}</th>
          <th>{translations.current['Active'] ?? 'Active'}</th>
          {#each roles as r}<th>{translations.current[r.name] ?? r.name}</th>{/each}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each users as u}
          <tr
            tabindex="0"
            class:selected={selectedUserId === u.id}
            onclick={(e) => selectUser(e, u)}
            onkeydown={(e) => e.key === 'Enter' && selectUser(e, u)}
          >
            <td>{u.username}</td>
            <td>
              {#if u.active}
                {translations.current['Active'] ?? 'Active'}
              {:else}
                <button class="link" onclick={(e) => { e.stopPropagation(); reactivate(u); }}>{translations.current['Reactivate'] ?? 'Reactivate'}</button>
              {/if}
            </td>
            {#each roles as r}
              <td>
                <input type="checkbox" checked={u.roles.includes(r.name)} onchange={() => toggleRole(u, r.name)} onclick={(e) => e.stopPropagation()} />
              </td>
            {/each}
            <td>
              {#if resettingId === u.id}
                <input type="password" bind:value={resetPassword} placeholder="new password" onclick={(e) => e.stopPropagation()} />
                <button class="link" onclick={(e) => { e.stopPropagation(); submitReset(u.id); }}>{translations.current['Save'] ?? 'Save'}</button>
              {:else}
                <button class="link" onclick={(e) => { e.stopPropagation(); resettingId = u.id; resetPassword = ''; }}>{translations.current['Reset password'] ?? 'Reset password'}</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="keyboard-hint">{translations.current['Insert adds a new user. Delete deactivates the selected, active user.'] ?? 'Insert adds a new user. Delete deactivates the selected, active user.'}</p>
  </div>

  <div class="card">
    <h3>{translations.current['Roles per business'] ?? 'Roles per business'}</h3>
    <p class="hint">{translations.current['Which roles a user holds in one specific business — a separate fact from the global role above, additive and independent of it.'] ?? 'Which roles a user holds in one specific business — a separate fact from the global role above, additive and independent of it.'}</p>
    <label>
      {translations.current['Business'] ?? 'Business'}
      <select bind:value={matrixBusiness} onchange={loadMatrix}>
        {#each businesses as b}<option value={b.name}>{b.name}</option>{/each}
      </select>
    </label>
    {#if matrixError}<p class="error">{matrixError}</p>{/if}
    {#if matrix}
      <table>
        <thead>
          <tr>
            <th>{translations.current['Username'] ?? 'Username'}</th>
            {#each matrix.roles as r}<th>{translations.current[r] ?? r}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each matrix.users as u}
            <tr>
              <td>{u}</td>
              {#each matrix.roles as r}
                <td>
                  <input type="checkbox" checked={matrix.assignments.some((a) => a.user === u && a.role === r)} onchange={() => toggleMatrixCell(u, r)} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if inserting}
    <div class="card form-card">
      <h3>{translations.current['New user'] ?? 'New user'}</h3>
      <Form
        fields={[
          { name: 'username', label: 'Username', type: 'text' },
          { name: 'password', label: 'Password', type: 'password', hint: 'at least 8 characters' },
          { name: 'roles', label: 'Roles', type: 'multiselect', options: roles.map((r) => r.name) },
        ]}
        bind:values={newUserValues}
        onSubmit={create}
        showSubmitButton={false}
        onCancel={closeInsert}
      />
    </div>
  {/if}
{/if}

</fieldset>
<style>
  .form-card {
    margin-top: 1.2rem;
    padding: 1.1rem 1.2rem 1.3rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    max-width: 400px;
  }

  .form-card h3 {
    margin: 0;
  }

  .link {
    background: none;
    border: none;
    color: var(--brass-dark);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-base);
  }

  .success {
    color: var(--credit);
  }

  tr[tabindex] {
    cursor: pointer;
  }

  tr.selected {
    background: var(--accent-soft, #f0e6cf);
  }

  .keyboard-hint {
    margin-top: 0.6rem;
    font-size: var(--font-size-small);
    color: var(--ink-soft);
  }
</style>

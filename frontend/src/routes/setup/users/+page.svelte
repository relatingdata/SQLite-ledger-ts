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
    newUserValues = { username: '', password: '', roles: [] };
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

  async function toggleActive(user: UserSummary) {
    error = '';
    try {
      await setUserActiveApi(user.id, !user.active);
      await load();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Could not update user.';
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

  <div class="card">
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
          <tr>
            <td>{u.username}</td>
            <td>
              <button class="link" onclick={() => toggleActive(u)}>{u.active ? 'Active' : 'Inactive'}</button>
            </td>
            {#each roles as r}
              <td>
                <input type="checkbox" checked={u.roles.includes(r.name)} onchange={() => toggleRole(u, r.name)} />
              </td>
            {/each}
            <td>
              {#if resettingId === u.id}
                <input type="password" bind:value={resetPassword} placeholder="new password" />
                <button class="link" onclick={() => submitReset(u.id)}>{translations.current['Save'] ?? 'Save'}</button>
              {:else}
                <button class="link" onclick={() => { resettingId = u.id; resetPassword = ''; }}>{translations.current['Reset password'] ?? 'Reset password'}</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
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
      submitLabel="Create user"
    />
  </div>
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
</style>

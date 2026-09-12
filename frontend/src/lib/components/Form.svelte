<script lang="ts">
  // Form.svelte — the one, real, generic form component this whole
  // application should compose, per the one-file-per-page
  // consolidation plan (docs/one-file-per-page-consolidation-plan.md).
  // Restrictive by construction, matching the same closed field-type
  // set already designed for the business-type questions: text,
  // number, select, password, date. No conditional logic, no
  // branching, no computed fields — if a real page needs to decide
  // something from an answer, that's real code around this
  // component, not a new feature grown into it.
  import { translations } from '$lib/state.svelte';

  export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'password' | 'date' | 'multiselect';
    /** Required for type: 'select' or 'multiselect'. */
    options?: string[];
    /** Real, optional HTML input constraints — passed straight
     * through, never reinterpreted. */
    min?: number;
    max?: number;
    step?: number;
    autocomplete?: 'off' | 'current-password' | 'new-password' | 'username' | 'email';
    /** A hint line shown under the field's own label, the same real
     * shape every existing hand-written form already uses. */
    hint?: string;
  }

  let {
    fields,
    values = $bindable({}),
    onSubmit,
    submitLabel = 'Save',
    savingLabel = 'Saving…',
  }: {
    fields: FormField[];
    values?: Record<string, string | number | string[]>;
    onSubmit: (values: Record<string, string | number | string[]>) => Promise<void>;
    submitLabel?: string;
    savingLabel?: string;
  } = $props();

  let saving = $state(false);
  let error = $state('');
  let message = $state('');

  async function submit() {
    error = '';
    message = '';
    saving = true;
    try {
      await onSubmit(values);
      message = 'Saved.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not save.';
    } finally {
      saving = false;
    }
  }

  // Enter-to-submit, from any field — a genuine, generic feature
  // every real form gets for free, rather than a per-page workaround.
  // (Component exports cannot be bound to in Svelte 5 runes mode, so
  // this can't be exposed via bind:this for an external caller to
  // trigger instead — handling it here, once, is the real, correct
  // fix, not a workaround.)
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="generic-form">
  {#if error}<p class="error">{error}</p>{/if}
  {#if message}<p class="success">{message}</p>{/if}
  {#each fields as field (field.name)}
    <fieldset>
      <legend>{translations.current[field.label] ?? field.label}</legend>
      {#if field.hint}<p class="hint">{translations.current[field.hint] ?? field.hint}</p>{/if}
      {#if field.type === 'select'}
        <select bind:value={values[field.name]}>
          {#each field.options ?? [] as opt}<option value={opt}>{opt}</option>{/each}
        </select>
      {:else if field.type === 'multiselect'}
        <div class="multiselect">
          {#each field.options ?? [] as opt}
            {@const current = (values[field.name] as string[] | undefined) ?? []}
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={current.includes(opt)}
                onchange={(e) => {
                  const now = (values[field.name] as string[] | undefined) ?? [];
                  values[field.name] = e.currentTarget.checked ? [...now, opt] : now.filter((v) => v !== opt);
                }}
              />
              {translations.current[opt] ?? opt}
            </label>
          {/each}
        </div>
      {:else if field.type === 'number'}
        <input type="number" min={field.min} max={field.max} step={field.step ?? 1} bind:value={values[field.name]} onkeydown={onKeydown} />
      {:else if field.type === 'password'}
        <input type="password" autocomplete={field.autocomplete} bind:value={values[field.name]} onkeydown={onKeydown} />
      {:else if field.type === 'date'}
        <input type="date" bind:value={values[field.name]} />
      {:else}
        <input type="text" autocomplete={field.autocomplete} bind:value={values[field.name]} onkeydown={onKeydown} />
      {/if}
    </fieldset>
  {/each}
  <button class="btn" onclick={submit} disabled={saving}>
    {saving ? (translations.current[savingLabel] ?? savingLabel) : (translations.current[submitLabel] ?? submitLabel)}
  </button>
</div>

<style>
  .generic-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .hint {
    color: var(--ink-soft);
    font-size: var(--font-size-small);
    margin: 0 0 0.4rem;
  }
  .success {
    color: var(--credit);
  }
</style>

<script lang="ts">
  // The generic form component — see docs/pm-frontend-reference.md
  // for the full design.
  import { translations } from '$lib/state.svelte';

  export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'password' | 'date' | 'multiselect';
    /** Required for type: 'select' or 'multiselect'. */
    options?: string[];
    min?: number; // passed straight through, never reinterpreted
    max?: number;
    step?: number;
    autocomplete?: 'off' | 'current-password' | 'new-password' | 'username' | 'email';
    hint?: string;
  }

  let {
    fields,
    values = $bindable({}),
    onSubmit,
    submitLabel = 'Save',
    savingLabel = 'Saving…',
    showSubmitButton = true,
    onCancel,
  }: {
    fields: FormField[];
    values?: Record<string, string | number | string[]>;
    onSubmit: (values: Record<string, string | number | string[]>) => Promise<void>;
    submitLabel?: string;
    savingLabel?: string;
    // Both additive, default-preserving — existing callers never pass
    // these, so their rendering/behavior is byte-for-byte unchanged.
    // See docs/pm-frontend-reference.md, "Insert/Enter/Escape/Delete".
    showSubmitButton?: boolean;
    onCancel?: () => void;
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

  // Enter-to-submit AND Escape-to-cancel both live on the whole form, not
  // per-field, since both must work no matter which field currently has
  // focus — a select, a checkbox, a date picker, or a multiselect's own
  // checkboxes all have no onkeydown of their own. This was discovered as
  // a real bug while converting setup/users/+page.svelte to Insert-opens-
  // form: the "roles" multiselect is the last field in that form, so a
  // real, UI-driven Enter press (shared-fixtures screens.csv's own
  // key:Enter submit_selector) landed on a checkbox, not a text input,
  // and a per-field-only Enter handler never saw it — the step reported
  // success (no exception) while genuinely submitting nothing at all.
  // Escape only fires when a caller actually wants cancellation (onCancel
  // supplied) — every existing caller leaves it unset, so that half is a
  // true no-op for them, same as before this prop existed.
  // stopPropagation on Escape matters: frontend/src/routes/+layout.svelte
  // has its own, unrelated, global Escape handler on <main> (the
  // hasUnsavedEdit sidebar-focus warning) that must never also fire just
  // because this inline form's own Escape was handled here. Enter needs
  // no stopPropagation — nothing else up the tree reacts to it.
  function onFormKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && onCancel) {
      e.stopPropagation();
      onCancel();
    }
  }
</script>

<div class="generic-form" onkeydown={onFormKeydown}>
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
        <input type="number" min={field.min} max={field.max} step={field.step ?? 1} bind:value={values[field.name]} />
      {:else if field.type === 'password'}
        <input type="password" autocomplete={field.autocomplete} bind:value={values[field.name]} />
      {:else if field.type === 'date'}
        <input type="date" bind:value={values[field.name]} />
      {:else}
        <input type="text" autocomplete={field.autocomplete} bind:value={values[field.name]} />
      {/if}
    </fieldset>
  {/each}
  {#if showSubmitButton}
    <button class="btn" onclick={submit} disabled={saving}>
      {saving ? (translations.current[savingLabel] ?? savingLabel) : (translations.current[submitLabel] ?? submitLabel)}
    </button>
  {/if}
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

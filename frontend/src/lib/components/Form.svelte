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

  // Enter-to-submit from any field — see docs/pm-frontend-reference.md.
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

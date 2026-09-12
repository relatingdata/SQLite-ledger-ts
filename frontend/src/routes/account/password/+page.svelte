<script lang="ts">
  import { changeOwnPassword, setOwnPageSize, setOwnNumberFormat, setOwnDateFormat, ApiError } from '$lib/api';
  import { translations, auth } from '$lib/state.svelte';
  import { formatAmount, formatDate } from '$lib/format';
  import Form from '$lib/components/Form.svelte';

  let pageSizeValues = $state({ pageSize: auth.current?.user.page_size ?? 20 });

  async function savePageSize(values: Record<string, string | number | string[]>) {
    const pageSize = Number(values.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 5 || pageSize > 200) {
      throw new Error('Page size must be a whole number between 5 and 200.');
    }
    await setOwnPageSize(pageSize);
    if (auth.current) auth.set({ ...auth.current, user: { ...auth.current.user, page_size: pageSize } });
  }

  const NUMBER_FORMAT_OPTIONS = ['1,000.00', '1 000.00', '1.000,00', '1000,00', "1'000.00", '1000.00'];
  const DATE_FORMAT_OPTIONS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'dd.mm.yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd'];

  let formatValues = $state({
    numberFormat: auth.current?.user.number_format ?? '1 000.00',
    dateFormat: auth.current?.user.date_format ?? 'dd/mm/yyyy',
  });

  async function saveFormats(values: Record<string, string | number | string[]>) {
    const numberFormat = String(values.numberFormat);
    const dateFormat = String(values.dateFormat);
    await setOwnNumberFormat(numberFormat);
    await setOwnDateFormat(dateFormat);
    if (auth.current) auth.set({ ...auth.current, user: { ...auth.current.user, number_format: numberFormat, date_format: dateFormat } });
  }

  let passwordValues = $state({ currentPassword: '', newPassword: '', confirmPassword: '' });

  async function savePassword(values: Record<string, string | number | string[]>) {
    const newPassword = String(values.newPassword);
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
    if (newPassword !== String(values.confirmPassword)) throw new Error('New password and confirmation do not match.');
    try {
      await changeOwnPassword(String(values.currentPassword), newPassword);
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : new Error('Could not change password.');
    }
    passwordValues = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }
</script>

<svelte:head><title>{translations.current['Account Settings'] ?? 'Account Settings'}</title></svelte:head>

<fieldset class="page-title">
  <legend>{translations.current['Account Settings'] ?? 'Account Settings'}</legend>

  <h3>{translations.current['Page size'] ?? 'Page size'}</h3>
  <Form
    fields={[
      {
        name: 'pageSize',
        label: 'Rows per page',
        type: 'number',
        min: 5,
        max: 200,
        hint: 'How many rows any paginated list (journal, stock listing, and more) shows per page.',
      },
    ]}
    bind:values={pageSizeValues}
    onSubmit={savePageSize}
    submitLabel="Save page size"
  />

  <h3>{translations.current['Number and date format'] ?? 'Number and date format'}</h3>
  <Form
    fields={[
      { name: 'numberFormat', label: 'Number format', type: 'select', options: NUMBER_FORMAT_OPTIONS },
      { name: 'dateFormat', label: 'Date format', type: 'select', options: DATE_FORMAT_OPTIONS },
    ]}
    bind:values={formatValues}
    onSubmit={saveFormats}
    submitLabel="Save format"
  />
  <p class="preview">Preview: {formatAmount(123456789, String(formatValues.numberFormat))} &middot; {formatDate('2027-08-03', String(formatValues.dateFormat))}</p>

  <h3>{translations.current['Change password'] ?? 'Change password'}</h3>
  <Form
    fields={[
      { name: 'currentPassword', label: 'Current password', type: 'password', autocomplete: 'current-password' },
      { name: 'newPassword', label: 'New password', type: 'password', autocomplete: 'new-password' },
      { name: 'confirmPassword', label: 'Confirm new password', type: 'password', autocomplete: 'new-password' },
    ]}
    bind:values={passwordValues}
    onSubmit={savePassword}
    submitLabel="Change password"
  />
</fieldset>

<style>
  .preview {
    font-family: var(--font-mono);
    font-size: var(--font-size-medium);
    margin: 0;
  }
</style>

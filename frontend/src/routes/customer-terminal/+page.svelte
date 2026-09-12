<script lang="ts">
  import { onMount } from 'svelte';
  import { registerCustomer, getLanguages, ApiError } from '$lib/api';
  import { translations } from '$lib/state.svelte';
  import Form from '$lib/components/Form.svelte';

  let languages: { id: number; name: string }[] = $state([]);
  let done = $state(false);
  let doneName = $state('');

  let values: Record<string, string | number | string[]> = $state({
    name: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
    preferredLanguage: '',
    cardType: '',
    cardLast4: '',
    password: '',
    confirmPassword: '',
  });

  onMount(async () => {
    try {
      languages = await getLanguages();
    } catch {
      // language list is a nice-to-have here — registration still works without it
    }
  });

  async function submit(v: Record<string, string | number | string[]>) {
    const name = String(v.name ?? '').trim();
    const email = String(v.email ?? '').trim();
    const password = String(v.password ?? '');
    const cardType = String(v.cardType ?? '');
    const cardLast4 = String(v.cardLast4 ?? '');
    if (!name || !email || !password) throw new Error('Name, email, and password are required.');
    if (password !== String(v.confirmPassword ?? '')) throw new Error('Passwords do not match.');
    if (cardLast4 && !/^\d{4}$/.test(cardLast4)) throw new Error('Card: enter just the last 4 digits.');
    try {
      await registerCustomer({
        name,
        email,
        phone: (v.phone as string) || null,
        address_line1: (v.addressLine1 as string) || null,
        city: (v.city as string) || null,
        region: (v.region as string) || null,
        postal_code: (v.postalCode as string) || null,
        country: (v.country as string) || null,
        preferred_language: (v.preferredLanguage as string) || null,
        password,
        card_label: cardType && cardLast4 ? `${cardType} ending ${cardLast4}` : null,
      });
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : new Error('Could not register — please ask staff for help.');
    }
    doneName = name;
    done = true;
  }
</script>

<svelte:head><title>{translations.current['Customer Registration'] ?? 'Customer Registration'}</title></svelte:head>

<div class="terminal-wrap">
  {#if done}
    <div class="card done-card">
      <h2>Thanks, {doneName}!</h2>
      <p>Your registration is complete. Please hand this screen to a staff member — they'll verify your card and
        activate your account.</p>
    </div>
  {:else}
    <fieldset class="card-legend">
      <legend>{translations.current['Register as a customer'] ?? 'Register as a customer'}</legend>
      <p class="intro">{translations.current['Fill in your details below. A staff member will check your card before your account is fully active.'] ?? 'Fill in your details below. A staff member will check your card before your account is fully active.'}</p>

      <Form
        fields={[
          { name: 'name', label: 'Full name', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
          { name: 'addressLine1', label: 'Address', type: 'text' },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'region', label: 'Region', type: 'text' },
          { name: 'postalCode', label: 'Postal code', type: 'text' },
          { name: 'country', label: 'Country', type: 'text' },
          ...(languages.length > 0 ? [{ name: 'preferredLanguage', label: 'Preferred language', type: 'select' as const, options: languages.map((l) => l.name) }] : []),
          { name: 'cardType', label: 'Card type', type: 'select', options: ['Visa', 'Mastercard', 'Amex'] },
          { name: 'cardLast4', label: 'Last 4 digits', type: 'text' },
          { name: 'password', label: 'Password', type: 'password' },
          { name: 'confirmPassword', label: 'Confirm password', type: 'password' },
        ]}
        bind:values
        onSubmit={submit}
        submitLabel="Register"
        savingLabel="Registering…"
      />
    </fieldset>
  {/if}
</div>

<style>
  .terminal-wrap {
    display: flex;
    justify-content: center;
    padding: 2rem 1rem;
  }

  .card {
    width: 100%;
    max-width: 480px;
    padding: 1.6rem 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .done-card {
    max-width: 420px;
    text-align: center;
    padding: 2.5rem 2rem;
  }

  .intro {
    color: var(--ink-soft);
    font-size: var(--font-size-base);
    margin: 0 0 0.3rem;
  }
</style>

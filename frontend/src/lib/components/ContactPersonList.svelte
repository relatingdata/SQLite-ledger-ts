<script lang="ts">
  // Superseded by ContactList.svelte; kept as a thin re-export — see docs/pm-frontend-reference.md.
  import ContactList from './ContactList.svelte';
  let { entityName }: { entityName: string } = $props();
</script>

<ContactList {entityName} />

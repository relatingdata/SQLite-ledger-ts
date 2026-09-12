<script lang="ts">
  // Superseded by ContactList.svelte (per direct request: this list
  // may hold organizations or subunits too, like "Help Desk", not
  // only individual people) - kept as a real, thin re-export, never
  // deleted, in case anything still imports this original name.
  import ContactList from './ContactList.svelte';
  let { entityName }: { entityName: string } = $props();
</script>

<ContactList {entityName} />

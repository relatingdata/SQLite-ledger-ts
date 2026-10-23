declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }
  // Build-time version, from the shared VERSION file — see docs/pm-frontend-reference.md.
  const __APP_VERSION__: string;
}

export {};

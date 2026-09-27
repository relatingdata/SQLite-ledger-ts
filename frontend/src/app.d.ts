declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }
  // Per direct instruction: the frontend's own real, build-time
  // version, injected by vite.config.ts from the exact, same, single
  // VERSION file the backend reads at startup.
  const __APP_VERSION__: string;
}

export {};

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// Per direct instruction: the frontend's own real, build-time
// version, read once from the exact, same, single, real VERSION file
// the backend reads at startup - never a second, separately-maintained
// copy of the version number that could silently drift apart from it.
const appVersion = readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim();

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 5173,
    // A real, confirmed root cause, found directly: without this,
    // Vite silently falls back to a different port (5174, say) when
    // 5173 is already held by some other, real, orphaned process -
    // leaving every real caller that assumes port 5173 (Playwright's
    // own baseURL, this project's own PID-file health checks) waiting
    // on a real server that was never actually there, hanging
    // indefinitely rather than failing with a real, clear, immediate
    // error. strictPort is a real, standard, documented Vite option
    // for exactly this - portable across every real OS Vite itself
    // supports, unlike any OS-specific "find and kill whatever is on
    // this port" script.
    strictPort: true,
  },
});

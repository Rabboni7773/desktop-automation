import { toggleTheme } from './theme.js';

export function initSettings() {
  const app = document.getElementById('app');
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'fixed inset-0 z-50 hidden items-center justify-center p-4';
  modal.innerHTML = `
    <div class="w-full max-w-2xl rounded-2xl bg-slate-900/80 p-6 shadow-soft glass">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Settings</h3>
        <button id="settings-close" class="rounded-md px-3 py-1 bg-slate-800/60">Close</button>
      </div>
      <div class="mt-4 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">Theme</div>
            <div class="text-xs text-slate-400">Toggle Dark / Light</div>
          </div>
          <div>
            <button id="settings-theme-toggle" class="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2">Toggle</button>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium">Streaming</div>
            <div class="text-xs text-slate-400">Enable or disable streaming responses</div>
          </div>
          <div>
            <input id="settings-streaming-toggle" type="checkbox" checked />
          </div>
        </div>
      </div>
    </div>
  `;
  app.appendChild(modal);

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });
  document.getElementById('settings-header')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });
  document.getElementById('settings-close')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('settings-theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
  });
}

export function isStreamingEnabled() {
  try {
    const el = document.getElementById('settings-streaming-toggle');
    return el ? el.checked : true;
  } catch {
    return true;
  }
}

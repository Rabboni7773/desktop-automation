import { toggleTheme } from './theme.js';

export function initSettings() {
  const app = document.getElementById('app');
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'fixed inset-0 z-50 hidden items-center justify-center p-4 bg-black/30 dark:bg-black/50';
  modal.innerHTML = `
    <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-slate-700 p-6 shadow-sm dark:shadow-soft">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Settings</h3>
        <button id="settings-close" class="rounded-md px-3 py-1 text-sm bg-gray-100 dark:bg-slate-800/60 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">Close</button>
      </div>
      <div class="mt-4 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-800 dark:text-slate-200">Theme</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Toggle Dark / Light</div>
          </div>
          <div>
            <button id="settings-theme-toggle" class="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">Toggle</button>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-800 dark:text-slate-200">Streaming</div>
            <div class="text-xs text-gray-500 dark:text-slate-400">Enable or disable streaming responses</div>
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
    modal.classList.remove('flex');
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
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

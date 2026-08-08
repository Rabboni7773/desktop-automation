export function toast(message, { type = 'info', duration = 4000 } = {}) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed right-6 top-6 z-60 flex flex-col gap-3';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  if (type === 'error') {
    el.className = 'rounded-lg px-4 py-2 text-sm border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-600/80 text-rose-700 dark:text-white shadow-sm';
  } else {
    el.className = 'rounded-lg px-4 py-2 text-sm border border-gray-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/90 text-gray-800 dark:text-slate-100 shadow-sm';
  }
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.remove();
    if (!container.children.length) container.remove();
  }, duration);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch (err) {
    toast('Unable to copy', { type: 'error' });
  }
}

export function toast(message, { type = 'info', duration = 4000 } = {}) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed right-6 top-6 z-60 flex flex-col gap-3';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `rounded-lg px-4 py-2 text-sm shadow-soft glass ${type === 'error' ? 'bg-rose-600/80 text-white' : 'bg-slate-800/80 text-slate-100'}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
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

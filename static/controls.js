import { toast } from './notifications.js';

export function initControls() {
  // Attach global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-conversations')?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.getElementById('message-input')?.focus();
    }
  });

  // Drag and drop placeholder for future upload support
  const chatPanel = document.getElementById('chat-panel');
  if (!chatPanel) return;

  chatPanel.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatPanel.classList.add('ring-2', 'ring-blue-500/30');
  });
  chatPanel.addEventListener('dragleave', () => {
    chatPanel.classList.remove('ring-2', 'ring-blue-500/30');
  });
  chatPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    chatPanel.classList.remove('ring-2', 'ring-blue-500/30');
    toast('File upload is not yet implemented', { type: 'info' });
  });
}

export function stopStreaming() {
  // This function will be connected to the streaming controller
  window.dispatchEvent(new CustomEvent('stream:stop'));
}

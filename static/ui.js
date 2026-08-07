import { initTheme } from './theme.js';
import { initSidebar } from './sidebar.js';
import { initChat } from './chat.js';
import { initApi } from './api.js';
import { initSettings } from './settings.js';
import { toast } from './notifications.js';
import { initControls } from './controls.js';

const app = document.getElementById('app');
app.innerHTML = `
  <aside id="sidebar" role="navigation" aria-label="Conversation list" class="hidden md:flex w-80 flex-col border-r border-slate-800/80 bg-slate-900/80 backdrop-blur-xl"></aside>
  <main role="main" class="flex min-w-0 flex-1 flex-col bg-slate-950/80">
    <header role="banner" class="flex items-center justify-between border-b border-slate-800/80 px-5 py-4"></header>
    <section id="chat-panel" class="flex-1 overflow-hidden" aria-live="polite"></section>
    <footer role="contentinfo" class="border-t border-slate-800/80 px-4 py-4 md:px-6"></footer>
  </main>
`;

const bootstrap = async () => {
  initTheme();
  initApi();
  initSidebar();
  initChat();
  initSettings();
  initControls();
  // small notification to show UI is ready
  toast('UI initialized');
};

bootstrap();

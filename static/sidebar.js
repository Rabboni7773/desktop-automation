import { loadConversations, saveConversations, addConversation, updateConversation, deleteConversation } from './storage.js';
import { toggleTheme } from './theme.js';
import { createId, formatTime } from './utils.js';

let state = { conversations: [], activeId: null, sidebarOpen: true, search: '' };

export function initSidebar() {
  const sidebar = document.querySelector('#sidebar');
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  const conversations = loadConversations();
  state.conversations = conversations;
  state.activeId = conversations[0]?.id || null;

  sidebar.innerHTML = `
    <div class="flex h-full flex-col p-4">
      <div class="flex items-center gap-3 px-2 py-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 text-lg font-semibold">A</div>
        <div>
          <div class="text-sm font-semibold">Automate AI</div>
          <div class="text-xs text-slate-400">Premium assistant</div>
        </div>
      </div>
      <button id="new-chat" class="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-blue-500/50 hover:bg-slate-700">＋ New chat</button>
      <label class="mt-4 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"></circle><path d="m20 20-4.2-4.2"></path></svg>
        <input id="search-conversations" class="w-full bg-transparent outline-none" placeholder="Search chats" />
      </label>
      <div class="mt-4 flex-1 overflow-y-auto scrollbar-thin">
        <div class="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">Today</div>
        <div id="conversation-list"></div>
      </div>
      <div class="mt-4 space-y-2 border-t border-slate-800/80 pt-3">
        <button id="settings-btn" class="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80">⚙️ Settings</button>
        <div class="flex items-center gap-3 rounded-2xl bg-slate-800/70 px-3 py-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-sm font-semibold">U</div>
          <div>
            <div class="text-sm font-medium">User</div>
            <div class="text-xs text-slate-400">Online</div>
          </div>
        </div>
      </div>
    </div>
  `;

  header.innerHTML = `
    <div class="flex items-center gap-3">
      <button id="mobile-menu" class="rounded-2xl border border-slate-800 bg-slate-900/80 p-2 md:hidden">☰</button>
      <div>
        <div id="thread-title" class="text-sm font-semibold">New conversation</div>
        <div class="text-xs text-slate-400">Model · GPT-OSS</div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button id="theme-toggle" class="rounded-2xl border border-slate-700 bg-slate-900/80 p-2">☀️</button>
      <button id="settings-header" class="rounded-2xl border border-slate-700 bg-slate-900/80 p-2">⚙️</button>
    </div>
  `;

  footer.innerHTML = `
    <div class="mx-auto flex max-w-3xl flex-col gap-3 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-3 shadow-soft">
      <div class="flex items-center gap-2 text-sm text-slate-400"><span class="h-2 w-2 rounded-full bg-emerald-400"></span> Connected · Streaming enabled</div>
      <div id="composer" class="flex items-end gap-2"></div>
    </div>
  `;

  document.getElementById('new-chat').addEventListener('click', () => {
    const id = createId();
    const newConversation = { id, title: 'New chat', messages: [], createdAt: new Date().toISOString() };
    state.conversations = [newConversation, ...state.conversations];
    state.activeId = id;
    saveConversations(state.conversations);
    renderSidebar();
    window.dispatchEvent(new CustomEvent('chat:selected', { detail: { conversation: newConversation } }));
  });

  document.getElementById('search-conversations').addEventListener('input', (event) => {
    state.search = event.target.value.toLowerCase();
    renderSidebar();
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    toggleTheme();
  });

  renderSidebar();
}

export function renderSidebar() {
  const list = document.getElementById('conversation-list');
  if (!list) return;
  const filtered = state.conversations.filter((item) => item.title?.toLowerCase().includes(state.search));
  list.innerHTML = filtered.length ? filtered.map((conversation) => `
    <button class="mb-2 flex w-full items-start justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-left transition hover:border-blue-500/50 hover:bg-slate-800/80 ${state.activeId === conversation.id ? 'border-blue-500/60 bg-slate-800/90' : ''}" data-id="${conversation.id}">
      <span class="flex-1">
        <div class="truncate text-sm font-medium text-slate-100">${conversation.title}</div>
        <div class="mt-1 text-xs text-slate-500">${formatTime(conversation.createdAt || new Date())}</div>
      </span>
      <span class="ml-2 text-xs text-slate-500">★</span>
    </button>
  `).join('') : '<div class="rounded-2xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">No conversations yet</div>';

  list.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeId = button.dataset.id;
      const conversation = state.conversations.find((item) => item.id === state.activeId);
      renderSidebar();
      window.dispatchEvent(new CustomEvent('chat:selected', { detail: { conversation } }));
    });
  });
}

export function getSidebarState() {
  return state;
}

export function setSidebarState(next) {
  state = { ...state, ...next };
}

export function getActiveConversation() {
  return state.conversations.find((item) => item.id === state.activeId) || null;
}

export function refreshSidebar(conversations) {
  state.conversations = conversations;
  renderSidebar();
}

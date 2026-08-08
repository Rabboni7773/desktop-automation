import { loadConversations, saveConversations, addConversation, updateConversation, deleteConversation } from './storage.js';
import { toggleTheme } from './theme.js';
import { createId, formatTime } from './utils.js';
import { fetchHistory } from './api.js';

let state = { conversations: [], activeId: null, sidebarOpen: true, search: '' };

/**
 * Returns true if the title is a placeholder/default that should be replaced
 * when a better title is available.
 */
function isDefaultTitle(t) {
  if (!t) return true;
  const lower = t.trim().toLowerCase();
  return lower === '' || lower === 'new chat' || lower === 'placeholder';
}

export function initSidebar() {
  const sidebar = document.querySelector('#sidebar');
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  const conversations = loadConversations();
  state.conversations = conversations;
  state.activeId = conversations[0]?.id || null;

  sidebar.innerHTML = `
    <div class="flex h-full flex-col py-3">
      <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800/60 mb-1">
        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 text-base font-semibold text-white">A</div>
        <div>
          <div class="text-sm font-semibold text-gray-900 dark:text-slate-100">Automate AI</div>
          <div class="text-xs text-gray-400 dark:text-slate-400">Premium assistant</div>
        </div>
      </div>
      <div class="px-3 pt-3 pb-1">
        <button id="new-chat" class="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-100 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700">＋ New chat</button>
      </div>
      <div class="px-3 pb-2">
        <label class="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"></circle><path d="m20 20-4.2-4.2"></path></svg>
          <input id="search-conversations" class="w-full bg-transparent outline-none text-sm text-gray-700 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500" placeholder="Search chats" />
        </label>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin px-2">
        <div class="mb-1 px-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-slate-500">Recent</div>
        <div id="conversation-list"></div>
      </div>
      <div class="px-3 mt-1 border-t border-gray-100 dark:border-slate-800/60 pt-2 space-y-0.5">
        <button id="settings-btn" class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800/80">⚙️ Settings</button>
        <div class="flex items-center gap-3 rounded-xl px-3 py-2">
          <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-xs font-semibold text-white">U</div>
          <div>
            <div class="text-sm font-medium text-gray-700 dark:text-slate-200">User</div>
            <div class="text-xs text-gray-400 dark:text-slate-400">Online</div>
          </div>
        </div>
      </div>
    </div>
  `;

  header.innerHTML = `
    <div class="flex items-center gap-3">
      <button id="mobile-menu" class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 p-2 md:hidden text-gray-600 dark:text-slate-300">☰</button>
      <div>
        <div id="thread-title" class="text-sm font-semibold text-gray-900 dark:text-slate-100">New conversation</div>
        <div class="text-xs text-gray-400 dark:text-slate-400">Model · GPT-OSS</div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button id="theme-toggle" class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800">☀️</button>
      <button id="settings-header" class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800">⚙️</button>
    </div>
  `;

  // shadow-sm removed from composer — border provides visual separation without the floating effect
  footer.innerHTML = `
    <div class="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-gray-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 p-3">
      <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500"><span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Connected · Streaming enabled</div>
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

  // Refresh sidebar when chat.js updates a title
  window.addEventListener('conversation:updated', (event) => {
    state.conversations = event.detail.conversations;
    renderSidebar();
  });

  renderSidebar();

  // Reconcile localStorage titles with backend on startup (non-blocking).
  // If backend has a valid title but localStorage still has a default, update localStorage.
  _reconcileTitlesWithBackend();
}

/**
 * Fetch all conversation titles from the backend and update any localStorage
 * entries that still have a default/placeholder title.
 * This runs once on page load so that after refresh, titles are always correct.
 */
async function _reconcileTitlesWithBackend() {
  try {
    const data = await fetchHistory();
    const remoteList = data.conv_history || [];
    if (!remoteList.length) return;

    let changed = false;
    state.conversations = state.conversations.map((conv) => {
      const remote = remoteList.find((r) => r.thread_id === conv.id);
      if (remote && !isDefaultTitle(remote.thread_name) && isDefaultTitle(conv.title)) {
        changed = true;
        return { ...conv, title: remote.thread_name };
      }
      return conv;
    });

    if (changed) {
      saveConversations(state.conversations);
      renderSidebar();
    }
  } catch (_) {
    // Non-critical — sidebar still works from localStorage
  }
}

export function renderSidebar() {
  const list = document.getElementById('conversation-list');
  if (!list) return;
  const filtered = state.conversations.filter(
    (item) => (item.title || '').toLowerCase().includes(state.search)
  );
  list.innerHTML = filtered.length
    ? filtered.map((conversation) => {
        const isActive = state.activeId === conversation.id;
        return `
    <button class="mb-0.5 flex w-full flex-col rounded-xl px-4 py-3 text-left transition-colors min-h-[60px] justify-center border
      ${ isActive
          ? 'bg-blue-50 dark:bg-slate-700/60 border-blue-200 dark:border-transparent'
          : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-700/40' }" data-id="${conversation.id}">
      <div class="truncate text-sm font-medium ${ isActive ? 'text-blue-700 dark:text-slate-100' : 'text-gray-800 dark:text-slate-200' }">${conversation.title || 'New chat'}</div>
      <div class="mt-0.5 text-xs ${ isActive ? 'text-blue-400 dark:text-slate-400' : 'text-gray-400 dark:text-slate-500' }">${formatTime(conversation.createdAt || new Date())}</div>
    </button>`;
      }).join('')
    : '<div class="mx-1 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-3 py-5 text-sm text-center text-gray-400 dark:text-slate-500">No conversations yet</div>';

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

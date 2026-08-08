import { fetchThreadHistory, fetchThreadName, sendMessage } from './api.js';
import { loadConversations, saveConversations, updateConversation } from './storage.js';
import { createId, formatTime } from './utils.js';
import { renderMarkdown, streamResponse } from './stream.js';

let activeConversation = null;
let isStreaming = false;
let abortController = null;

/**
 * Returns true if the title is a placeholder/default value that should be
 * replaced when a better title is available.
 */
function isDefaultTitle(t) {
  if (!t) return true;
  const lower = t.trim().toLowerCase();
  return lower === '' || lower === 'new chat' || lower === 'placeholder';
}

/**
 * Generate a short, clean title from the first user message.
 * Strips common filler phrases, title-cases the result, truncates to 35 chars.
 */
function generateTitle(message) {
  const fillers = [
    'tell me about', 'tell me', 'can you explain', 'can you please', 'can you',
    'please explain', 'please', 'what is a ', 'what is an ', 'what are', 'what is',
    "what's", 'how do i', 'how to', 'how can i', 'give me', 'describe',
    'show me', 'explain', 'i want to know about', 'i want to know',
  ];
  let title = message.trim().replace(/[?!.]+$/, '').trim();
  const pattern = new RegExp(
    '^(' +
      fillers
        .sort((a, b) => b.length - a.length)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|') +
    ')\\s*',
    'i'
  );
  title = title.replace(pattern, '').trim();
  // Title Case
  title = title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  if (title.length > 35) title = title.slice(0, 32).trimEnd() + '\u2026';
  return title || 'New chat';
}

/**
 * Push a title update to all places that display or persist it:
 * activeConversation, #thread-title element, localStorage, sidebar event.
 */
function _applyTitleUpdate(newTitle, conversationId) {
  if (!newTitle || isDefaultTitle(newTitle)) return;

  if (activeConversation && activeConversation.id === conversationId) {
    activeConversation.title = newTitle;
  }

  const threadTitle = document.getElementById('thread-title');
  if (threadTitle) threadTitle.textContent = newTitle;

  const convs = loadConversations();
  const idx = convs.findIndex((c) => c.id === conversationId);
  if (idx >= 0) {
    convs[idx].title = newTitle;
    saveConversations(convs);
    window.dispatchEvent(new CustomEvent('conversation:updated', { detail: { conversations: convs } }));
  }
}

export function initChat() {
  const chatPanel = document.getElementById('chat-panel');
  const composer = document.getElementById('composer');

  if (!chatPanel || !composer) return;

  chatPanel.innerHTML = `
    <div class="flex h-full flex-col items-center justify-center px-6 text-center">
      <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-emerald-500">
        <span class="text-2xl font-semibold text-white">A</span>
      </div>
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100">Welcome to Automate AI</h2>
      <p class="mt-2 max-w-xl text-sm text-gray-500 dark:text-slate-400">Ask anything, debug code, summarize content, or continue a conversation.</p>
      <div class="mt-8 grid gap-2 md:grid-cols-2">
        <button class="prompt-card rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-4 py-3 text-left text-sm text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:border-blue-500/40">Explain FastAPI</button>
        <button class="prompt-card rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-4 py-3 text-left text-sm text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:border-blue-500/40">Write Python code</button>
        <button class="prompt-card rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-4 py-3 text-left text-sm text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:border-blue-500/40">Summarize text</button>
        <button class="prompt-card rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-4 py-3 text-left text-sm text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:border-blue-500/40">Generate SQL</button>
      </div>
    </div>
  `;

  composer.innerHTML = `
    <textarea id="message-input" rows="1" placeholder="Ask anything..." class="max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950/80 px-4 py-3 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-blue-400 focus:border-transparent" aria-label="Message input"></textarea>
    <div class="flex items-center gap-2">
      <button id="stop-btn" class="rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-rose-400 hidden">Stop</button>
      <button id="send-btn" class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 active:scale-95">Send</button>
    </div>
  `;

  document.querySelectorAll('.prompt-card').forEach((card) => {
    card.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      input.value = card.textContent;
      input.focus();
    });
  });

  document.getElementById('message-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendCurrentMessage();
    }
  });

  document.getElementById('send-btn').addEventListener('click', sendCurrentMessage);
  document.getElementById('stop-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('stream:stop'));
  });

  window.addEventListener('chat:selected', async (event) => {
    const conversation = event.detail.conversation;
    if (!conversation) return;
    activeConversation = conversation;
    await loadConversation(conversation.id);
  });

  const saved = loadConversations();
  if (saved.length) {
    activeConversation = saved[0];
    loadConversation(saved[0].id);
  }
}

async function loadConversation(id) {
  const threadTitle = document.getElementById('thread-title');

  // Find what title we already have locally before hitting the backend
  const localConvList = loadConversations();
  const localConv = localConvList.find((c) => c.id === id);
  const localTitle = localConv?.title || null;

  const history = await fetchThreadHistory(id);
  const nameRes = await fetchThreadName(id);
  const backendTitle = nameRes?.thread_name || null;

  // Title priority matrix:
  //   backend valid, local default  → use backend, update localStorage
  //   backend valid, local valid    → use backend (AI title is authoritative)
  //   backend default, local valid  → keep local title
  //   both default                  → fall back to 'New chat'
  let resolvedTitle;
  if (!isDefaultTitle(backendTitle)) {
    resolvedTitle = backendTitle;
  } else if (!isDefaultTitle(localTitle)) {
    resolvedTitle = localTitle;
  } else {
    resolvedTitle = 'New chat';
  }

  const messages = (history.messages || []).map((msg) => ({ role: msg.role, content: msg.content }));
  activeConversation = { id, title: resolvedTitle, messages, createdAt: localConv?.createdAt || new Date().toISOString() };

  // Sync the resolved title back into localStorage if it improved
  if (!isDefaultTitle(resolvedTitle) && (isDefaultTitle(localTitle) || resolvedTitle !== localTitle)) {
    const updatedList = loadConversations();
    const existing = updatedList.find((c) => c.id === id);
    if (existing) {
      existing.title = resolvedTitle;
      saveConversations(updatedList);
      window.dispatchEvent(new CustomEvent('conversation:updated', { detail: { conversations: updatedList } }));
    } else {
      updatedList.unshift(activeConversation);
      saveConversations(updatedList);
    }
  } else if (!localConv) {
    // Brand-new conversation not yet in localStorage
    localConvList.unshift(activeConversation);
    saveConversations(localConvList);
  }

  if (threadTitle) threadTitle.textContent = resolvedTitle;
  renderMessages(messages);
}

function renderMessages(messages) {
  const chatPanel = document.getElementById('chat-panel');
  if (!messages.length) {
    chatPanel.innerHTML = `
      <div class="flex h-full flex-col items-center justify-center px-6 text-center">
        <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-emerald-500">
          <span class="text-2xl font-semibold text-white">A</span>
        </div>
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-slate-100">Start a new conversation</h2>
        <p class="mt-2 max-w-xl text-sm text-gray-500 dark:text-slate-400">Type a message below to begin.</p>
      </div>
    `;
    return;
  }

  chatPanel.innerHTML = `
    <div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto px-4 py-6 scrollbar-thin">
      ${messages.map((message) => {
        // Accept both 'user'/'human' for user bubbles (covers backend-loaded and locally-stored messages)
        const isUser = message.role === 'user' || message.role === 'human';
        return `
        <div class="fade-in ${isUser ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[85%]'}">
          <div class="rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-100'
          }">
            <div class="${ isUser ? 'prose prose-invert' : 'prose prose-slate dark:prose-invert' } max-w-none text-sm leading-7">${renderMarkdown(message.content || '')}</div>
          </div>
          <div class="mt-1 px-1 text-[11px] text-gray-400 dark:text-slate-500">${formatTime(new Date())}</div>
        </div>
      `}).join('')}
    </div>
  `;
}

async function sendCurrentMessage() {
  const input = document.getElementById('message-input');
  const value = input.value.trim();
  if (!value || isStreaming) return;

  if (!activeConversation) {
    activeConversation = { id: createId(), title: 'New chat', messages: [], createdAt: new Date().toISOString() };
  }

  // Generate an optimistic title from the very first user message — shows instantly
  const isFirstMessage = activeConversation.messages.length === 0;
  if (isFirstMessage) {
    const optimisticTitle = generateTitle(value);
    _applyTitleUpdate(optimisticTitle, activeConversation.id);
  }

  const userMessage = { role: 'user', content: value };
  activeConversation.messages.push(userMessage);
  const conversations = loadConversations();
  const existingIndex = conversations.findIndex((item) => item.id === activeConversation.id);
  if (existingIndex >= 0) {
    conversations[existingIndex] = { ...conversations[existingIndex], ...activeConversation };
  } else {
    conversations.unshift(activeConversation);
  }
  saveConversations(conversations);

  // Notify sidebar to re-render with the optimistic title
  if (isFirstMessage) {
    window.dispatchEvent(new CustomEvent('conversation:updated', { detail: { conversations } }));
  }

  renderMessages(activeConversation.messages);
  input.value = '';

  // Typing indicator — no shadow-sm, border only
  const assistantPlaceholder = document.createElement('div');
  assistantPlaceholder.className = 'fade-in mr-auto max-w-[85%]';
  assistantPlaceholder.innerHTML = `
    <div class="rounded-2xl border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 px-4 py-3">
      <div class="flex items-center gap-1.5"><span class="typing-dot h-2 w-2 rounded-full bg-gray-400 dark:bg-slate-400"></span><span class="typing-dot h-2 w-2 rounded-full bg-gray-400 dark:bg-slate-400"></span><span class="typing-dot h-2 w-2 rounded-full bg-gray-400 dark:bg-slate-400"></span></div>
    </div>
  `;
  document.querySelector('#chat-panel .flex')?.appendChild(assistantPlaceholder);

  isStreaming = true;
  // Capture the conversation id at send time for the async title poll closure
  const sentConversationId = activeConversation.id;

  try {
    const { reader, controller } = await sendMessage(activeConversation.id, value);
    abortController = controller;
    const stopHandler = () => {
      if (abortController) abortController.abort();
    };
    window.addEventListener('stream:stop', stopHandler, { once: true });

    await streamResponse({
      reader,
      onChunk: (chunk) => {
        const content = chunk.replace(/\n/g, '\n');
        // Streaming bubble — no shadow-sm, border only
        assistantPlaceholder.innerHTML = `
          <div class="rounded-2xl border border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/70 px-4 py-3 text-gray-800 dark:text-slate-100">
            <div class="prose prose-slate dark:prose-invert max-w-none text-sm leading-7">${renderMarkdown(content || '')}</div>
          </div>
        `;
        if (!activeConversation.messages.find(m => m.role === 'assistant')) {
          activeConversation.messages.push({ role: 'assistant', content });
        } else {
          activeConversation.messages[activeConversation.messages.length - 1] = { role: 'assistant', content };
        }
        renderMessages(activeConversation.messages);
      },
      onDone: () => {
        isStreaming = false;
        abortController = null;
        window.removeEventListener('stream:stop', stopHandler);

        // Persist the final messages
        const conversationsUpdated = loadConversations();
        const target = conversationsUpdated.find((item) => item.id === activeConversation.id);
        if (target) {
          target.messages = activeConversation.messages;
          saveConversations(conversationsUpdated);
        }

        // Poll the backend for the AI-generated title once streaming is done.
        // _generate_and_save_title() runs async on the server — we wait 2.5 s
        // to give it time to complete, then fetch and apply the result.
        if (isFirstMessage) {
          setTimeout(async () => {
            try {
              const nameRes = await fetchThreadName(sentConversationId);
              const backendTitle = nameRes?.thread_name;
              if (!isDefaultTitle(backendTitle)) {
                _applyTitleUpdate(backendTitle, sentConversationId);
              }
            } catch (_) {
              // Optimistic title already in place — silent fail is fine
            }
          }, 2500);
        }
      },
      onError: () => {
        isStreaming = false;
        abortController = null;
        window.removeEventListener('stream:stop', stopHandler);
        assistantPlaceholder.innerHTML = `
          <div class="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">Unable to connect. Please retry.</div>
        `;
      }
    });
  } catch (error) {
    isStreaming = false;
    abortController = null;
    assistantPlaceholder.innerHTML = `
      <div class="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">${error.message}</div>
    `;
  }
}

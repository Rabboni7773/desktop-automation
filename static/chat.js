import { fetchThreadHistory, fetchThreadName, sendMessage } from './api.js';
import { loadConversations, saveConversations, updateConversation } from './storage.js';
import { createId, formatTime } from './utils.js';
import { renderMarkdown, streamResponse } from './stream.js';

let activeConversation = null;
let isStreaming = false;
let abortController = null;

export function initChat() {
  const chatPanel = document.getElementById('chat-panel');
  const composer = document.getElementById('composer');

  if (!chatPanel || !composer) return;

  chatPanel.innerHTML = `
    <div class="flex h-full flex-col items-center justify-center px-6 text-center">
      <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-soft">
        <span class="text-2xl font-semibold">A</span>
      </div>
      <h2 class="text-2xl font-semibold text-slate-100">Welcome to Automate AI</h2>
      <p class="mt-2 max-w-xl text-sm text-slate-400">Ask anything, debug code, summarize content, or continue a conversation with a polished, streaming experience.</p>
      <div class="mt-8 grid gap-3 md:grid-cols-2">
        <button class="prompt-card rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-blue-500/40">Explain FastAPI</button>
        <button class="prompt-card rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-blue-500/40">Write Python code</button>
        <button class="prompt-card rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-blue-500/40">Summarize text</button>
        <button class="prompt-card rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-blue-500/40">Generate SQL</button>
      </div>
    </div>
  `;

  composer.innerHTML = `
    <textarea id="message-input" rows="1" placeholder="Ask anything..." class="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-blue-500" aria-label="Message input"></textarea>
    <div class="flex items-center gap-2">
      <button id="stop-btn" class="rounded-2xl border border-slate-700 bg-rose-600/80 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500 hidden">Stop</button>
      <button id="send-btn" class="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500">Send</button>
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
  const chatPanel = document.getElementById('chat-panel');
  const threadTitle = document.getElementById('thread-title');
  const history = await fetchThreadHistory(id);
  const name = await fetchThreadName(id);
  const messages = (history.messages || []).map((msg) => ({ role: msg.role, content: msg.content }));
  activeConversation = { id, title: name.thread_name || 'New chat', messages, createdAt: new Date().toISOString() };

  const conversationList = loadConversations();
  const existing = conversationList.find((item) => item.id === id);
  if (!existing) {
    conversationList.unshift(activeConversation);
    saveConversations(conversationList);
  }

  threadTitle.textContent = activeConversation.title;
  renderMessages(messages);
}

function renderMessages(messages) {
  const chatPanel = document.getElementById('chat-panel');
  if (!messages.length) {
    chatPanel.innerHTML = `
      <div class="flex h-full flex-col items-center justify-center px-6 text-center">
        <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-soft">
          <span class="text-2xl font-semibold">A</span>
        </div>
        <h2 class="text-2xl font-semibold text-slate-100">Start a new conversation</h2>
        <p class="mt-2 max-w-xl text-sm text-slate-400">Your chat history will appear here with a polished, streaming experience.</p>
      </div>
    `;
    return;
  }

  chatPanel.innerHTML = `
    <div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto px-4 py-6 scrollbar-thin">
      ${messages.map((message) => `
        <div class="fade-in ${message.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[85%]'}">
          <div class="rounded-3xl border border-slate-800/80 px-4 py-3 ${message.role === 'user' ? 'bg-blue-600/90 text-white shadow-soft' : 'bg-slate-900/70 text-slate-100'}">
            <div class="prose prose-invert max-w-none text-sm leading-7">${renderMarkdown(message.content || '')}</div>
          </div>
          <div class="mt-2 px-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">${formatTime(new Date())}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function sendCurrentMessage() {
  const input = document.getElementById('message-input');
  const value = input.value.trim();
  if (!value || isStreaming) return;
  if (!activeConversation) {
    activeConversation = { id: createId(), title: value.slice(0, 40), messages: [], createdAt: new Date().toISOString() };
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
  renderMessages(activeConversation.messages);
  input.value = '';

  const assistantPlaceholder = document.createElement('div');
  assistantPlaceholder.className = 'fade-in mr-auto max-w-[85%]';
  assistantPlaceholder.innerHTML = `
    <div class="rounded-3xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 text-slate-100">
      <div class="flex items-center gap-2 text-sm text-slate-400"><span class="typing-dot h-2 w-2 rounded-full bg-slate-400"></span><span class="typing-dot h-2 w-2 rounded-full bg-slate-400"></span><span class="typing-dot h-2 w-2 rounded-full bg-slate-400"></span></div>
    </div>
  `;
  document.querySelector('#chat-panel .flex')?.appendChild(assistantPlaceholder);

  isStreaming = true;
  try {
    const { reader, controller } = await sendMessage(activeConversation.id, value);
    abortController = controller;
    // allow external stop events to abort the stream
    const stopHandler = () => {
      if (abortController) abortController.abort();
    };
    window.addEventListener('stream:stop', stopHandler, { once: true });

    await streamResponse({
      reader,
      onChunk: (chunk) => {
        const content = chunk.replace(/\n/g, '\n');
        assistantPlaceholder.innerHTML = `
          <div class="rounded-3xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 text-slate-100">
            <div class="prose prose-invert max-w-none text-sm leading-7">${renderMarkdown(content || '')}</div>
          </div>
        `;
        activeConversation.messages[activeConversation.messages.length - 1] = { role: 'assistant', content };
        renderMessages(activeConversation.messages);
      },
      onDone: () => {
        isStreaming = false;
        abortController = null;
        window.removeEventListener('stream:stop', stopHandler);
        const conversationsUpdated = loadConversations();
        const target = conversationsUpdated.find((item) => item.id === activeConversation.id);
        if (target) {
          target.messages = activeConversation.messages;
          saveConversations(conversationsUpdated);
        }
      },
      onError: () => {
        isStreaming = false;
        abortController = null;
        window.removeEventListener('stream:stop', stopHandler);
        assistantPlaceholder.innerHTML = `
          <div class="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">Unable to connect. Please retry.</div>
        `;
      }
    });
  } catch (error) {
    isStreaming = false;
    abortController = null;
    assistantPlaceholder.innerHTML = `
      <div class="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">${error.message}</div>
    `;
  }
}

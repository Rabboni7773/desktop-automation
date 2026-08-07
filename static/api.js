let API_BASE = '';

export function initApi(options = {}) {
  // Allow runtime configuration of the API base URL.
  // Priority: explicit option > window.APP_CONFIG.apiBase > default '' (same origin)
  if (options.base) API_BASE = options.base;
  else if (window.APP_CONFIG && window.APP_CONFIG.apiBase) API_BASE = window.APP_CONFIG.apiBase;
  else API_BASE = '';
}

export async function fetchHistory() {
  const res = await fetch(`${API_BASE}/history/conv_history`);
  if (!res.ok) throw new Error('Unable to fetch conversation history.');
  return res.json();
}

export async function fetchThreadHistory(threadId) {
  const res = await fetch(`${API_BASE}/chat/${threadId}/history`);
  if (!res.ok) throw new Error('Unable to load thread history.');
  return res.json();
}

export async function fetchThreadName(threadId) {
  const res = await fetch(`${API_BASE}/chat/${threadId}/name`);
  if (!res.ok) throw new Error('Unable to load thread name.');
  return res.json();
}

export async function sendMessage(threadId, message) {
  const controller = new AbortController();
  const res = await fetch(`${API_BASE}/chat/${threadId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  });

  if (!res.ok) throw new Error('Unable to reach the AI backend.');
  return { reader: res.body.getReader(), controller };
}

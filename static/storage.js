const STORAGE_KEY = 'automate-conversations';

export function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveConversations(conversations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function addConversation(conversation) {
  const list = loadConversations();
  list.unshift(conversation);
  saveConversations(list);
  return list;
}

export function updateConversation(id, update) {
  const list = loadConversations();
  const next = list.map((item) => (item.id === id ? { ...item, ...update } : item));
  saveConversations(next);
  return next;
}

export function deleteConversation(id) {
  const list = loadConversations().filter((item) => item.id !== id);
  saveConversations(list);
  return list;
}

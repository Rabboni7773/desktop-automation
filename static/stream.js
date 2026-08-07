// marked is loaded as a UMD global via the <script> tag in index.html

export async function streamResponse({ reader, container, onChunk, onDone, onError }) {
  const decoder = new TextDecoder();
  let fullText = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
      if (onChunk) onChunk(fullText);
    }
    if (onDone) onDone(fullText);
  } catch (error) {
    if (onError) onError(error);
  }
}

export function renderMarkdown(text) {
  return window.marked ? window.marked.parse(text || '') : (text || '');
}

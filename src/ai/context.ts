export interface ContextEntry {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_ENTRIES = 3;
const contextMap = new Map<string, ContextEntry[]>();

export function addToContext(phone: string, role: 'user' | 'assistant', content: string): void {
  const entries = contextMap.get(phone) || [];
  entries.push({ role, content });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  contextMap.set(phone, entries);
}

export function getContext(phone: string): ContextEntry[] {
  return contextMap.get(phone) || [];
}

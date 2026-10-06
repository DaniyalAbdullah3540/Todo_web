const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function handle(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `Server returned status ${res.status}`);
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(res.status, body?.error?.code || 'REQUEST_FAILED', body?.error?.message || 'Request failed');
  }
  return body.data !== undefined ? body : body.data;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const out = await handle(res);
  return { raw: out, res };
}

export const api = {
  async listTodos(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    }
    const query = qs.toString();
    const res = await fetch(`${API_BASE}/api/todos${query ? `?${query}` : ''}`);
    const body = await handle(res);
    return body; // { success, data, pagination }
  },
  async createTodo(payload) {
    const { raw } = await request('/todos', { method: 'POST', body: JSON.stringify(payload) });
    return raw.data;
  },
  async updateTodo(id, payload) {
    const { raw } = await request(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return raw.data;
  },
  async toggleTodo(id) {
    const { raw } = await request(`/todos/${id}/toggle`, { method: 'PATCH' });
    return raw.data;
  },
  async deleteTodo(id) {
    const { raw } = await request(`/todos/${id}`, { method: 'DELETE' });
    return raw.data;
  },
  async deleteCompleted() {
    const { raw } = await request('/todos/completed', { method: 'DELETE' });
    return raw.data;
  },
  async getStats() {
    const { raw } = await request('/todos/stats/summary');
    return raw.data;
  },
};

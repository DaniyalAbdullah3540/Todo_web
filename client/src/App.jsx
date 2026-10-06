import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api.js';
import TodoForm from './components/TodoForm.jsx';
import TodoItem from './components/TodoItem.jsx';
import FilterBar from './components/FilterBar.jsx';
import StatsBar from './components/StatsBar.jsx';
import Pagination from './components/Pagination.jsx';

const DEFAULT_FILTERS = {
  status: 'all',
  search: '',
  priority: '',
  tag: '',
  overdue: false,
  sort: '-createdAt',
  page: 1,
};

function toQuery(filters) {
  return {
    status: filters.status,
    search: filters.search.trim() || undefined,
    priority: filters.priority || undefined,
    tag: filters.tag.trim() || undefined,
    overdue: filters.overdue ? 'true' : undefined,
    sort: filters.sort,
    page: filters.page,
    limit: 10,
  };
}

export default function App() {
  const [todos, setTodos] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const searchTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const load = useCallback(async (f) => {
    setLoading(true);
    setError('');
    try {
      const [list, summary] = await Promise.all([api.listTodos(toQuery(f)), api.getStats()]);
      setTodos(list.data);
      setPagination(list.pagination);
      setStats(summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce only the search input; everything else loads immediately.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const delay = filters.search !== '' ? 350 : 0;
    searchTimer.current = setTimeout(() => load(filters), delay);
    return () => clearTimeout(searchTimer.current);
  }, [filters, load]);

  const refresh = () => load(filters);

  const handleCreate = async (payload) => {
    const created = await api.createTodo(payload);
    setTodos((t) => (filters.page === 1 ? [created, ...t].slice(0, 10) : t));
    const summary = await api.getStats();
    setStats(summary);
    showToast('Task added');
  };

  const handleToggle = async (id) => {
    const prev = todos;
    setTodos((t) => t.map((x) => (x.id === id ? { ...x, completed: !x.completed } : x)));
    try {
      const updated = await api.toggleTodo(id);
      setTodos((t) => t.map((x) => (x.id === id ? updated : x)));
      const summary = await api.getStats();
      setStats(summary);
    } catch (err) {
      setTodos(prev);
      showToast(err.message || 'Could not update task');
    }
  };

  const handleUpdate = async (id, patch) => {
    const updated = await api.updateTodo(id, patch);
    setTodos((t) => t.map((x) => (x.id === id ? updated : x)));
    showToast('Task updated');
  };

  const handleDelete = async (id) => {
    await api.deleteTodo(id);
    setTodos((t) => t.filter((x) => x.id !== id));
    const summary = await api.getStats();
    setStats(summary);
    showToast('Task deleted');
  };

  const handleClearCompleted = async () => {
    if (!window.confirm('Delete all completed tasks?')) return;
    const { deletedCount } = await api.deleteCompleted();
    showToast(`${deletedCount} completed task${deletedCount === 1 ? '' : 's'} cleared`);
    refresh();
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>Taskflow</h1>
          <p className="subtitle">A clean, fast to-do app powered by the MERN stack.</p>
        </div>
        <div className={`server-dot ${error ? 'down' : 'up'}`} title={error ? 'API unreachable' : 'API connected'}>
          {error ? '● offline' : '● live'}
        </div>
      </header>

      <main className="container">
        <StatsBar stats={stats} />
        <TodoForm onCreate={handleCreate} disabled={loading && todos.length === 0 && !!error} />
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClearCompleted={handleClearCompleted}
          hasCompleted={(stats?.completed ?? 0) > 0}
        />

        {error && (
          <div className="card error-card" role="alert">
            <p>{error}</p>
            <button className="btn btn-small" onClick={refresh}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="card loading" aria-busy="true">Loading tasks…</div>
        ) : todos.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-emoji">🎯</p>
            <p>No tasks here yet. Add one above to get started.</p>
          </div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        <Pagination pagination={pagination} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      <footer className="footer">
        <span>Built with MongoDB · Express · React · Node</span>
      </footer>
    </div>
  );
}

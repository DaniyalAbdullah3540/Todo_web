const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title A–Z' },
];

export default function FilterBar({ filters, onChange, onClearCompleted, hasCompleted }) {
  const set = (patch) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="card filter-bar">
      <div className="filter-row">
        <div className="segmented" role="tablist" aria-label="Status filter">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              role="tab"
              aria-selected={filters.status === o.value}
              className={`segmented-btn ${filters.status === o.value ? 'active' : ''}`}
              onClick={() => set({ status: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <input
          className="input search-input"
          type="search"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          aria-label="Search tasks"
        />
      </div>
      <div className="filter-row">
        <select
          className="input"
          value={filters.priority}
          onChange={(e) => set({ priority: e.target.value })}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          className="input"
          type="text"
          placeholder="Filter by tag"
          value={filters.tag}
          onChange={(e) => set({ tag: e.target.value })}
          aria-label="Filter by tag"
        />
        <label className="check-label">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={(e) => set({ overdue: e.target.checked })}
          />
          Overdue only
        </label>
        <select
          className="input"
          value={filters.sort}
          onChange={(e) => set({ sort: e.target.value })}
          aria-label="Sort tasks"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {hasCompleted && (
          <button className="btn btn-ghost" onClick={onClearCompleted}>
            Clear completed
          </button>
        )}
      </div>
    </div>
  );
}

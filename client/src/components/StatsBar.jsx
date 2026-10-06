export default function StatsBar({ stats }) {
  if (!stats) return null;
  const pct = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
  return (
    <div className="card stats-bar" aria-label="Task statistics">
      <div className="stat">
        <span className="stat-value">{stats.total}</span>
        <span className="stat-label">Total</span>
      </div>
      <div className="stat">
        <span className="stat-value">{stats.active}</span>
        <span className="stat-label">Active</span>
      </div>
      <div className="stat">
        <span className="stat-value">{stats.completed}</span>
        <span className="stat-label">Done</span>
      </div>
      <div className="stat">
        <span className={`stat-value ${stats.overdue > 0 ? 'warn' : ''}`}>{stats.overdue}</span>
        <span className="stat-label">Overdue</span>
      </div>
      <div className="progress">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-label">{pct}% complete</span>
      </div>
    </div>
  );
}

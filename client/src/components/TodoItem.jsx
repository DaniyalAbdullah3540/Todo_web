import { useState } from 'react';

function formatDue(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day - today) / 86400000);
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (diffDays < 0) return { label, cls: 'overdue' };
  if (diffDays === 0) return { label: 'Today', cls: 'due-soon' };
  if (diffDays === 1) return { label: 'Tomorrow', cls: 'due-soon' };
  return { label, cls: '' };
}

export default function TodoItem({ todo, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const due = formatDue(todo.dueDate);

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === todo.title) {
      setEditing(false);
      setDraft(todo.title);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onUpdate(todo.id, { title: trimmed });
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${todo.title}"?`)) return;
    setBusy(true);
    try {
      await onDelete(todo.id);
    } catch (err) {
      setError(err.message || 'Could not delete.');
      setBusy(false);
    }
  };

  return (
    <li className={`todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`}>
      <button
        className="checkbox"
        role="checkbox"
        aria-checked={todo.completed}
        aria-label={todo.completed ? 'Mark as active' : 'Mark as completed'}
        onClick={() => onToggle(todo.id)}
        disabled={busy}
      >
        {todo.completed && <span aria-hidden="true">✓</span>}
      </button>

      <div className="todo-main">
        {editing ? (
          <div className="edit-row">
            <input
              className="input"
              value={draft}
              maxLength={200}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') { setEditing(false); setDraft(todo.title); }
              }}
              autoFocus
              disabled={busy}
            />
            <button className="btn btn-small" onClick={saveEdit} disabled={busy}>Save</button>
            <button className="btn btn-small btn-ghost" onClick={() => { setEditing(false); setDraft(todo.title); }} disabled={busy}>Cancel</button>
          </div>
        ) : (
          <span className="todo-title" onDoubleClick={() => setEditing(true)} title="Double-click to edit">
            {todo.title}
          </span>
        )}

        {todo.notes && <p className="todo-notes">{todo.notes}</p>}

        <div className="todo-meta">
          <span className={`badge priority-${todo.priority}`}>{todo.priority}</span>
          {due && <span className={`badge due ${due.cls}`}>📅 {due.label}</span>}
          {todo.tags.map((tag) => (
            <span key={tag} className="badge tag">#{tag}</span>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <div className="todo-actions">
        {!editing && (
          <button className="icon-btn" onClick={() => setEditing(true)} disabled={busy} aria-label="Edit task" title="Edit">
            ✎
          </button>
        )}
        <button className="icon-btn danger" onClick={handleDelete} disabled={busy} aria-label="Delete task" title="Delete">
          🗑
        </button>
      </div>
    </li>
  );
}

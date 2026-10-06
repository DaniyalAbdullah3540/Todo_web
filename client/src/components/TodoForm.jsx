import { useState } from 'react';

const PRIORITIES = ['low', 'medium', 'high'];

export default function TodoForm({ onCreate, disabled }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Please enter a task title.');
      return;
    }
    if (trimmed.length > 200) {
      setError('Title cannot exceed 200 characters.');
      return;
    }
    try {
      await onCreate({
        title: trimmed,
        notes: notes.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setTitle('');
      setNotes('');
      setPriority('medium');
      setDueDate('');
      setTags('');
    } catch (err) {
      setError(err.message || 'Could not create the task.');
    }
  };

  return (
    <form className="card todo-form" onSubmit={submit} aria-label="Create a new task">
      <div className="form-row">
        <input
          className="input title-input"
          type="text"
          placeholder="What needs to be done?"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={disabled}>
          Add task
        </button>
      </div>
      <div className="form-grid">
        <input
          className="input"
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
        />
        <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={disabled} aria-label="Priority">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={disabled}
          aria-label="Due date"
        />
        <input
          className="input"
          type="text"
          placeholder="Tags, comma separated"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          disabled={disabled}
        />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export default function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;
  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.push(p);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-small" disabled={!pagination.hasPrev} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      {pages[0] > 1 && <span className="page-ellipsis">…</span>}
      {pages.map((p) => (
        <button
          key={p}
          className={`btn btn-small ${p === page ? 'btn-primary' : 'btn-ghost'}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages && <span className="page-ellipsis">…</span>}
      <button className="btn btn-small" disabled={!pagination.hasNext} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </nav>
  );
}

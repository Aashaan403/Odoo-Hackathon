import { useEffect, useState } from 'react';

// Hairline table with client-side paging so large workspaces only render one page of rows.
export function DataTable({ columns, rows, onRowClick, activeId, empty = 'Nothing to show yet.', pageSize = 25, minWidth = 720 }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (page > pages - 1) setPage(0); }, [page, pages]);
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  const align = (column) => (column.align === 'right' ? 'text-right' : 'text-left');

  if (!rows.length) return <Empty>{empty}</Empty>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-ink">
              {columns.map((column) => <th key={column.key} scope="col" className={`py-3 pr-5 text-[13px] font-medium text-mute last:pr-0 ${align(column)}`}>{column.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter') onRowClick(row); } : undefined}
                className={`border-b border-line transition-colors ${onRowClick ? 'cursor-pointer hover:bg-plum-wash focus-visible:bg-plum-wash focus-visible:outline-none' : ''} ${activeId === row.id ? 'bg-plum-wash' : ''}`}
              >
                {columns.map((column) => <td key={column.key} className={`py-3.5 pr-5 align-middle last:pr-0 ${align(column)} ${column.className || ''}`}>{column.render ? column.render(row) : row[column.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4 text-sm text-mute">
          <span className="tabular-nums">{page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}</span>
          <div className="flex gap-4">
            <button className="font-medium hover:text-ink disabled:text-line" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="font-medium hover:text-ink disabled:text-line" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="flex flex-col items-start gap-3 border-y border-line py-10">
      <p className="max-w-md text-sm text-mute">{children}</p>
      {action}
    </div>
  );
}

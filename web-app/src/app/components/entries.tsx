'use client';

import { Entry } from '../service/database';

interface EntriesTableProps {
  initialEntries: Entry[];
  filteredEntries?: Entry[];
  filterLabel?: string;
}

export default function EntriesTable({ initialEntries, filteredEntries, filterLabel }: EntriesTableProps) {
  const entries = filteredEntries || initialEntries;

  return (
    <div className="table-container">
      {filterLabel && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-2 rounded mb-4">
          Showing filtered results for: {filterLabel}
          {filteredEntries && (
            <span className="ml-2">({filteredEntries.length} entries)</span>
          )}
        </div>
      )}

      <div className="table-header">
        <div className="table-cell">Timestamp</div>
        <div className="table-cell">Coordinates</div>
        <div className="table-cell">Type</div>
        <div className="table-cell">Direction</div>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-600">No entries found.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry._id} className="table-row">
            <div className="table-cell">
              {new Date(entry.timestamp).toLocaleString()}
            </div>
            <div className="table-cell">
              {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
            </div>
            <div className="table-cell">{entry.category}</div>
            <div className="table-cell">{entry.direction}</div>
          </div>
        ))
      )}
    </div>
  );
}

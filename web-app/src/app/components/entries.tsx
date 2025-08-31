'use client';

import { Entry } from '../service/database';
import { getTimeGroupKey, TimeGrouping } from '../util/timeGroup';

interface EntriesTableProps {
  initialEntries: Entry[];
  filteredEntries?: Entry[];
  filterLabel?: string;
  timeGrouping: TimeGrouping;
}

// Helper to get time group key

export default function EntriesTable({ initialEntries, filteredEntries, filterLabel, timeGrouping }: EntriesTableProps) {
  const filterActive = !!filterLabel;
  const entries = filterActive ? (filteredEntries || []) : initialEntries;

  // Group entries by time group
  const groupedEntries: { [key: string]: Entry[] } = {};
  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const timeKey = getTimeGroupKey(date, timeGrouping);
    if (!groupedEntries[timeKey]) groupedEntries[timeKey] = [];
    groupedEntries[timeKey].push(entry);
  });

  const sortedTimeKeys = Object.keys(groupedEntries).sort();

  return (
    <div className="table-container">
      {filterLabel && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-2 rounded mb-4">
          Showing filtered results for: {filterLabel}
          <span className="ml-2">({entries.length} entries)</span>
        </div>
      )}

      <div className="table-header">
        <div className="table-cell">Timestamp</div>
        <div className="table-cell">Coordinates</div>
        <div className="table-cell">Type</div>
        <div className="table-cell">Direction</div>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-600">
          {filterActive ? "No entries found for this selection." : "No entries found."}
        </p>
      ) : (
        sortedTimeKeys.map(timeKey => 
          groupedEntries[timeKey].map((entry) => (
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
        )
      )}
    </div>
  );
}
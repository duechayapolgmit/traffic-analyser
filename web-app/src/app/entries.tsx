'use client';

import { useState, useEffect } from 'react';

const FETCH_URL = 'http://localhost:5000/api/data'

interface Entry {
  _id: string;
  category: string;
  latitude: number;
  longitude: number;
  timestamp: string; // Changed from Date to string
  direction: string;
}

export default function EntriesTable({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(FETCH_URL);
      const data = await res.json();
      setEntries(data);
    } catch (error) {
      console.error('Fetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="table-container">
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
              {new Date(entry.timestamp).toISOString()}
            </div>
            <div className="table-cell">{entry.latitude}, {entry.longitude}</div>
            <div className="table-cell">{entry.category}</div>
            <div className="table-cell">{entry.direction}</div>
          </div>
        ))
      )}
      {isLoading && <p className="text-gray-500">Updating...</p>}
    </div>
  );
}
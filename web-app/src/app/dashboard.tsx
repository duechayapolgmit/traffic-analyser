'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Entry, fetchEntries } from './service/database';
import CategoryTimeChart from './components/chart';
import EntriesTable from './components/entries';

// Deep comparison helper
const areEntriesEqual = (entries1: Entry[], entries2: Entry[]): boolean => {
  if (entries1.length !== entries2.length) return false;

  return entries1.every((entry1, index) => {
    const entry2 = entries2[index];
    return (
      entry1._id === entry2._id &&
      entry1.timestamp === entry2.timestamp &&
      entry1.category === entry2.category &&
      entry1.latitude === entry2.latitude &&
      entry1.longitude === entry2.longitude &&
      entry1.direction === entry2.direction
    );
  });
};

export default function Dashboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);
  const [filterLabel, setFilterLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const previousEntriesRef = useRef<Entry[]>([]);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchEntries();

      if (!areEntriesEqual(data, previousEntriesRef.current)) {
        setEntries(data);
        previousEntriesRef.current = data;
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setError('Failed to fetch entries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    const interval = setInterval(loadEntries, 15000);
    return () => clearInterval(interval);
  }, []);

  const memoizedEntries = useMemo(() => entries, [entries]);

  const handleBarClick = (entries: Entry[], label: string) => {
    setFilteredEntries(entries);
    setFilterLabel(label);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {error && (
        <div className="lg:col-span-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="lg:col-span-2 text-blue-600 mb-4">Loading data...</div>
      )}

      <div className="lg:col-span-2">
        <CategoryTimeChart 
          initialEntries={memoizedEntries} 
          onBarClick={handleBarClick}
        />
      </div>
      
      <div className="lg:col-span-2">
        <EntriesTable 
          initialEntries={memoizedEntries} 
          filteredEntries={filteredEntries}
          filterLabel={filterLabel}
        />
      </div>
    </div>
  );
}

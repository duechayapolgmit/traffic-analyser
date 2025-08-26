'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import CategoryTimeChart from './components/chart';
import EntriesTable from './components/entries';
import { Entry, fetchEntries } from './service/database';

export type TimeGrouping = '1min' | '5min' | '15min' | '30min' | '1hour';

// Helper to get time group key
function getTimeGroupKey(date: Date, timeGrouping: TimeGrouping) {
  const minutes = date.getMinutes();
  switch (timeGrouping) {
    case '1min':
      return `${date.toDateString()} ${date.getHours()}:${minutes.toString().padStart(2, '0')}`;
    case '5min':
      return `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 5) * 5}`;
    case '15min':
      return `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 15) * 15}`;
    case '30min':
      return `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 30) * 30}`;
    case '1hour':
      return `${date.toDateString()} ${date.getHours()}:00`;
    default:
      return date.toDateString();
  }
}

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
  const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>('5min');

  const previousEntriesRef = useRef<Entry[]>([]);

  const loadEntries = async () => {
    try {
      setError(null);
      const data = await fetchEntries();
      if (!areEntriesEqual(data, previousEntriesRef.current)) {
        setEntries(data);
        previousEntriesRef.current = data;
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setError('Failed to fetch entries. Please try again.');
    }
  };

  useEffect(() => {
    loadEntries();
    const interval = setInterval(loadEntries, 15000);
    return () => clearInterval(interval);
  }, []);

  // Clear filter when time grouping changes
  useEffect(() => {
    setFilterLabel('');
    setFilteredEntries([]);
  }, [timeGrouping]);

  const memoizedEntries = useMemo(() => entries, [entries]);

  // Always filter using current timeGrouping and full entries list
  const handleBarClick = (timeKey: string, category: string) => {
    console.log('----')
    const filtered = entries.filter(entry => {
      const entryTimeKey = getTimeGroupKey(new Date(entry.timestamp), timeGrouping);
      console.log(timeKey)
      return entryTimeKey === timeKey && entry.category === category;
    });
    setFilteredEntries(filtered);
    setFilterLabel(`${timeKey} - ${category}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-3">
      {error && (
        <div className="lg:col-span-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="lg:col-span-2 mb-4 flex gap-4 items-center flex-wrap">
        <label htmlFor="time-grouping" className="text-sm font-medium text-gray-700">
          Time Grouping:
        </label>
        <select
          id="time-grouping"
          value={timeGrouping}
          onChange={e => setTimeGrouping(e.target.value as TimeGrouping)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="1min">1 Minute</option>
          <option value="5min">5 Minutes</option>
          <option value="15min">15 Minutes</option>
          <option value="30min">30 Minutes</option>
          <option value="1hour">1 Hour</option>
        </select>
      </div>

      <div className="lg:col-span-2">
        <CategoryTimeChart 
          initialEntries={memoizedEntries} 
          timeGrouping={timeGrouping}
          onBarClick={handleBarClick}
        />
      </div>

      <div className="lg:col-span-2">
        <EntriesTable 
          initialEntries={memoizedEntries} 
          filteredEntries={filteredEntries}
          filterLabel={filterLabel}
          timeGrouping={timeGrouping}
        />
      </div>
    </div>
  );
}
'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { Entry } from "../service/database";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

Chart.register([
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Title,
  Tooltip,
  Legend
]);

interface CategoryTimeChartProps {
  initialEntries: Entry[];
  timeGrouping: '1min' | '5min' | '15min' | '30min' | '1hour';
  onBarClick?: (timeKey: string, category: string) => void;
}

export default function CategoryTimeChart({ initialEntries, timeGrouping, onBarClick }: CategoryTimeChartProps) {
  const [selectedBar, setSelectedBar] = useState<{ timeKey: string; category: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const timeGroupsMapRef = useRef<Map<string, Entry[]>>(new Map());

  const handleBarClick = (timeKey: string, category: string) => {
    const mapKey = `${timeKey}_${category}`;
    const filteredEntries = timeGroupsMapRef.current.get(mapKey) || [];
    setSelectedBar({ timeKey, category });

    if (onBarClick) {
      onBarClick(timeKey, category);
    }

    // Highlight selected bar dynamically
    if (chartRef.current) {
      chartRef.current.data.datasets.forEach((dataset) => {
        dataset.borderWidth = dataset.label === category ? 3 : 1;
      });
      chartRef.current.update();
    }
  };

  const getGroupedData = useCallback(() => {
    const categories = Array.from(new Set(initialEntries.map(e => e.category)));
    const timeGroups: { [key: string]: { [category: string]: number } } = {};
    timeGroupsMapRef.current.clear();

    initialEntries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const minutes = date.getMinutes();
      let timeKey: string;

      switch (timeGrouping) {
        case '1min':
          timeKey = `${date.toDateString()} ${date.getHours()}:${minutes.toString().padStart(2, '0')}`;
          break;
        case '5min':
          timeKey = `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 5) * 5}`;
          break;
        case '15min':
          timeKey = `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 15) * 15}`;
          break;
        case '30min':
          timeKey = `${date.toDateString()} ${date.getHours()}:${Math.floor(minutes / 30) * 30}`;
          break;
        case '1hour':
          timeKey = `${date.toDateString()} ${date.getHours()}:00`;
          break;
        default:
          timeKey = date.toDateString();
      }

      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {};
        categories.forEach(cat => timeGroups[timeKey][cat] = 0);
      }

      timeGroups[timeKey][entry.category]++;
      const mapKey = `${timeKey}_${entry.category}`;
      if (!timeGroupsMapRef.current.has(mapKey)) {
        timeGroupsMapRef.current.set(mapKey, []);
      }
      timeGroupsMapRef.current.get(mapKey)!.push(entry);
    });

    return { timeGroups, categories };
  }, [initialEntries, timeGrouping]);

  const setupChart = useCallback(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx || initialEntries.length === 0) return;

    const { timeGroups, categories } = getGroupedData();
    const sortedTimeKeys = Object.keys(timeGroups).sort();
    const timeLabels = sortedTimeKeys;

    const datasets = categories.map((category, index) => ({
      label: category,
      data: sortedTimeKeys.map(time => timeGroups[time][category] || 0),
      backgroundColor: `hsl(${(index * 360) / categories.length}, 70%, 60%)`,
      borderColor: `hsl(${(index * 360) / categories.length}, 70%, 40%)`,
      borderWidth: 1,
    }));

    // Always destroy previous chart before creating a new one
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: timeLabels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const element = elements[0];
            const datasetIndex = element.datasetIndex;
            const index = element.index;
            const timeKey = timeLabels[index];
            const category = categories[datasetIndex];
            if (onBarClick) {
              onBarClick(timeKey, category);
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: 'Number of Items'
            },
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Items per Category (Grouped by ${timeGrouping.replace('min', '-minute').replace('1hour', '1-hour')})`
          },
          tooltip: {
            callbacks: {
              label: context => `${context.dataset.label}: ${context.parsed.y} items`,
              title: context => timeLabels[context[0].dataIndex]
            }
          }
        }
      }
    });
  }, [initialEntries, timeGrouping, getGroupedData]);

  useEffect(() => {
    setupChart();
    // Clean up chart on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [setupChart]);

  return (
    <div className="p-4">
      {selectedBar && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-2 rounded mb-4">
          Selected: {selectedBar.timeKey} - {selectedBar.category}
          <button
            onClick={() => {
              setSelectedBar(null);
              if (onBarClick) onBarClick('', '');
              if (chartRef.current) {
                chartRef.current.data.datasets.forEach(ds => ds.borderWidth = 1);
                chartRef.current.update();
              }
            }}
            className="ml-4 text-blue-800 hover:text-blue-900 underline"
          >
            Clear Selection
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <div className="text-sm text-gray-600">
          Total entries: {initialEntries.length} | Categories: {Array.from(new Set(initialEntries.map(e => e.category))).join(', ')}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow" style={{ height: '500px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
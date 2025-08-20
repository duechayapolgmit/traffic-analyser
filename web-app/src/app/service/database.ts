const FETCH_URL = 'http://localhost:5000/api/data';

export interface Entry {
  _id: string;
  category: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  direction: string;
}

// Fetch data from Express Node Server
export const fetchEntries = async (): Promise<Entry[]> => {
  try {
    const res = await fetch(FETCH_URL);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error; // Re-throw to let the component handle it
  }
};
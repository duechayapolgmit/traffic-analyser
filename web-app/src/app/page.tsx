import { connectDB, Item } from '@/util/database';
import EntriesTable from './components/entries';
import EntryChart from './components/chart';
import Dashboard from './dashboard';

export default async function Home() {
  try {
    await connectDB();
    
    // Add error handling for the query
    const initialEntries = await Item.find().sort({ timestamp: -1 }).lean().exec();
    
    if (!initialEntries) {
      throw new Error('No entries found');
    }

    return (
      <div className='grid grid-cols-1 gap-3 p-6'>
        <h1 className="text-xl">Object Detections</h1>
        <p>Refreshes every 15 seconds</p>
        <Dashboard/>
      </div>
    );
  } catch (error: any) {
    console.error('Database error:', error);
    return (
      <div className='grid grid-cols-1 gap-3 p-6'>
        <h1 className="text-xl">Object Detections</h1>
        <div className="text-red-500">Error loading data: {error.message}</div>
      </div>
    );
  }
}
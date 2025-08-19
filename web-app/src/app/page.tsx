import { connectDB, Item } from '@/util/database';
import EntriesTable from './entries';

export default async function Home() {
  try {
    await connectDB();
    
    // Add error handling for the query
    const initialEntries = await Item.find().sort({ timestamp: -1 }).lean().exec();
    
    if (!initialEntries) {
      throw new Error('No entries found');
    }

    return (
      <div>
        <h1 className="text-xl">Detections</h1>
        <p>Refreshes every 5 seconds</p>
        <EntriesTable initialEntries={JSON.parse(JSON.stringify(initialEntries))} />
      </div>
    );
  } catch (error: any) {
    console.error('Database error:', error);
    return (
      <div>
        <h1 className="text-xl">Detections</h1>
        <div className="text-red-500">Error loading data: {error.message}</div>
      </div>
    );
  }
}
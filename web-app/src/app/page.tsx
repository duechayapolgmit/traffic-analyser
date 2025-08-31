import Dashboard from './dashboard';

export default async function Home() {
  return (
      <div className='grid grid-cols-1 gap-3 p-6'>
        <h1 className="text-xl">Object Detections</h1>
        <p>Refreshes every 15 seconds</p>
        <Dashboard/>
      </div>
    );
}
import { GetServerSideProps } from "next";
import { connectDB, Item } from "../util/database";

interface Props {
  entries: any[]
}

export default async function Home() {
  await connectDB();

  const entries = await Item.find();

  return (
    <div>
      <h1 className="text-xl">Detections</h1>
      {entries.length === 0 ? (
        <p className="text-gray-600">No entries found in the database.</p>
      ) : (
        <div className="grid gap-1">
          {entries.map((entry) => (
            <div key={entry._id.toString()} className="p-4 shadow-sm">
              <p className="font-semibold">{entry.category}, {entry.latitude}, {entry.longitude}, {entry.timestamp.toString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
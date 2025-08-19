import { NextResponse } from 'next/server';
import { connectDB, Item } from '@/util/database';

export const dynamic = 'force-dynamic'; // Ensure no caching

export async function GET() {
  try {
    await connectDB();
    const entries = await Item.find().sort({ timestamp: -1 });
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: 'Database fetch failed' },
      { status: 500 }
    );
  }
}
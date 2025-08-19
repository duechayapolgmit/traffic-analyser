import mongoose from "mongoose";

const MONGODB_URI = 'mongodb://127.0.0.1:27017/traffic-data';

export async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  }
}

// Schema
const itemSchema = new mongoose.Schema({
  category: String,
  latitude: Number,
  longitude: Number,
  timestamp: Date,
  direction: String
}, { collection: 'detections' }); 

// Check if model already exists, otherwise create it
export const Item = mongoose.models.item || mongoose.model('item', itemSchema);
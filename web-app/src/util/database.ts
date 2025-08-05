import mongoose from "mongoose";

const MONGODB_URI = 'mongodb://127.0.0.1:27017/traffic-data';

export async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  }
}

export const Item = mongoose.models.item || 
  mongoose.model('item', new mongoose.Schema({
    category: String,
    latitude: Number,
    longitude: Number,
    timestamp: Date
  }), 'detections');
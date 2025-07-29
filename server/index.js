const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(`mongodb://127.0.0.1:27017/traffic-analyser`)
    .then(() => console.log('MongoDB connected'))

// Model
const Item = mongoose.model('item', new mongoose.Schema({
    category: String,
    latitude: Number,
    longitude: Number,
    timestamp: Date
}), 'traffic-data')

// MongoDB stuff
app.post('/api/data', async (req, res) => {
    const item = new Item(req.body);
    try {
        const savedItem = await item.save();
        res.status(201).json(savedItem);
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
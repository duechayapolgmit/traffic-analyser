const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(`mongodb://127.0.0.1:27017/traffic-data`)
    .then(() => console.log('MongoDB connected'))

// Model
const Item = mongoose.model('item', new mongoose.Schema({
    category: String,
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    direction: String
}), 'detections')

// MongoDB stuff
app.post('/api/data', async (req, res) => {
    const item = new Item(req.body);
    try {
        const savedItem = await item.save();
        console.log(item)
        res.status(201).json(savedItem);
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
})

app.get('/api/data', async (req, res) => {
    try {
        const entries = await Item.find()
            .sort({ timestamp: -1 });
        
        if (!entries || entries.length === 0) {
            return res.status(404).json({ message: 'No entries found' });
        }

        res.status(200).json(entries);
    } catch (err) {
        console.error('Fetch error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
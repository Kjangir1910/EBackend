const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

// Dummy Endpoint 1: Check Links
app.post('/check-links', (req, res) => {
    console.log('Received request at /check-links');
    res.json({ message: 'Check links endpoint working!' });
});

// Dummy Endpoint 2: Check Spelling
app.post('/check-spelling', (req, res) => {
    console.log('Received request at /check-spelling');
    res.json({ message: 'Check spelling endpoint working!' });
});

// Catch-All for 404 Errors
app.use((req, res) => {
    res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.url}` });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

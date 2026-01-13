const express = require('express');
const connectDB = require("./config/db");

const app = express();
app.use(express.json());


// Connect to database
connectDB();


// Basic route to test
app.get('/', (req, res) => {
    res.send('API is running...');
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


























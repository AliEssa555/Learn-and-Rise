const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const authMiddleware = require('./src/middleware/authMiddleware');
const mainRoutes = require('./src/routes/mainRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const authRoutes = require('./src/routes/authRoutes');
const playerRoutes = require('./src/routes/playerRoutes');
const podcastRoutes = require('./src/routes/podcastRoutes');

// Load environment variables
dotenv.config();

const app = express();
const mongoose = require('mongoose');
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Apply Auth Middleware to all routes EXCEPT public ones
// (The middleware itself has logic to skip public paths, but we can also apply it selectively)
app.use(authMiddleware);

// Routes
app.use('/', mainRoutes);
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/player', playerRoutes);
app.use('/podcast', podcastRoutes);


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

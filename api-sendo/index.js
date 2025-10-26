const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const userRoutes = require('./routes/userRoutes');
const monitorRoutes = require('./routes/monitorRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');

const app = express();

// Body parser
app.use(express.json());

// Mount routers
app.use('/api/users', userRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/withdrawals', withdrawalRoutes);

app.get("/", (req,res) => {
    res.send("Welcome to SENDO API");
})

const PORT = process.env.PORT || 3000;

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
    mongoose.set('strictQuery', true);

    if (isConnected) {
        console.log('Using existing MongoDB connection');
        return;
    }

    try {
        if (!process.env.MONGO_URI) {
            console.error("MONGO_URI is missing");
            return;
        }

        const conn = await mongoose.connect(process.env.MONGO_URI, {
            retryWrites: true,
            w: 'majority',
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
        });

        isConnected = conn.connections[0].readyState;
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        // Don't exit process on Vercel
    }
};

module.exports = connectDB;

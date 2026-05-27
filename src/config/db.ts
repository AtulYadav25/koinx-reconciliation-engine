import mongoose from 'mongoose';
import { config } from './env';

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async () => {
    try {
        // Already connected
        if (mongoose.connection.readyState === 1) {
            return mongoose;
        }

        // Connection in progress
        if (connectionPromise) {
            return await connectionPromise;
        }

        console.log('Creating new MongoDB connection...');

        connectionPromise = mongoose.connect(config.MONGO_URI, {
            bufferCommands: false,
        });

        const conn = await connectionPromise;

        console.log('✅ MongoDB Connected');

        return conn;
    } catch (error) {
        connectionPromise = null;

        console.error('❌ MongoDB Connection Error:', error);

        throw error;
    }
};
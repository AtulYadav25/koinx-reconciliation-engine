import app from './app';
import { config } from './config/env';
import { connectDB } from './config/db';

const start = async () => {
    await connectDB();

    try {
        app.listen(parseInt(config.PORT), '::', () => {
            console.log(`🚀 Server running on port ${config.PORT}`);
        });
    } catch (err) {
        process.exit(1);
    }
};

start();
import app from './app';
import { config } from './config/env';

const start = async () => {

    try {
        app.listen(parseInt(config.PORT), '::', () => {
            console.log(`🚀 Server running on port ${config.PORT}`);
        });
    } catch (err) {
        process.exit(1);
    }
};

start();
import app from './app';

const start = async () => {


    try {
        app.listen(3000, '::', () => {
            console.log(`🚀 Server running on port 3000`);
        });
    } catch (err) {
        process.exit(1);
    }
};

start();
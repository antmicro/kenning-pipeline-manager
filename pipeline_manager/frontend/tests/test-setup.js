import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

let serverProcess;

export default async () => {
    console.log('Starting server...');

    // Start the server.
    serverProcess = exec('npm run serve-static');

    // Wait for the server to be ready.
    await new Promise((resolve) => {
        const checkServer = setInterval(async () => {
            try {
                await execPromise('curl -f http://localhost:8080');
                clearInterval(checkServer);
                resolve();
            } catch (error) {
                console.log('Waiting for server to start...');
            }
        }, 1000); // Check every 1000 milliseconds (1 second).
    });

    console.log('Server is ready.');
};

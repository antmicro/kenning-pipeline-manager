import { exec } from 'child_process';
import { promisify } from 'util';
import { getUrl } from '../tests/config';

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
                await execPromise(`curl -f ${getUrl()}`);
                clearInterval(checkServer);
                resolve();
            } catch (error) {
                console.log('Waiting for server to start...');
            }
        }, 1000); // Check every 1000 milliseconds (1 second).
    });
    console.log('Server is ready.');

    const teardown = async () => {
        console.log('Stopping server...');
        if (serverProcess) {
            serverProcess.kill(); // Terminate the server process
            console.log('Server stopped.');
        }
    };

    process.on('exit', teardown);
    process.on('SIGINT', teardown);
    process.on('SIGTERM', teardown);

};

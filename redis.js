import dotenv from 'dotenv';
dotenv.config();

import { createClient } from 'redis';

const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),  
    }
});

client.on('error', (err) => console.error('Redis Client Error:', err));
client.on('connect', () => console.log('Redis client connected'));
client.on('ready', () => console.log('Redis client ready'));
client.on('end', () => console.log('Redis client disconnected'));

// Connect once when the module loads
(async () => {
    try {
        await client.connect();
        console.log('Redis connected successfully');
    } catch (error) {
        console.error('Redis connection failed:', error);
    }
})();

export default client;
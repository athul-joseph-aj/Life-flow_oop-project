import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    root: path.resolve(process.cwd(), 'src/main/resources/static'),
    envDir: process.cwd(),
    server: {
        host: 'localhost',
        port: 5173
    }
});

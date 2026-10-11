import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    root: path.resolve(process.cwd(), 'src/main/resources/static'),
    envDir: process.cwd(),
    build: {
        // Vercel runs from the repository root and expects its output in ./dist.
        // The source UI remains intentionally rooted at src/main/resources/static.
        outDir: path.resolve(process.cwd(), 'dist'),
        emptyOutDir: true
    },
    server: {
        host: 'localhost',
        port: 5173
    }
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import devApi from './dev-api.js';

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
}));

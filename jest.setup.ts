console.log('✅ jest.setup.ts loaded');
import '@testing-library/jest-dom';

// Polyfill TextEncoder/Decoder for React Router
import { TextEncoder, TextDecoder } from 'node:util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder as any;

// Mock Vite env vars for Jest
process.env.VITE_API_BASE_URL = 'http://localhost:5000';
process.env.VITE_WS_URL = 'ws://localhost:5000';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Filter out harmless Mediapipe WASM logs that are incorrectly output to console.error
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('INFO: Created TensorFlow Lite XNNPACK delegate')) {
    // Redirect to console.log or ignore
    console.log(...args);
    return;
  }
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
// theme.css first: it publishes the design system's tokens on :root, and
// everything below — the shell and every page stylesheet — aliases them.
import './theme.css';
import './global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

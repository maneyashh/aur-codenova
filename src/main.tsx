import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('AURA-GOV mount point missing');
}

createRoot(container).render(<App />);

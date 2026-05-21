const e = window.Error;
const origConsoleError = console.error;

console.error = function (...args) {
    const msg = args.join('');
    if (msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('not a child of this node')) {
        return;
    }
    origConsoleError.apply(console, args);
};

window.addEventListener('error', function (event) {
    if (
        event.message &&
        (event.message.includes('removeChild') ||
            event.message.includes('insertBefore') ||
            event.message.includes('not a child of this node'))
    ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
});

window.addEventListener('unhandledrejection', function (event) {
    const reason = String(event.reason || '');
    if (reason.includes('removeChild') || reason.includes('insertBefore')) {
        event.preventDefault();
        return false;
    }
});

import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/variables.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/animations.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);

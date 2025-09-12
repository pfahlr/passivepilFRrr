import App from './App.svelte';
import './app.css';


const app = new (App as any)({
  target: document.getElementById('app')!,
});

// Load popup logic after rendering so event handlers attach properly
import('~/popup');


export default app;

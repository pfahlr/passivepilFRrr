import App from './App.svelte';
import './app.css';

const app = new (App as any)({
  target: document.getElementById('app')!,
});

export default app;

import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';


const app = mount (App,{
  target: document.getElementById('app')!,
});

// Load popup logic after rendering so event handlers attach properly
import('./popup');


export default app;

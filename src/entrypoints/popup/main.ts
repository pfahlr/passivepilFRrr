import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';


const app = mount(App, {
  target: document.getElementById('app')!,
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'updateForm') {
    if (message.updatedLog == undefined) {
      document.getElementById('log').value = "[log has exceeded maximum length supported by UI, check the console in devtools for current value]";
    }
    document.getElementById('log').value = message.updatedlog;
  }
});


// Load popup logic after rendering so event handlers attach properly
import('./popup');


export default app;

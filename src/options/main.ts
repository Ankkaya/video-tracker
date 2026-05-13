import { createApp } from 'vue';
import App from './App.vue';
import { syncOptionsFavicon } from './favicon';

void syncOptionsFavicon();
createApp(App).mount(document.getElementById('app')!);

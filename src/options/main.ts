import { createApp } from 'vue';
import App from './App.vue';
import { syncOptionsFavicon } from './favicon';
import i18n from '../locales';

void syncOptionsFavicon();
const app = createApp(App);
app.use(i18n);
app.mount(document.getElementById('app')!);

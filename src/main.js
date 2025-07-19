import { createApp } from "vue";
import App from "./App.vue";
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './assets/custom.css'; // Import custom styles last so they override defaults

createApp(App).mount("#app");

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './assets/styles/main.css';
import router from './router'
import App from './App.vue'


const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// src/main.js
// import { createApp } from 'vue'
// import { createPinia } from 'pinia'
// import App from './App.vue'
// import router from './router' // if using router
// import './style.css' // or your main CSS file

// const app = createApp(App)

// app.use(createPinia())
// app.use(router)

// app.mount('#app')

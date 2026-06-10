import { createRouter, createWebHashHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Settings from './pages/Settings.vue'
import Upload from './pages/Upload.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/upload', name: 'Upload', component: Upload },
  { path: '/settings', name: 'Settings', component: Settings },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router

import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 按需导入实际使用的图标（替代全量注册 287 个图标组件）
import { Top, Bottom, UploadFilled, CircleCheckFilled, CircleCloseFilled, DocumentCopy, Link } from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

const app = createApp(App)

// 只注册实际使用的图标
app.component('Top', Top)
app.component('Bottom', Bottom)
app.component('UploadFilled', UploadFilled)
app.component('CircleCheckFilled', CircleCheckFilled)
app.component('CircleCloseFilled', CircleCloseFilled)
app.component('DocumentCopy', DocumentCopy)
app.component('Link', Link)

const pinia = createPinia()

app.use(ElementPlus, { size: 'default' })
app.use(router)
app.use(pinia)
app.mount('#app')

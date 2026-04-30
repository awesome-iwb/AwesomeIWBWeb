import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import App from './App.vue'
import { routes } from './router'
import './style.css'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app }) => {
    const head = createHead()
    app.use(head)
  }
)
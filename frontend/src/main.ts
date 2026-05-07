import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import App from './App.vue'
import { routes, setupRouterGuard } from './router'
import './style.css'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router }) => {
    const head = createHead()
    app.use(head)
    setupRouterGuard(router)
  }
)

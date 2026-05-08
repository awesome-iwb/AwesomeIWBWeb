import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routes, setupRouterGuard } from './router'
import './style.css'

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router }) => {
    setupRouterGuard(router)
  }
)

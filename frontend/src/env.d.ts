/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Injected in vite.config (BUILD_ID / VITE_CLIENT_BUILD_ID / fe@version). */
  readonly VITE_CLIENT_BUILD_ID: string
}

declare module 'echarts-wordcloud/dist/echarts-wordcloud.js';

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

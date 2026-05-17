import { ref } from 'vue'

/**
 * 整站「需刷新」策略（单一事实来源）：
 * - **发版 / 数据大版本**：以服务端 `GET /api/health` 返回的 `buildId` 为准（与 `import.meta.env.VITE_CLIENT_BUILD_ID` 无关；后者仅可在 devtools 对照）。
 * - **小同步**（头像、权限等）：仍由 `useAuth` 的 `/api/auth/me` 在 App 调度下轻量拉取；**不与** `buildId` 变更混为一谈。
 * - **PWA**：`vite-plugin-pwa` 在 `autoUpdate` 下载完 waiting worker 时会触发 `onNeedRefresh`，与 health 横幅合并为同一 UI。
 *
 * HTML 文档导航的缓存策略由网关负责；此处不假设 SW 拦截导航。
 */

const LAST_HEALTH_BUILD_KEY = 'awesome_iwb_last_health_build_id'
const DISMISS_BUILD_BANNER_KEY = 'awesome_iwb_build_banner_dismissed_for'
const DISMISS_SW_BANNER_KEY = 'awesome_iwb_sw_reload_banner_dismissed'

export type SiteReloadReason = 'build' | 'sw'

export const showSiteReloadBanner = ref(false)
export const siteReloadReason = ref<SiteReloadReason | null>(null)
export const pendingRemoteBuildId = ref<string | null>(null)

export async function fetchHealthBuildId(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/health', { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return null
    const data = (await res.json()) as { buildId?: string }
    const id = typeof data.buildId === 'string' && data.buildId.trim() ? data.buildId.trim() : null
    if (import.meta.env.DEV && id) {
      // 便于对照：用户提示仍以服务端 buildId 为准
      console.debug('[AIWB] health buildId=%s VITE_CLIENT_BUILD_ID=%s', id, import.meta.env.VITE_CLIENT_BUILD_ID)
    }
    return id
  } catch {
    return null
  }
}

/** 根据服务端 `buildId` 判定是否需要整页刷新提示。返回本次 health 的 buildId（无则 null）。 */
export async function checkRemoteBuildAndMaybePrompt(): Promise<string | null> {
  const id = await fetchHealthBuildId()
  if (!id) return null

  const prev = localStorage.getItem(LAST_HEALTH_BUILD_KEY)
  if (!prev) {
    localStorage.setItem(LAST_HEALTH_BUILD_KEY, id)
    return id
  }
  if (prev === id) {
    if (siteReloadReason.value === 'build') {
      showSiteReloadBanner.value = false
      siteReloadReason.value = null
      pendingRemoteBuildId.value = null
    }
    return id
  }

  pendingRemoteBuildId.value = id
  if (sessionStorage.getItem(DISMISS_BUILD_BANNER_KEY) === id) return id

  siteReloadReason.value = 'build'
  showSiteReloadBanner.value = true
  return id
}

/** Service Worker 已拉取新版本并等待激活：与 health 共用同一横幅入口。 */
export function promptServiceWorkerUpdate() {
  if (sessionStorage.getItem(DISMISS_SW_BANNER_KEY) === '1') return
  if (showSiteReloadBanner.value && siteReloadReason.value === 'build') return
  siteReloadReason.value = 'sw'
  showSiteReloadBanner.value = true
}

export function reloadSiteForUpdate() {
  const id = pendingRemoteBuildId.value
  showSiteReloadBanner.value = false
  siteReloadReason.value = null
  if (id) localStorage.setItem(LAST_HEALTH_BUILD_KEY, id)
  window.location.reload()
}

export function dismissSiteReloadBanner() {
  showSiteReloadBanner.value = false
  const id = pendingRemoteBuildId.value
  const reason = siteReloadReason.value
  if (reason === 'build' && id) sessionStorage.setItem(DISMISS_BUILD_BANNER_KEY, id)
  if (reason === 'sw') sessionStorage.setItem(DISMISS_SW_BANNER_KEY, '1')
  siteReloadReason.value = null
}

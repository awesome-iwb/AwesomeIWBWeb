# 登录状态刷新丢失问题修复计划

## 问题分析

### 根因：前端 `useAuth` 的 `persist()` 函数是空的，且页面刷新时不恢复会话

经过代码分析，发现以下问题链：

1. **`persist()` 是空函数**（[useAuth.ts:40-41](file:///d:/github/AwesomeIWBWeb/frontend/src/composables/useAuth.ts#L40)）：
   ```typescript
   const persist = () => {
   };
   ```
   用户信息 `user` 和 `token` 都是 Vue `ref`，只存在于内存中。页面刷新后内存清空，状态丢失。

2. **App.vue / main.ts 中没有在启动时恢复会话**：
   - [App.vue](file:///d:/github/AwesomeIWBWeb/frontend/src/App.vue) 没有 `onMounted` 调用 `fetchUser()`
   - [main.ts](file:///d:/github/AwesomeIWBWeb/frontend/src/main.ts) 只设置了路由守卫，没有初始化认证状态
   - 路由守卫 [router/index.ts:84-96](file:///d:/github/AwesomeIWBWeb/frontend/src/router/index.ts#L84) 检查 `isAuthenticated`，但刷新后 `user` 为 `null`，所以守卫直接拦截

3. **后端 Cookie 设置是正确的**：
   - [cookies.ts](file:///d:/github/AwesomeIWBWeb/backend/src/utils/cookies.ts) 正确设置了 `HttpOnly`、`SameSite=Lax`、`Max-Age=7天`、`Path=/`
   - JWT 过期时间 7 天（[config.ts:90](file:///d:/github/AwesomeIWBWeb/backend/src/config.ts#L90)）
   - Cookie 本身会随浏览器请求自动发送

4. **`fetchUser()` 已经能从 Cookie 恢复会话**：
   - [useAuth.ts:97-142](file:///d:/github/AwesomeIWBWeb/frontend/src/composables/useAuth.ts#L97) 调用 `/api/auth/me`（`credentials: 'include'`）
   - 后端 [casdoorAuth.ts:304-367](file:///d:/github/AwesomeIWBWeb/backend/src/plugins/casdoorAuth.ts#L304) 从 Cookie 中读取 JWT 并验证
   - 问题只是：**没有人调用 `fetchUser()`**

5. **Casdoor 回调的浏览器重定向路径没有设置 Cookie**：
   - [casdoorAuth.ts:292-299](file:///d:/github/AwesomeIWBWeb/backend/src/plugins/casdoorAuth.ts#L292)：当 `isBrowserRedirect` 时调用 `setSessionCookie(set, jwt)` ✅
   - 但 Demo 模式 [casdoorAuth.ts:222-231](file:///d:/github/AwesomeIWBWeb/backend/src/plugins/casdoorAuth.ts#L222)：重定向时**没有**调用 `setSessionCookie` ❌

### 数据流分析

```
正常登录流程（Casdoor）：
  用户点击登录 → Casdoor 授权 → /api/auth/callback 
  → setSessionCookie(set, jwt) ✅ → 302 重定向到 /me
  → 前端 MeView 从 URL query 读取 token → setToken()
  → 但 persist() 是空的，刷新后丢失
  → Cookie 还在浏览器中，但前端不知道

页面刷新：
  App.vue 启动 → 没有调用 fetchUser() → user = null
  → 路由守卫检查 isAuthenticated → false → 被拦截
  → 用户看起来"掉登录"了
```

## 修复方案

### 修改 1：在 App.vue 的 onMounted 中调用 fetchUser() 恢复会话

**文件**: `frontend/src/App.vue`

在 App 启动时，如果 Cookie 还有效，自动从后端恢复用户状态：

```typescript
import { onMounted } from 'vue'
import { useAuth } from './composables/useAuth'

onMounted(async () => {
  const { isAuthenticated, fetchUser } = useAuth()
  if (!isAuthenticated.value) {
    await fetchUser()
  }
})
```

### 修改 2：实现 persist() 函数，将用户状态持久化到 localStorage

**文件**: `frontend/src/composables/useAuth.ts`

将 `user` 的关键信息存入 localStorage，页面加载时先从 localStorage 恢复（避免闪烁），再通过 `fetchUser()` 验证：

```typescript
const STORAGE_KEY = 'awesome_iwb_auth'

const persist = () => {
  if (typeof window === 'undefined') return
  if (!user.value) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
}

const loadFromStorage = () => {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      user.value = JSON.parse(raw)
    }
  } catch {}
}
```

在 `loadOnce()` 中调用 `loadFromStorage()`。

### 修改 3：修复 Casdoor Demo 模式重定向时未设置 Cookie

**文件**: `backend/src/plugins/casdoorAuth.ts`

Demo 模式的浏览器重定向分支缺少 `setSessionCookie`：

```typescript
// 修复前（L222-231）：
if (isBrowserRedirect) {
  const redirectUrl = new URL(`${FRONTEND_URL}/me`);
  redirectUrl.searchParams.set("token", jwt);
  // ... 缺少 setSessionCookie
  set.redirect = redirectUrl.toString();
  return;
}

// 修复后：
if (isBrowserRedirect) {
  const redirectUrl = new URL(`${FRONTEND_URL}/me`);
  redirectUrl.searchParams.set("token", jwt);
  // ...
  setSessionCookie(set, jwt);  // 添加这行
  set.redirect = redirectUrl.toString();
  return;
}
```

### 修改 4：路由守卫增加异步等待，避免 fetchUser 未完成就拦截

**文件**: `frontend/src/router/index.ts`

当前路由守卫是同步的，如果 `fetchUser()` 还没完成，`isAuthenticated` 仍然是 `false`。需要添加一个初始化 Promise：

```typescript
let initPromise: Promise<void> | null = null

export function ensureAuthInitialized(): Promise<void> {
  if (initPromise) return initPromise
  const { isAuthenticated, fetchUser } = useAuth()
  if (isAuthenticated.value) return Promise.resolve()
  initPromise = fetchUser().then(() => {})
  return initPromise
}

export function setupRouterGuard(router: Router) {
  router.beforeEach(async (to) => {
    if (typeof window === 'undefined') return true
    await ensureAuthInitialized()
    // ... 原有逻辑
  })
}
```

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `frontend/src/App.vue` | 添加 `onMounted` 调用 `fetchUser()` |
| `frontend/src/composables/useAuth.ts` | 实现 `persist()` 和 `loadFromStorage()` |
| `backend/src/plugins/casdoorAuth.ts` | Demo 模式重定向时添加 `setSessionCookie` |
| `frontend/src/router/index.ts` | 路由守卫添加异步初始化等待 |

## 验证步骤

1. 登录后刷新页面，应保持登录状态
2. 关闭浏览器重新打开，Cookie 未过期时应自动恢复
3. Cookie 过期后刷新，应正确跳转到登录页
4. 退出登录后刷新，不应恢复登录状态
5. `npm run build` 通过

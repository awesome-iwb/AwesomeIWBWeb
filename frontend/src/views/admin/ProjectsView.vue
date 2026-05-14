<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
      <!-- 项目列表侧栏 -->
      <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" :class="{ 'hidden lg:flex': isMobile && mobileView === 'detail' }" style="height: auto; min-height: 400px; max-height: 700px;">
        <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center gap-2">
          <h2 class="font-bold text-lg">软件库</h2>
          <div class="flex items-center gap-2">
            <button @click="showCategoryManager = true; openCategoryManager()" class="px-3 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
              分类
            </button>
            <button @click="openAuditLogs" class="px-3 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
              日志
            </button>
            <button @click="createNewProject" class="w-10 h-10 lg:w-8 lg:h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-200 transition-colors" title="添加新软件">
              <Plus class="w-5 h-5 lg:w-4 lg:h-4" />
            </button>
          </div>
        </div>

        <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
          <input v-model="projectQuery.q" @keyup.enter="fetchAdminProjects" type="text" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base lg:text-sm" placeholder="搜索项目（名称/开发者/关键词）" />
          <select v-model="projectQuery.category" @change="projectQuery.page = 1; fetchAdminProjects()" class="w-full px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base lg:text-sm">
            <option value="">全部分类</option>
            <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <div class="flex gap-2">
            <button @click="projectQuery.page = 1; fetchAdminProjects()" class="flex-1 px-3 py-3 lg:py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-base lg:text-sm font-bold transition-colors">搜索</button>
            <button @click="resetProjectQuery" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-base lg:text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">重置</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          <div
            v-for="p in projectsPage.items"
            :key="p.id || p.slug || p.name"
            @click="selectProject(p); if (isMobile) openDetail()"
            class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
            :class="selectedProjectId === p.id ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-blue-300'"
          >
            <img v-if="p.icon || p.avatar" :src="p.icon || p.avatar" class="w-10 h-10 lg:w-8 lg:h-8 rounded bg-white object-contain p-0.5" />
            <div v-else class="w-10 h-10 lg:w-8 lg:h-8 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">{{ (p.name || '?').charAt(0) }}</div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate text-sm">{{ p.name }}</div>
              <div class="text-xs opacity-80 truncate">{{ p.developer }}</div>
            </div>
          </div>
          <div v-if="projectsPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无数据</div>
        </div>

        <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
          <button @click="prevProjectPage" :disabled="projectsPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
          <div class="text-slate-500 dark:text-slate-300">{{ projectsPage.page }} / {{ Math.max(1, Math.ceil(projectsPage.total / projectsPage.pageSize)) }}</div>
          <button @click="nextProjectPage" :disabled="projectsPage.page >= Math.ceil(projectsPage.total / projectsPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
        </div>

        <div class="p-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
          <button @click="exportJson" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导出 JSON</button>
          <button @click="exportCsv" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导出 CSV</button>
          <button @click="triggerImportJson" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导入 JSON</button>
          <button @click="triggerImportCsv" class="px-3 py-3 lg:py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导入 CSV</button>
          <input ref="importJsonInput" type="file" class="hidden" accept="application/json" @change="importProjectsJson" />
          <input ref="importCsvInput" type="file" class="hidden" accept=".csv,text/csv" @change="importProjectsCsv" />
        </div>
      </div>

      <!-- 项目编辑器 -->
      <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" :class="{ 'hidden': isMobile && mobileView === 'list' }" v-if="projectDraft">
        <div class="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg lg:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              正在编辑: <span class="text-blue-500">{{ projectDraft.name }}</span>
            </h2>
            <div v-if="projectDraft.slug" class="text-xs text-slate-500 dark:text-slate-400 mt-1">slug: {{ projectDraft.slug }}</div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="projectDraft.id" @click="openRevisions" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              历史版本
            </button>
            <button @click="saveProjects" class="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
              <Save class="w-4 h-4" />
              {{ isSaving ? '保存中...' : '保存项目' }}
            </button>
            <button v-if="projectDraft.id" @click="deleteCurrentProject" class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2">
              删除项目
            </button>
          </div>
        </div>

        <!-- 移动端步骤向导 -->
        <div v-if="isMobile" class="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div class="flex items-center justify-between">
            <button
              v-for="step in 4"
              :key="step"
              @click="projectMobileStep = step"
              class="flex flex-col items-center gap-1"
            >
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                :class="projectMobileStep === step ? 'bg-blue-500 text-white' : projectMobileStep > step ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'"
              >
                {{ step }}
              </div>
              <span class="text-[10px]" :class="projectMobileStep === step ? 'text-blue-500 font-bold' : 'text-slate-400'">
                {{ ['基本信息', '分类标签', '媒体资源', '高级设置'][step - 1] }}
              </span>
            </button>
          </div>
        </div>

        <div class="p-4 lg:p-8 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8 overflow-y-auto" style="max-height: 600px;">
          <!-- 步骤1：基本信息 -->
          <div v-if="!isMobile || projectMobileStep === 1" class="lg:col-span-1 space-y-4">
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">软件名称</label>
              <input type="text" v-model="projectDraft.name" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">作者 / 开发者</label>
              <input type="text" v-model="projectDraft.developer" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">一句话简介</label>
              <textarea v-model="projectDraft.description" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 resize-none text-base"></textarea>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">状态</label>
              <input type="text" v-model="projectDraft.status" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" placeholder="例如：活跃 / 停更 / 维护中" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">开源仓库 (Repository)</label>
              <input type="text" v-model="projectDraft.github_url" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
            </div>
          </div>

          <!-- 步骤2：分类标签 -->
          <div v-if="!isMobile || projectMobileStep === 2" class="lg:col-span-1 space-y-4">
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">AI 使用率标签</label>
              <select v-model="projectDraft.ai_usage_state" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base">
                <option value="unknown">未知（用户点击后转圈）</option>
                <option value="under50">未超过 50%</option>
                <option value="over50">超过 50%</option>
              </select>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">稳定性标签</label>
              <select v-model="projectDraft.recommendation" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base">
                <option value="">无</option>
                <option value="稳定">稳定</option>
                <option value="不稳定">不稳定</option>
                <option value="观望中">观望中</option>
              </select>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">编辑推荐</label>
              <select v-model="projectDraft.is_editors_choice" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base">
                <option :value="false">否</option>
                <option :value="true">是</option>
              </select>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">功能特性 (逗号分隔)</label>
              <input type="text" v-model="projectDraft.keywords" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" placeholder="例如：白板, 批注, C#" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">所属分类</label>
              <select v-model="projectDraft.category_id" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base">
                <option :value="null">未分类</option>
                <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>

          <!-- 步骤3：媒体资源 -->
          <div v-if="!isMobile || projectMobileStep === 3" class="lg:col-span-2 space-y-4">
            <div class="p-4 lg:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div>
                  <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex justify-between items-center">
                    <span>应用图标 (Icon)</span>
                    <span class="text-blue-500 text-xs cursor-pointer hover:underline" @click="triggerProjectIconUpload">上传新图标...</span>
                    <input type="file" ref="projectIconInput" @change="uploadProjectIcon" class="hidden" accept="image/*" />
                  </label>
                  <div class="flex gap-4 items-center">
                    <div class="w-16 h-16 shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2">
                      <img v-if="projectDraft.icon || projectDraft.avatar" :src="projectDraft.icon || projectDraft.avatar" class="w-full h-full object-contain" />
                      <span v-else class="text-slate-400 text-xs">无图</span>
                    </div>
                    <input
                      type="text"
                      :value="projectDraft.icon"
                      @input="projectDraft.icon = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
                      class="flex-1 px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base"
                      placeholder="请上传并使用站内地址（/api/uploads/...）"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex justify-between items-center">
                    <span>应用横幅 (Banner)</span>
                    <span class="text-blue-500 text-xs cursor-pointer hover:underline" @click="triggerProjectBannerUpload">上传新横幅...</span>
                    <input type="file" ref="projectBannerInput" @change="uploadProjectBanner" class="hidden" accept="image/*" />
                  </label>
                  <div class="flex flex-col gap-3">
                    <div class="w-full h-24 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 overflow-hidden">
                      <img v-if="projectDraft.banner" :src="projectDraft.banner" class="w-full h-full object-cover rounded-lg" />
                      <span v-else class="text-slate-400 text-xs">无横幅</span>
                    </div>
                    <input
                      type="text"
                      :value="projectDraft.banner"
                      @input="projectDraft.banner = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
                      class="w-full px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base"
                      placeholder="请上传并使用站内地址（/api/uploads/...）"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-if="uploadErrorMessage" class="text-xs text-rose-500">{{ uploadErrorMessage }}</div>
          </div>

          <!-- 步骤4：高级设置 -->
          <div v-if="!isMobile || projectMobileStep === 4" class="lg:col-span-2 space-y-4">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">编程语言 (Language)</label>
                <input type="text" v-model="projectDraft.language" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Star 数量 (Stars)</label>
                <input type="number" v-model.number="projectDraft.stars" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 text-base" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                <span>关联开发者账号（平台）</span>
                <button @click="addPlatformDeveloper" type="button" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  添加
                </button>
              </label>
              <div class="space-y-2">
                <div v-for="(d, idx) in (projectDraft.platform_developers || [])" :key="idx" class="grid grid-cols-1 lg:grid-cols-5 gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30">
                  <input v-model="d.username" type="text" placeholder="username（如 cjk_mkp）" class="lg:col-span-4 px-3 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:border-blue-500 text-base" />
                  <button @click="removePlatformDeveloper(Number(idx))" type="button" class="lg:col-span-1 px-3 py-3 lg:py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                    删除
                  </button>
                </div>
                <div v-if="!(projectDraft.platform_developers || []).length" class="text-sm text-slate-400">
                  暂无关联账号
                </div>
              </div>
            </div>
          </div>

          <!-- 移动端步骤导航 -->
          <div v-if="isMobile" class="lg:col-span-2 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              @click="projectMobileStep = Math.max(1, projectMobileStep - 1)"
              :disabled="projectMobileStep === 1"
              class="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-50"
            >
              上一步
            </button>
            <span class="text-sm text-slate-500">步骤 {{ projectMobileStep }} / 4</span>
            <button
              v-if="projectMobileStep < 4"
              @click="projectMobileStep = Math.min(4, projectMobileStep + 1)"
              class="px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold"
            >
              下一步
            </button>
            <button
              v-else
              @click="saveProjects"
              class="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-2"
            >
              <Save class="w-4 h-4" />
              {{ isSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
      <div v-else class="lg:col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl min-h-[300px] lg:min-h-[700px]" :class="{ 'hidden': isMobile && mobileView === 'list' }">
        <p class="text-slate-400">请在左侧选择一个软件项目进行编辑</p>
      </div>
    </div>

    <!-- 分类管理弹窗 -->
    <div v-if="showCategoryManager" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">分类管理</div>
          <button @click="showCategoryManager = false" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">关闭</button>
        </div>
        <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input v-model="newCategoryName" type="text" placeholder="新分类名称" class="sm:col-span-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-emerald-500" />
            <input v-model="newCategoryDescription" type="text" placeholder="描述（可选）" class="sm:col-span-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-emerald-500" />
          </div>
          <button @click="createCategory" class="w-full px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">创建分类</button>

          <div class="space-y-3">
            <div v-for="c in categoryDrafts" :key="c.id" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <input v-model="c.name" type="text" class="sm:col-span-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" />
                <input v-model="c.description" type="text" class="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" />
              </div>
              <div class="mt-3 flex gap-2">
                <button @click="saveCategory(c)" class="flex-1 px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors">保存</button>
                <button @click="deleteCategory(c)" class="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">删除</button>
              </div>
            </div>
            <div v-if="categoryDrafts.length === 0" class="text-center text-slate-400 py-10">暂无分类</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史版本弹窗 -->
    <div v-if="showRevisionsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">历史版本</div>
          <button @click="showRevisionsModal = false" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">关闭</button>
        </div>
        <div class="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          <div v-for="r in revisions" :key="r.id" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="font-bold truncate">{{ new Date(r.created_at).toLocaleString() }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ r.snapshot?.name }}</div>
            </div>
            <button @click="rollbackToRevision(r.id)" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">回滚</button>
          </div>
          <div v-if="revisions.length === 0" class="text-center text-slate-400 py-10">暂无历史版本</div>
        </div>
      </div>
    </div>

    <!-- 审计日志弹窗 -->
    <div v-if="showAuditModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div class="text-xl font-extrabold text-slate-900 dark:text-white">最近操作日志</div>
          <button @click="showAuditModal = false" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">关闭</button>
        </div>
        <div class="p-6 max-h-[70vh] overflow-y-auto">
          <div class="space-y-2">
            <div v-for="l in auditPage.items" :key="l.id" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div class="flex items-center justify-between gap-4">
                <div class="font-bold">{{ l.action }}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">{{ new Date(l.created_at).toLocaleString() }}</div>
              </div>
              <div class="text-sm text-slate-700 dark:text-slate-200 mt-1">{{ l.entity_type }} {{ l.entity_id }}</div>
            </div>
            <div v-if="auditPage.items.length === 0" class="text-center text-slate-400 py-10">暂无日志</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Save, Plus } from 'lucide-vue-next';
import { adminFetch, formatAdminError, uploadFile, normalizeMediaUrl } from '../../composables/useAdminFetch';

// 移动端适配
const isMobile = ref(false);
const mobileView = ref<'list' | 'detail'>('list');
const updateIsMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 1024;
  }
};
onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
  fetchAdminCategories();
  fetchAdminProjects();
});
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile);
  }
});

const openDetail = () => { mobileView.value = 'detail'; };

// 分类数据
const adminCategories = ref<any[]>([]);

const fetchAdminCategories = async () => {
  try {
    const res = await adminFetch('/api/admin/categories');
    if (res.ok) {
      adminCategories.value = await res.json();
      return;
    }
  } catch {}
  try {
    const res = await adminFetch('/api/categories');
    if (res.ok) adminCategories.value = await res.json();
  } catch {}
};

// 项目列表
const projectsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0
});
const projectQuery = ref<{ q: string; category: string; page: number; pageSize: number }>({
  q: '',
  category: '',
  page: 1,
  pageSize: 20
});
const selectedProjectId = ref<string | null>(null);
const projectDraft = ref<any | null>(null);
const projectMobileStep = ref(1);
const isSaving = ref(false);
const uploadErrorMessage = ref('');

const normalizeProjectDraft = (p: any) => {
  const clone = { ...p };
  if (Array.isArray(clone.keywords)) clone.keywords = clone.keywords.join(', ');
  if (Array.isArray(clone.recommendation)) clone.recommendation = clone.recommendation.join(', ');
  if (!Array.isArray(clone.platform_developers)) clone.platform_developers = [];
  clone.platform_developers = clone.platform_developers.map((d: any) => {
    const legacy = typeof d?.user_id === 'string' ? d.user_id : '';
    const stcn = typeof d?.stcn_user_id === 'string' ? d.stcn_user_id : legacy;
    return {
      username: typeof d?.username === 'string' ? d.username : '',
      stcn_user_id: stcn,
      hzzc_user_id: typeof d?.hzzc_user_id === 'string' ? d.hzzc_user_id : ''
    };
  });
  if (clone.ai_usage_state !== 'unknown' && clone.ai_usage_state !== 'over50' && clone.ai_usage_state !== 'under50') {
    clone.ai_usage_state = 'unknown';
  }
  return clone;
};

const fetchAdminProjects = async () => {
  try {
    const qs = new URLSearchParams();
    if (projectQuery.value.q) qs.set('q', projectQuery.value.q);
    if (projectQuery.value.category) qs.set('category', projectQuery.value.category);
    qs.set('page', String(projectQuery.value.page));
    qs.set('pageSize', String(projectQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/projects?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      projectsPage.value = { ...json, items: (json.items ?? []).map(normalizeProjectDraft) };
      return;
    }
  } catch {}
  try {
    const res = await adminFetch('/api/projects');
    if (!res.ok) return;
    const json = await res.json();
    const flat: any[] = [];
    for (const c of json.categories ?? []) {
      for (const p of c.projects ?? []) flat.push({ ...p, category_id: c.id });
    }
    const q = projectQuery.value.q.trim().toLowerCase();
    const filtered = flat.filter((p) => {
      if (projectQuery.value.category && p.category_id !== projectQuery.value.category) return false;
      if (!q) return true;
      return String(p.name ?? '').toLowerCase().includes(q) || String(p.developer ?? '').toLowerCase().includes(q);
    });
    const total = filtered.length;
    const start = (projectQuery.value.page - 1) * projectQuery.value.pageSize;
    const items = filtered.slice(start, start + projectQuery.value.pageSize);
    projectsPage.value = { items: items.map(normalizeProjectDraft), page: projectQuery.value.page, pageSize: projectQuery.value.pageSize, total };
  } catch {}
};

const selectProject = (p: any) => {
  selectedProjectId.value = p.id ?? null;
  projectDraft.value = normalizeProjectDraft(p);
};

const createNewProject = () => {
  selectedProjectId.value = null;
  projectDraft.value = normalizeProjectDraft({
    name: '新建软件项目',
    developer: '',
    status: '活跃',
    ai_usage_state: 'unknown',
    description: '',
    github_url: '',
    stars: 0,
    language: '',
    avatar: '',
    icon: '',
    banner: '',
    recommendation: '',
    keywords: '',
    category_id: projectQuery.value.category || null
  });
  if (isMobile.value) openDetail();
};

const saveProjects = async () => {
  isSaving.value = true;
  uploadErrorMessage.value = '';
  try {
    if (!projectDraft.value) {
      alert('请先选择一个项目');
      return;
    }
    const p: any = { ...projectDraft.value };
    p.icon = normalizeMediaUrl(p.icon);
    p.banner = normalizeMediaUrl(p.banner);
    const toList = (v: any) => {
      if (Array.isArray(v)) return v;
      if (typeof v !== 'string') return [];
      return v.split(/[,，;]/).map((x) => x.trim()).filter(Boolean);
    };
    p.keywords = toList(p.keywords);
    p.recommendation = toList(p.recommendation);

    const id = p.id;
    if (id) {
      const res = await adminFetch(`/api/admin/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(p)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatAdminError(json, '保存失败', res.status));
      projectDraft.value = normalizeProjectDraft(json);
    } else {
      const res = await adminFetch('/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(p)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatAdminError(json, '创建失败', res.status));
      projectDraft.value = normalizeProjectDraft(json);
    }
    await fetchAdminProjects();
    alert('项目保存成功！');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '项目保存失败'));
  } finally {
    isSaving.value = false;
  }
};

const deleteCurrentProject = async () => {
  if (!projectDraft.value?.id) return;
  const ok = confirm(`确认删除项目：${projectDraft.value.name}？`);
  if (!ok) return;
  isSaving.value = true;
  try {
    const res = await adminFetch(`/api/admin/projects/${projectDraft.value.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(formatAdminError(json, '删除失败', res.status));
    }
    projectDraft.value = null;
    selectedProjectId.value = null;
    await fetchAdminProjects();
    alert('删除成功');
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '删除失败'));
  } finally {
    isSaving.value = false;
  }
};

const prevProjectPage = async () => {
  if (projectsPage.value.page <= 1) return;
  projectQuery.value.page -= 1;
  await fetchAdminProjects();
};

const nextProjectPage = async () => {
  const maxPage = Math.max(1, Math.ceil(projectsPage.value.total / projectsPage.value.pageSize));
  if (projectsPage.value.page >= maxPage) return;
  projectQuery.value.page += 1;
  await fetchAdminProjects();
};

const resetProjectQuery = async () => {
  projectQuery.value = { q: '', category: '', page: 1, pageSize: 20 };
  await fetchAdminProjects();
};

// 导入/导出
const importJsonInput = ref<HTMLInputElement | null>(null);
const importCsvInput = ref<HTMLInputElement | null>(null);

const exportJson = () => window.open('/api/admin/projects/export.json', '_blank');
const exportCsv = () => window.open('/api/admin/projects/export.csv', '_blank');

const triggerImportJson = () => importJsonInput.value?.click();
const triggerImportCsv = () => importCsvInput.value?.click();

const importProjectsJson = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const payload = await file.text();
    const res = await adminFetch('/api/admin/projects/import.json', {
      method: 'POST',
      body: payload
    });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '导入失败', res.status));
    alert(`导入完成：created=${json.created} updated=${json.updated}`);
    await fetchAdminCategories();
    await fetchAdminProjects();
  } catch (err: unknown) {
    alert(formatAdminError({ message: err instanceof Error ? err.message : '' }, '导入失败'));
  } finally {
    if (importJsonInput.value) importJsonInput.value.value = '';
  }
};

const importProjectsCsv = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await adminFetch('/api/admin/projects/import.csv', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(formatAdminError(json, '导入失败', res.status));
    alert(`导入完成：created=${json.created} updated=${json.updated} skipped=${json.skipped}`);
    await fetchAdminCategories();
    await fetchAdminProjects();
  } catch (err: unknown) {
    alert(formatAdminError({ message: err instanceof Error ? err.message : '' }, '导入失败'));
  } finally {
    if (importCsvInput.value) importCsvInput.value.value = '';
  }
};

// 图片上传
const projectIconInput = ref<HTMLInputElement | null>(null);
const projectBannerInput = ref<HTMLInputElement | null>(null);

const triggerProjectIconUpload = () => projectIconInput.value?.click();
const triggerProjectBannerUpload = () => projectBannerInput.value?.click();

const uploadProjectIcon = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !projectDraft.value) return;
  uploadErrorMessage.value = '';
  try {
    const url = await uploadFile(file);
    projectDraft.value.icon = url;
  } catch (err: unknown) {
    uploadErrorMessage.value = err instanceof Error ? err.message : '上传失败';
  }
};

const uploadProjectBanner = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !projectDraft.value) return;
  uploadErrorMessage.value = '';
  try {
    const url = await uploadFile(file);
    projectDraft.value.banner = url;
  } catch (err: unknown) {
    uploadErrorMessage.value = err instanceof Error ? err.message : '上传失败';
  }
};

// 平台开发者
const addPlatformDeveloper = () => {
  if (!projectDraft.value) return;
  if (!Array.isArray(projectDraft.value.platform_developers)) projectDraft.value.platform_developers = [];
  projectDraft.value.platform_developers.push({ username: '', stcn_user_id: '', hzzc_user_id: '' });
};

const removePlatformDeveloper = (idx: number) => {
  if (!projectDraft.value) return;
  if (!Array.isArray(projectDraft.value.platform_developers)) return;
  projectDraft.value.platform_developers.splice(idx, 1);
};

// 分类管理弹窗
const showCategoryManager = ref(false);
const categoryDrafts = ref<any[]>([]);
const newCategoryName = ref('');
const newCategoryDescription = ref('');

const openCategoryManager = () => {
  categoryDrafts.value = adminCategories.value.map((c) => ({ ...c }));
  newCategoryName.value = '';
  newCategoryDescription.value = '';
};

const createCategory = async () => {
  if (!newCategoryName.value.trim()) return;
  const res = await adminFetch('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: newCategoryName.value.trim(), description: newCategoryDescription.value })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '创建失败', res.status));
    return;
  }
  await fetchAdminCategories();
  openCategoryManager();
};

const saveCategory = async (c: any) => {
  const res = await adminFetch(`/api/admin/categories/${c.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: c.name, description: c.description, sort_index: c.sort_index })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '保存失败', res.status));
    return;
  }
  await fetchAdminCategories();
  openCategoryManager();
};

const deleteCategory = async (c: any) => {
  const ok = confirm(`确认删除分类：${c.name}？（分类下项目将变为未分类）`);
  if (!ok) return;
  const res = await adminFetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '删除失败', res.status));
    return;
  }
  await fetchAdminCategories();
  openCategoryManager();
};

// 历史版本弹窗
const showRevisionsModal = ref(false);
const revisions = ref<any[]>([]);

const openRevisions = async () => {
  if (!projectDraft.value?.id) return;
  const res = await adminFetch(`/api/admin/projects/${projectDraft.value.id}/revisions`);
  if (!res.ok) {
    alert(formatAdminError({ message: '获取历史版本失败' }, '获取历史版本失败', res.status));
    return;
  }
  revisions.value = await res.json();
  showRevisionsModal.value = true;
};

const rollbackToRevision = async (revisionId: string) => {
  if (!projectDraft.value?.id) return;
  const ok = confirm('确认回滚到该版本？');
  if (!ok) return;
  const res = await adminFetch(`/api/admin/projects/${projectDraft.value.id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ revisionId })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(formatAdminError(json, '回滚失败', res.status));
    return;
  }
  projectDraft.value = normalizeProjectDraft(json);
  await fetchAdminProjects();
  showRevisionsModal.value = false;
};

// 审计日志弹窗
const showAuditModal = ref(false);
const auditPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 50, total: 0 });

const openAuditLogs = async () => {
  const res = await adminFetch('/api/admin/audit-logs?page=1&pageSize=50');
  if (!res.ok) {
    alert(formatAdminError({ message: '获取审计日志失败' }, '获取审计日志失败', res.status));
    return;
  }
  auditPage.value = await res.json();
  showAuditModal.value = true;
};
</script>

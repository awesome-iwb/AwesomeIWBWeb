<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
    
    <!-- Login Screen -->
    <div v-if="!isAuthenticated" class="min-h-screen flex items-center justify-center">
      <div class="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-2xl max-w-md w-full">
        <h1 class="text-3xl font-bold mb-6 text-center text-emerald-500">管理后台</h1>
        <p class="text-slate-500 mb-8 text-center">请输入管理员 API Token 进入运维后台</p>
        <input 
          type="password" 
          v-model="apiTokenInput"
          @keyup.enter="loginWithToken"
          placeholder="输入 API Token" 
          class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 mb-6 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
        <button 
          @click="loginWithToken" 
          class="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/30"
        >
          进入
        </button>
        <p class="text-xs text-slate-400 mt-4 text-center">Token 由后端环境变量配置，请联系管理员获取</p>
      </div>
    </div>

    <!-- Admin Dashboard -->
    <div v-else class="max-w-7xl mx-auto p-6">
      <header class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-extrabold flex items-center gap-3">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Awesome</span>
            后台管理
          </h1>
          <div class="flex gap-4 mt-4 flex-wrap">
            <button 
              @click="activeTab = 'stories'" 
              class="px-4 py-2 rounded-full font-bold transition-colors"
              :class="activeTab === 'stories' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'"
            >
              Today 文章编辑
            </button>
            <button 
              @click="activeTab = 'projects'" 
              class="px-4 py-2 rounded-full font-bold transition-colors"
              :class="activeTab === 'projects' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'"
            >
              软件项目管理
            </button>
            <button
              @click="activeTab = 'submissions'"
              class="px-4 py-2 rounded-full font-bold transition-colors"
              :class="activeTab === 'submissions' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'"
            >
              项目审核
            </button>
            <button
              @click="activeTab = 'moderation'"
              class="px-4 py-2 rounded-full font-bold transition-colors"
              :class="activeTab === 'moderation' ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'"
            >
              内容审核
            </button>
            <button
              @click="activeTab = 'feedback'"
              class="px-4 py-2 rounded-full font-bold transition-colors"
              :class="activeTab === 'feedback' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'"
            >
              评论与反馈
            </button>
            <button 
              @click="activeTab = 'users'" 
              class="px-4 py-2 rounded-full font-bold transition-colors"
              :class="activeTab === 'users' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'"
            >
              用户权限
            </button>
          </div>
        </div>
        <div class="flex gap-4">
          <button @click="router.push('/')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            返回首页
          </button>
          <button @click="logoutAdmin" class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">
            退出
          </button>
          <button v-if="activeTab === 'stories'" @click="saveStories" class="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
            <Save class="w-4 h-4" />
            {{ isSaving ? '保存中...' : '保存文章' }}
          </button>
          <button v-if="activeTab === 'projects'" @click="saveProjects" class="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
            <Save class="w-4 h-4" />
            {{ isSaving ? '保存中...' : '保存项目' }}
          </button>
          <button v-if="activeTab === 'projects' && projectDraft?.id" @click="deleteCurrentProject" class="px-6 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2">
            删除项目
          </button>
        </div>
      </header>

      <!-- Stories Tab -->
      <div v-if="activeTab === 'stories'" class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        <!-- Sidebar: List of stories -->
        <div class="lg:col-span-1 space-y-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="font-bold text-lg">文章列表</h2>
            <button @click="createNewStory" class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-200 transition-colors">
              <Plus class="w-4 h-4" />
            </button>
          </div>
          
          <div 
            v-for="(story, index) in stories" 
            :key="story.id"
            @click="selectStory(index)"
            class="p-4 rounded-2xl border cursor-pointer transition-all duration-200 group"
            :class="selectedIndex === index ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400'"
          >
            <h3 class="font-bold truncate" :class="selectedIndex === index ? 'text-white' : 'text-slate-900 dark:text-white'">{{ story.title || '未命名文章' }}</h3>
            <p class="text-sm truncate mt-1" :class="selectedIndex === index ? 'text-emerald-100' : 'text-slate-500'">{{ story.category }}</p>
          </div>
        </div>

        <!-- Editor Area -->
        <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" v-if="currentStory">
          
          <!-- Metadata Form -->
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-900/50">
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">文章大标题</label>
              <input type="text" v-model="currentStory.title" class="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" placeholder="例如：重新定义班级大屏" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">副标题</label>
              <input type="text" v-model="currentStory.subtitle" class="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" placeholder="例如：探索 ClassIsland 带来的智能灵动体验" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">分类标签</label>
              <input type="text" v-model="currentStory.category" class="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" placeholder="例如：编辑推荐" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">发布日期</label>
              <input type="text" v-model="currentStory.date" class="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" placeholder="例如：SATURDAY, APRIL 25" />
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
                <span>封面大图 (Banner)</span>
                <span class="text-emerald-500 text-xs cursor-pointer hover:underline" @click="triggerBannerUpload">上传新封面...</span>
                <input type="file" ref="bannerInput" @change="uploadBanner" class="hidden" accept="image/*" />
              </label>
              <div class="flex gap-4 items-center">
                <img v-if="currentStory.coverImage" :src="currentStory.coverImage" class="h-16 w-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                <input type="text" v-model="currentStory.coverImage" class="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500" placeholder="图片 URL 或上传" />
              </div>
            </div>
          </div>

          <!-- Markdown Editor Toolbar -->
          <div class="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button @click="insertText('**加粗**')" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="加粗"><Bold class="w-4 h-4" /></button>
            <button @click="insertText('*斜体*')" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="斜体"><Italic class="w-4 h-4" /></button>
            <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>
            <button @click="insertText('### 标题')" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="标题"><Heading class="w-4 h-4" /></button>
            <button @click="insertText('> 引用段落')" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="引用"><Quote class="w-4 h-4" /></button>
            <button @click="insertText('- 列表项')" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="列表"><List class="w-4 h-4" /></button>
            <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>
            <button @click="triggerImageUpload" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-sm font-bold" title="插入图片">
              <ImageIcon class="w-4 h-4" /> 上传插图
            </button>
            <input type="file" ref="imageInput" @change="uploadImageToMarkdown" class="hidden" accept="image/*" />
            
            <div class="ml-auto flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
              <button @click="viewMode = 'edit'" class="px-3 py-1 text-sm rounded-md transition-colors" :class="viewMode === 'edit' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'">编辑</button>
              <button @click="viewMode = 'split'" class="px-3 py-1 text-sm rounded-md transition-colors" :class="viewMode === 'split' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'">双栏</button>
              <button @click="viewMode = 'preview'" class="px-3 py-1 text-sm rounded-md transition-colors" :class="viewMode === 'preview' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'">预览</button>
            </div>
          </div>

          <!-- Editor Split Pane -->
          <div class="flex-1 flex min-h-[500px]">
            <!-- Textarea -->
            <div v-show="viewMode !== 'preview'" class="flex-1 border-r border-slate-100 dark:border-slate-700">
              <textarea 
                ref="markdownTextarea"
                v-model="currentStory.content" 
                class="w-full h-full p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed"
                placeholder="在这里使用 Markdown 语法撰写您的文章正文..."
              ></textarea>
            </div>
            
            <!-- Preview -->
            <div v-show="viewMode !== 'edit'" class="flex-1 bg-slate-50/50 dark:bg-slate-900/30 p-8 overflow-y-auto max-h-[600px] prose prose-slate dark:prose-invert max-w-none">
              <div v-html="renderedMarkdown"></div>
            </div>
          </div>
          
        </div>
        <div v-else class="col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
          <p class="text-slate-400">请在左侧选择一篇文章，或创建新文章</p>
        </div>
      </div>

      <!-- Projects Tab -->
      <div v-else-if="activeTab === 'projects'" class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center gap-2">
            <h2 class="font-bold text-lg">软件库</h2>
            <div class="flex items-center gap-2">
              <button @click="openCategoryManager" class="px-3 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                分类
              </button>
              <button @click="openAuditLogs" class="px-3 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                日志
              </button>
              <button @click="createNewProject" class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-200 transition-colors" title="添加新软件">
                <Plus class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
            <input v-model="projectQuery.q" @keyup.enter="fetchAdminProjects" type="text" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm" placeholder="搜索项目（名称/开发者/关键词）" />
            <select v-model="projectQuery.category" @change="projectQuery.page = 1; fetchAdminProjects()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm">
              <option value="">全部分类</option>
              <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <div class="flex gap-2">
              <button @click="projectQuery.page = 1; fetchAdminProjects()" class="flex-1 px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors">搜索</button>
              <button @click="resetProjectQuery" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">重置</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div
              v-for="p in projectsPage.items"
              :key="p.id || p.slug || p.name"
              @click="selectProject(p)"
              class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
              :class="selectedProjectId === p.id ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-blue-300'"
            >
              <img v-if="p.icon || p.avatar" :src="p.icon || p.avatar" class="w-8 h-8 rounded bg-white object-contain p-0.5" />
              <div v-else class="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">{{ (p.name || '?').charAt(0) }}</div>
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
            <button @click="exportJson" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导出 JSON</button>
            <button @click="exportCsv" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导出 CSV</button>
            <button @click="triggerImportJson" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导入 JSON</button>
            <button @click="triggerImportCsv" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">导入 CSV</button>
            <input ref="importJsonInput" type="file" class="hidden" accept="application/json" @change="importProjectsJson" />
            <input ref="importCsvInput" type="file" class="hidden" accept=".csv,text/csv" @change="importProjectsCsv" />
          </div>
        </div>

        <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px] overflow-y-auto" v-if="projectDraft">
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                正在编辑: <span class="text-blue-500">{{ projectDraft.name }}</span>
              </h2>
              <div v-if="projectDraft.slug" class="text-xs text-slate-500 dark:text-slate-400 mt-1">slug: {{ projectDraft.slug }}</div>
            </div>
            <button v-if="projectDraft.id" @click="openRevisions" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              历史版本
            </button>
          </div>

          <div class="p-8 grid grid-cols-2 gap-8">
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">软件名称</label>
              <input type="text" v-model="projectDraft.name" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">作者 / 开发者</label>
              <input type="text" v-model="projectDraft.developer" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" />
            </div>
            
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">一句话简介</label>
              <textarea v-model="projectDraft.description" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500 resize-none"></textarea>
            </div>

            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">状态</label>
              <input type="text" v-model="projectDraft.status" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" placeholder="例如：活跃 / 停更 / 维护中" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">AI 使用率标签</label>
              <select v-model="projectDraft.ai_usage_state" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500">
                <option value="unknown">未知（用户点击后转圈）</option>
                <option value="under50">未超过 50%</option>
                <option value="over50">超过 50%</option>
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">开源仓库 (Repository)</label>
              <input type="text" v-model="projectDraft.github_url" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" />
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                <span>关联开发者账号（平台）</span>
                <button @click="addPlatformDeveloper" type="button" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  添加
                </button>
              </label>
              <div class="space-y-2">
                <div v-for="(d, idx) in (projectDraft.platform_developers || [])" :key="idx" class="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/30">
                  <input v-model="d.username" type="text" placeholder="username（如 cjk_mkp）" class="sm:col-span-4 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:border-blue-500 text-sm" />
                  <button @click="removePlatformDeveloper(Number(idx))" type="button" class="sm:col-span-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                    删除
                  </button>
                </div>
                <div v-if="!(projectDraft.platform_developers || []).length" class="text-sm text-slate-400">
                  暂无关联账号
                </div>
              </div>
            </div>

            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">编程语言 (Language)</label>
              <input type="text" v-model="projectDraft.language" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Star 数量 (Stars)</label>
              <input type="number" v-model.number="projectDraft.stars" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" />
            </div>

            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">稳定性标签</label>
              <select v-model="projectDraft.recommendation" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500">
                <option value="">无</option>
                <option value="稳定">稳定</option>
                <option value="不稳定">不稳定</option>
                <option value="观望中">观望中</option>
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">编辑推荐</label>
              <select v-model="projectDraft.is_editors_choice" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500">
                <option :value="false">否</option>
                <option :value="true">是</option>
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">功能特性 (逗号分隔)</label>
              <input type="text" v-model="projectDraft.keywords" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500" placeholder="例如：白板, 批注, C#" />
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">所属分类</label>
              <select v-model="projectDraft.category_id" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-blue-500">
                <option :value="null">未分类</option>
                <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>

            <!-- Image Uploads for Project -->
            <div class="col-span-2 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
              <div class="grid grid-cols-2 gap-8">
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
                    <input type="text" v-model="projectDraft.icon" class="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm" placeholder="图标 URL" />
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
                    <input type="text" v-model="projectDraft.banner" class="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-sm" placeholder="横幅 URL" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
        <div v-else class="col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl h-[700px]">
          <p class="text-slate-400">请在左侧选择一个软件项目进行编辑</p>
        </div>
      </div>

      <!-- Submissions Tab -->
      <div v-else-if="activeTab === 'submissions'" class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <h2 class="font-bold text-lg">待审核</h2>
          </div>
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
            <input v-model="submissionQuery.q" @keyup.enter="fetchSubmissions" type="text" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm" placeholder="搜索（名称/GitHub）" />
            <button @click="submissionQuery.page = 1; fetchSubmissions()" class="w-full px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">刷新</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div
              v-for="s in submissionsPage.items"
              :key="s.id"
              @click="selectSubmission(s)"
              class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
              :class="selectedSubmissionId === s.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
            >
              <div class="font-bold text-sm truncate">
                <span v-if="s.payload?.kind === 'project_update'">变更：{{ s.payload?.project_name || '未命名' }}</span>
                <span v-else>{{ s.payload?.name || '未命名' }}</span>
              </div>
              <div class="text-xs opacity-80 truncate mt-1">
                <span v-if="s.payload?.kind === 'project_update'">{{ s.payload?.actor?.username ? `开发者：${s.payload.actor.username}` : '' }}</span>
                <span v-else>{{ s.payload?.github_url || '' }}</span>
              </div>
            </div>
            <div v-if="submissionsPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无待审核</div>
          </div>
          <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
            <button @click="prevSubmissionPage" :disabled="submissionsPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
            <div class="text-slate-500 dark:text-slate-300">{{ submissionsPage.page }} / {{ Math.max(1, Math.ceil(submissionsPage.total / submissionsPage.pageSize)) }}</div>
            <button @click="nextSubmissionPage" :disabled="submissionsPage.page >= Math.ceil(submissionsPage.total / submissionsPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
          </div>
        </div>

        <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px] overflow-y-auto" v-if="submissionDraft">
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 class="text-xl font-bold text-slate-800 dark:text-white">审核项目提交</h2>
          </div>
          <div v-if="submissionKind === 'project_update'" class="p-8 space-y-6">
            <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-2">目标项目</div>
              <div class="text-lg font-extrabold text-slate-900 dark:text-white">{{ submissionDraft.project_name }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">开发者：{{ submissionDraft.actor?.username || '-' }}</div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="space-y-2">
                <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">新简介</div>
                <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ submissionDraft.patch?.description || '' }}</div>
              </div>
              <div class="space-y-2">
                <div class="text-sm font-extrabold text-slate-700 dark:text-slate-300">新关键词</div>
                <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 whitespace-pre-wrap text-sm">{{ submissionDraft.patch?.keywords || '' }}</div>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">驳回原因（可选）</label>
              <textarea v-model="submissionReviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
              <button @click="approveSubmission" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过并应用</button>
              <button @click="rejectSubmission" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
            </div>
          </div>
          <div v-else class="p-8 grid grid-cols-2 gap-8">
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">项目名称</label>
              <input type="text" v-model="submissionDraft.name" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">开发者</label>
              <input type="text" v-model="submissionDraft.developer" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500" />
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">GitHub 仓库</label>
              <input type="text" v-model="submissionDraft.github_url" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500" />
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">简介</label>
              <textarea v-model="submissionDraft.description" rows="3" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">标签（逗号分隔）</label>
              <input type="text" v-model="submissionDraft.keywords" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500" />
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">推荐标签（逗号分隔）</label>
              <input type="text" v-model="submissionDraft.recommendation" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500" />
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">分类</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select v-model="submissionCategoryId" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500">
                  <option value="">选择现有分类</option>
                  <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <input v-model="submissionNewCategoryName" type="text" placeholder="或新建分类名称" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500" />
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-2">优先使用"选择现有分类"，若填写新分类名称则会自动创建。</div>
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">驳回原因（可选）</label>
              <textarea v-model="submissionReviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>
            <div class="col-span-2 flex flex-col sm:flex-row gap-3">
              <button @click="approveSubmission" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过并入库</button>
              <button @click="rejectSubmission" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
            </div>
          </div>
        </div>
        <div v-else class="col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl h-[700px]">
          <p class="text-slate-400">请在左侧选择一个待审核项目</p>
        </div>
      </div>

      <!-- Moderation Tab -->
      <div v-else-if="activeTab === 'moderation'" class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <h2 class="font-bold text-lg">内容审核队列</h2>
          </div>
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
            <div class="flex gap-2">
              <button
                @click="moderationKind = 'comment'"
                class="flex-1 px-3 py-2 rounded-xl text-sm font-bold transition-colors"
                :class="moderationKind === 'comment' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
              >
                评论
              </button>
              <button
                @click="moderationKind = 'bug'"
                class="flex-1 px-3 py-2 rounded-xl text-sm font-bold transition-colors"
                :class="moderationKind === 'bug' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
              >
                Bug反馈
              </button>
            </div>
            <select v-model="moderationStatus" @change="moderationQuery.page = 1; fetchModeration()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-amber-500 text-sm">
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已驳回</option>
            </select>
            <button @click="moderationQuery.page = 1; fetchModeration()" class="w-full px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors">刷新</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div
              v-for="m in moderationPage.items"
              :key="m.id"
              @click="selectModeration(m)"
              class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
              :class="selectedModerationId === m.id ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-amber-300'"
            >
              <div class="font-bold text-sm truncate">{{ moderationKind === 'comment' ? '评论' : m.title || 'Bug反馈' }}</div>
              <div class="text-xs opacity-80 truncate mt-1">{{ m.project_name }} · {{ m.actor_username }}</div>
              <div class="text-xs opacity-60 mt-1">{{ new Date(m.created_at).toLocaleString() }}</div>
            </div>
            <div v-if="moderationPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无数据</div>
          </div>
          <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
            <button @click="prevModerationPage" :disabled="moderationQuery.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
            <div class="text-slate-500 dark:text-slate-300">{{ moderationQuery.page }} / {{ Math.max(1, Math.ceil(moderationPage.total / moderationQuery.pageSize)) }}</div>
            <button @click="nextModerationPage" :disabled="moderationQuery.page >= Math.ceil(moderationPage.total / moderationQuery.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
          </div>
        </div>

        <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px] overflow-y-auto" v-if="moderationDraft">
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 class="text-xl font-bold text-slate-800 dark:text-white">审核{{ moderationKind === 'comment' ? '评论' : 'Bug反馈' }}</h2>
          </div>
          <div class="p-8 space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">项目</div>
                <div class="text-sm text-slate-900 dark:text-white">{{ moderationDraft.project_name }}</div>
              </div>
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">提交者</div>
                <div class="text-sm text-slate-900 dark:text-white">{{ moderationDraft.actor_username }} ({{ moderationDraft.actor_role }})</div>
              </div>
            </div>

            <div v-if="moderationKind === 'bug' && moderationDraft.title" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">标题</div>
              <div class="text-sm text-slate-900 dark:text-white">{{ moderationDraft.title }}</div>
            </div>

            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">内容</div>
              <div class="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{{ moderationDraft.body }}</div>
            </div>

            <div v-if="moderationKind === 'bug' && moderationDraft.labels?.length" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">标签</div>
              <div class="flex flex-wrap gap-2">
                <span v-for="label in moderationDraft.labels" :key="label" class="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 text-xs font-bold">{{ label }}</span>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">驳回原因（可选）</label>
              <textarea v-model="moderationReviewNote" rows="2" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:border-amber-500 resize-none"></textarea>
            </div>

            <div class="flex flex-col sm:flex-row gap-3" v-if="moderationDraft.status === 'pending'">
              <button @click="approveModeration" class="flex-1 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">通过</button>
              <button @click="rejectModeration" class="flex-1 px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">驳回</button>
            </div>
            <div v-else class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300">审核状态</div>
              <div class="text-sm mt-1" :class="moderationDraft.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                {{ moderationDraft.status === 'approved' ? '已通过' : '已驳回' }}
                <span v-if="moderationDraft.review_note"> - {{ moderationDraft.review_note }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl h-[700px]">
          <p class="text-slate-400">请在左侧选择一条待审核内容</p>
        </div>
      </div>

      <!-- Feedback Tab -->
      <div v-else-if="activeTab === 'feedback'" class="max-w-5xl mx-auto">
        <CommentPanel project-name="__admin__" variant="ops" initial-tab="bug" />
      </div>

      <!-- Users Tab -->
      <div v-else-if="activeTab === 'users'" class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <h2 class="font-bold text-lg">用户列表</h2>
          </div>
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
            <input v-model="userQuery.q" @keyup.enter="fetchUsers" type="text" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm" placeholder="搜索（用户名/邮箱/STCN ID）" />
            <select v-model="userQuery.role" @change="userQuery.page = 1; fetchUsers()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm">
              <option value="">全部角色</option>
              <option value="user">普通用户</option>
              <option value="dev">开发者</option>
              <option value="ops">运维</option>
            </select>
            <button @click="userQuery.page = 1; fetchUsers()" class="w-full px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">刷新</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div
              v-for="u in usersPage.items"
              :key="u.id"
              @click="selectUser(u)"
              class="p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3"
              :class="selectedUserId === u.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:border-emerald-300'"
            >
              <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold overflow-hidden">
                <img v-if="u.avatar_url" :src="u.avatar_url" class="w-full h-full object-cover" />
                <span v-else :class="selectedUserId === u.id ? 'text-white' : 'text-slate-500'">{{ (u.name || '?').charAt(0) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate text-sm">{{ u.name }}</div>
                <div class="text-xs opacity-80 truncate">{{ u.role }} {{ u.is_active ? '' : '(已禁用)' }}</div>
              </div>
            </div>
            <div v-if="usersPage.items.length === 0" class="text-sm text-slate-400 text-center py-10">暂无用户</div>
          </div>
          <div class="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
            <button @click="prevUserPage" :disabled="usersPage.page <= 1" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">上一页</button>
            <div class="text-slate-500 dark:text-slate-300">{{ usersPage.page }} / {{ Math.max(1, Math.ceil(usersPage.total / usersPage.pageSize)) }}</div>
            <button @click="nextUserPage" :disabled="usersPage.page >= Math.ceil(usersPage.total / usersPage.pageSize)" class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">下一页</button>
          </div>
        </div>

        <div class="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[700px] overflow-y-auto" v-if="userDraft">
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 class="text-xl font-bold text-slate-800 dark:text-white">用户详情</h2>
          </div>
          <div class="p-8 space-y-6">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <img v-if="userDraft.avatar_url" :src="userDraft.avatar_url" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-xl font-bold text-slate-500">{{ (userDraft.name || '?').charAt(0) }}</div>
              </div>
              <div>
                <div class="text-lg font-extrabold text-slate-900 dark:text-white">{{ userDraft.name }}</div>
                <div class="text-sm text-slate-500 dark:text-slate-400">{{ userDraft.email || '无邮箱' }}</div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">用户 ID</div>
                <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.id }}</div>
              </div>
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Casdoor ID</div>
                <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.casdoor_id || '-' }}</div>
              </div>
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">STCN 用户 ID</div>
                <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.stcn_user_id || '-' }}</div>
              </div>
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">SECTL 用户 ID</div>
                <div class="text-sm text-slate-900 dark:text-white font-mono">{{ userDraft.sectl_user_id || '-' }}</div>
              </div>
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">注册时间</div>
                <div class="text-sm text-slate-900 dark:text-white">{{ new Date(userDraft.created_at).toLocaleString() }}</div>
              </div>
              <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">最后登录</div>
                <div class="text-sm text-slate-900 dark:text-white">{{ userDraft.last_login_at ? new Date(userDraft.last_login_at).toLocaleString() : '从未登录' }}</div>
              </div>
            </div>

            <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-4">
              <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200">权限管理</div>
              
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-bold text-slate-700 dark:text-slate-300">当前角色</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">决定用户可以访问的功能</div>
                </div>
                <div class="flex gap-2">
                  <button 
                    @click="updateUserRole('user')"
                    class="px-4 py-2 rounded-xl font-bold transition-colors"
                    :class="userDraft.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'"
                  >
                    普通用户
                  </button>
                  <button 
                    @click="updateUserRole('dev')"
                    class="px-4 py-2 rounded-xl font-bold transition-colors"
                    :class="userDraft.role === 'dev' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'"
                  >
                    开发者
                  </button>
                  <button 
                    @click="updateUserRole('ops')"
                    class="px-4 py-2 rounded-xl font-bold transition-colors"
                    :class="userDraft.role === 'ops' ? 'bg-purple-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'"
                  >
                    运维
                  </button>
                </div>
              </div>

              <div class="h-px bg-slate-200 dark:bg-slate-700"></div>

              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-bold text-slate-700 dark:text-slate-300">账号状态</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">禁用后用户将无法登录</div>
                </div>
                <button 
                  @click="updateUserActive(!userDraft.is_active)"
                  class="px-4 py-2 rounded-xl font-bold transition-colors"
                  :class="userDraft.is_active ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'"
                >
                  {{ userDraft.is_active ? '已启用' : '已禁用' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="col-span-3 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl h-[700px]">
          <p class="text-slate-400">请在左侧选择一个用户进行管理</p>
        </div>
      </div>

      <!-- Category Manager Modal -->
      <div v-if="showCategoryManager" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div class="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div class="text-xl font-extrabold text-slate-900 dark:text-white">分类管理</div>
            <button @click="closeCategoryManager" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">关闭</button>
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

      <!-- Revisions Modal -->
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

      <!-- Audit Modal -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Save, Plus, Bold, Italic, Heading, Quote, List, Image as ImageIcon } from 'lucide-vue-next';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import CommentPanel from '../components/CommentPanel.vue';

const router = useRouter();
const md = new MarkdownIt({ html: true, breaks: true });

const isAuthenticated = ref(false);
const apiTokenInput = ref('');

const loginWithToken = () => {
  if (!apiTokenInput.value.trim()) {
    alert('请输入 API Token');
    return;
  }
  isAuthenticated.value = true;
  fetchData();
};

const logoutAdmin = () => {
  isAuthenticated.value = false;
  apiTokenInput.value = '';
};

const adminFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (apiTokenInput.value.trim()) {
    headers.set('Authorization', `Bearer ${apiTokenInput.value.trim()}`);
  }
  return fetch(url, { ...options, headers, credentials: 'include' });
};

// Check for saved token on mount — fetchData is defined below, call it after script init
const maybeRestoreSession = () => {
  return;
};

interface FeaturedStory {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  coverImage: string;
  date: string;
  projects: any[];
  theme: 'dark' | 'light';
  content: string;
}

const stories = ref<FeaturedStory[]>([]);
const selectedIndex = ref<number | null>(null);
const viewMode = ref<'edit' | 'split' | 'preview'>('split');
const isSaving = ref(false);

const activeTab = ref<'stories' | 'projects' | 'submissions' | 'moderation' | 'feedback' | 'users'>('stories');

const adminCategories = ref<any[]>([]);
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

const importJsonInput = ref<HTMLInputElement | null>(null);
const importCsvInput = ref<HTMLInputElement | null>(null);

const showCategoryManager = ref(false);
const categoryDrafts = ref<any[]>([]);
const newCategoryName = ref('');
const newCategoryDescription = ref('');

const showRevisionsModal = ref(false);
const revisions = ref<any[]>([]);
const showAuditModal = ref(false);
const auditPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({ items: [], page: 1, pageSize: 50, total: 0 });

const submissionsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0
});
const submissionQuery = ref<{ q: string; page: number; pageSize: number }>({ q: '', page: 1, pageSize: 20 });
const selectedSubmissionId = ref<string | null>(null);
const submissionDraft = ref<any | null>(null);
const submissionKind = ref<'new_project' | 'project_update'>('new_project');
const submissionReviewNote = ref('');
const submissionCategoryId = ref('');
const submissionNewCategoryName = ref('');

// Moderation tab
const moderationKind = ref<'comment' | 'bug'>('comment');
const moderationStatus = ref<'pending' | 'approved' | 'rejected'>('pending');
const moderationPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0
});
const moderationQuery = ref<{ page: number; pageSize: number }>({ page: 1, pageSize: 20 });
const selectedModerationId = ref<string | null>(null);
const moderationDraft = ref<any | null>(null);
const moderationReviewNote = ref('');

// Users tab
const usersPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0
});
const userQuery = ref<{ q: string; role: string; page: number; pageSize: number }>({ q: '', role: '', page: 1, pageSize: 20 });
const selectedUserId = ref<string | null>(null);
const userDraft = ref<any | null>(null);

const currentStory = computed(() => {
  if (selectedIndex.value === null) return null;
  return stories.value[selectedIndex.value];
});

const renderedMarkdown = computed(() => {
  if (!currentStory.value?.content) return '';
  return DOMPurify.sanitize(md.render(currentStory.value.content));
});

const fetchData = async () => {
  try {
    const [resStories] = await Promise.all([fetch('/api/stories')]);
    if (resStories.ok) {
      stories.value = await resStories.json();
      if (stories.value.length > 0) selectedIndex.value = 0;
    }

    await fetchAdminCategories();
    await fetchAdminProjects();
    await fetchSubmissions();
    await fetchModeration();
    await fetchUsers();
  } catch (e) {
    console.error('获取数据失败', e);
  }
};

const saveProjects = async () => {
  isSaving.value = true;
  try {
    if (!projectDraft.value) {
      alert('请先选择一个项目');
      return;
    }
    const p: any = { ...projectDraft.value };
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
      if (!res.ok) throw new Error(json?.error ?? 'save failed');
      projectDraft.value = normalizeProjectDraft(json);
    } else {
      const res = await adminFetch('/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(p)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'create failed');
      projectDraft.value = normalizeProjectDraft(json);
    }
    await fetchAdminProjects();
    alert('项目保存成功！');
  } catch (e) {
    alert('项目保存失败');
  } finally {
    isSaving.value = false;
  }
};

const saveStories = async () => {
  isSaving.value = true;
  try {
    await adminFetch('/api/stories', {
      method: 'POST',
      body: JSON.stringify(stories.value)
    });
    alert('保存成功！');
  } catch (e) {
    alert('保存失败');
  } finally {
    isSaving.value = false;
  }
};

const selectStory = (index: number) => {
  selectedIndex.value = index;
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
};

const createNewStory = () => {
  stories.value.push({
    id: 'feature-' + Date.now(),
    title: '全新推荐文章',
    subtitle: '副标题...',
    category: 'Editors\' Choice',
    coverImage: '',
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(),
    projects: [],
    theme: 'dark',
    content: '# 在这里输入大标题\n\n写点什么...'
  });
  selectedIndex.value = stories.value.length - 1;
};

// --- 图片上传逻辑 ---
const bannerInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const markdownTextarea = ref<HTMLTextAreaElement | null>(null);

const projectIconInput = ref<HTMLInputElement | null>(null);
const projectBannerInput = ref<HTMLInputElement | null>(null);

const triggerBannerUpload = () => bannerInput.value?.click();
const triggerImageUpload = () => imageInput.value?.click();
const triggerProjectIconUpload = () => projectIconInput.value?.click();
const triggerProjectBannerUpload = () => projectBannerInput.value?.click();

const uploadFile = async (file: File): Promise<string | null> => {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await adminFetch('/api/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
  } catch (e) {
    console.error('上传失败', e);
  }
  return null;
};

const uploadBanner = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !currentStory.value) return;
  const url = await uploadFile(file);
  if (url) {
    currentStory.value.coverImage = url;
  } else {
    alert('封面上传失败');
  }
};

const uploadProjectIcon = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !projectDraft.value) return;
  const url = await uploadFile(file);
  if (url) {
    projectDraft.value.icon = url;
  } else {
    alert('图标上传失败');
  }
};

const uploadProjectBanner = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !projectDraft.value) return;
  const url = await uploadFile(file);
  if (url) {
    projectDraft.value.banner = url;
  } else {
    alert('横幅上传失败');
  }
};

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
      sectl_user_id: typeof d?.sectl_user_id === 'string' ? d.sectl_user_id : '',
      lincube_user_id: typeof d?.lincube_user_id === 'string' ? d.lincube_user_id : ''
    };
  });
  if (clone.ai_usage_state !== 'unknown' && clone.ai_usage_state !== 'over50' && clone.ai_usage_state !== 'under50') {
    clone.ai_usage_state = 'unknown';
  }
  return clone;
};

const addPlatformDeveloper = () => {
  if (!projectDraft.value) return;
  if (!Array.isArray(projectDraft.value.platform_developers)) projectDraft.value.platform_developers = [];
  projectDraft.value.platform_developers.push({ username: '', stcn_user_id: '', sectl_user_id: '', lincube_user_id: '' });
};

const removePlatformDeveloper = (idx: number) => {
  if (!projectDraft.value) return;
  if (!Array.isArray(projectDraft.value.platform_developers)) return;
  projectDraft.value.platform_developers.splice(idx, 1);
};

const fetchAdminCategories = async () => {
  try {
    const res = await adminFetch('/api/admin/categories');
    if (res.ok) {
      adminCategories.value = await res.json();
      return;
    }
  } catch {}

  try {
    const res = await fetch('/api/categories');
    if (res.ok) adminCategories.value = await res.json();
  } catch {}
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
    const res = await fetch('/api/projects');
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
    if (!res.ok) throw new Error(json?.error ?? 'import failed');
    alert(`导入完成：created=${json.created} updated=${json.updated}`);
    await fetchAdminCategories();
    await fetchAdminProjects();
  } catch (err: any) {
    alert(err?.message ?? '导入失败');
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
    if (!res.ok) throw new Error(json?.error ?? 'import failed');
    alert(`导入完成：created=${json.created} updated=${json.updated} skipped=${json.skipped}`);
    await fetchAdminCategories();
    await fetchAdminProjects();
  } catch (err: any) {
    alert(err?.message ?? '导入失败');
  } finally {
    if (importCsvInput.value) importCsvInput.value.value = '';
  }
};

const deleteCurrentProject = async () => {
  if (!projectDraft.value?.id) return;
  const ok = confirm(`确认删除项目：${projectDraft.value.name}？`);
  if (!ok) return;
  isSaving.value = true;
  try {
    const res = await adminFetch(`/api/admin/projects/${projectDraft.value.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    projectDraft.value = null;
    selectedProjectId.value = null;
    await fetchAdminProjects();
    alert('删除成功');
  } catch {
    alert('删除失败');
  } finally {
    isSaving.value = false;
  }
};

const openCategoryManager = () => {
  categoryDrafts.value = adminCategories.value.map((c) => ({ ...c }));
  newCategoryName.value = '';
  newCategoryDescription.value = '';
  showCategoryManager.value = true;
};

const closeCategoryManager = () => {
  showCategoryManager.value = false;
};

const createCategory = async () => {
  if (!newCategoryName.value.trim()) return;
  const res = await adminFetch('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name: newCategoryName.value.trim(), description: newCategoryDescription.value })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '创建失败');
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
    alert(json?.error ?? '保存失败');
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
    alert(json?.error ?? '删除失败');
    return;
  }
  await fetchAdminCategories();
  openCategoryManager();
};

const openRevisions = async () => {
  if (!projectDraft.value?.id) return;
  const res = await adminFetch(`/api/admin/projects/${projectDraft.value.id}/revisions`);
  if (!res.ok) {
    alert('获取历史版本失败');
    return;
  }
  revisions.value = await res.json();
  showRevisionsModal.value = true;
};

const openAuditLogs = async () => {
  const res = await adminFetch('/api/admin/audit-logs?page=1&pageSize=50');
  if (!res.ok) {
    alert('获取审计日志失败');
    return;
  }
  auditPage.value = await res.json();
  showAuditModal.value = true;
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
    alert(json?.error ?? '回滚失败');
    return;
  }
  projectDraft.value = normalizeProjectDraft(json);
  await fetchAdminProjects();
  showRevisionsModal.value = false;
};

const fetchSubmissions = async () => {
  try {
    const qs = new URLSearchParams();
    if (submissionQuery.value.q) qs.set('q', submissionQuery.value.q);
    qs.set('status', 'pending');
    qs.set('page', String(submissionQuery.value.page));
    qs.set('pageSize', String(submissionQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/submissions?${qs.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    submissionsPage.value = json;
  } catch {}
};

const selectSubmission = (s: any) => {
  selectedSubmissionId.value = s.id;
  const payload = s.payload ?? {};
  if (payload.kind === 'project_update') {
    submissionKind.value = 'project_update';
    submissionDraft.value = {
      kind: 'project_update',
      project_name: payload.project_name ?? '',
      patch: payload.patch ?? {},
      actor: payload.actor ?? {}
    };
    submissionReviewNote.value = '';
    submissionCategoryId.value = '';
    submissionNewCategoryName.value = '';
    return;
  }
  submissionKind.value = 'new_project';
  submissionDraft.value = normalizeProjectDraft({
    name: payload.name ?? '',
    developer: payload.developer ?? '',
    github_url: payload.github_url ?? payload.githubUrl ?? '',
    description: payload.description ?? '',
    keywords: payload.keywords ?? payload.tags ?? '',
    recommendation: payload.recommendation ?? '',
    status: payload.status ?? '',
    language: payload.language ?? '',
    stars: payload.stars ?? 0,
    icon: payload.icon ?? '',
    banner: payload.banner ?? ''
  });
  submissionReviewNote.value = '';
  submissionCategoryId.value = '';
  submissionNewCategoryName.value = typeof payload.category === 'string' ? payload.category : '';
};

const approveSubmission = async () => {
  if (!selectedSubmissionId.value || !submissionDraft.value) return;
  if (submissionKind.value === 'project_update') {
    const res = await adminFetch(`/api/admin/submissions/${selectedSubmissionId.value}/approve`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? '审核失败');
      return;
    }
    alert('已通过并应用变更');
    submissionDraft.value = null;
    selectedSubmissionId.value = null;
    await fetchAdminProjects();
    await fetchSubmissions();
    activeTab.value = 'projects';
    return;
  }
  const toList = (v: any) => {
    if (Array.isArray(v)) return v;
    if (typeof v !== 'string') return [];
    return v.split(/[,，;]/).map((x) => x.trim()).filter(Boolean);
  };
  const p: any = { ...submissionDraft.value };
  p.keywords = toList(p.keywords);
  p.recommendation = toList(p.recommendation);

  const body: any = { project: p };
  if (submissionNewCategoryName.value.trim()) body.category_name = submissionNewCategoryName.value.trim();
  else if (submissionCategoryId.value) body.category_id = submissionCategoryId.value;

  const res = await adminFetch(`/api/admin/submissions/${selectedSubmissionId.value}/approve`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '审核失败');
    return;
  }
  alert('已通过并入库');
  submissionDraft.value = null;
  selectedSubmissionId.value = null;
  await fetchAdminCategories();
  await fetchAdminProjects();
  await fetchSubmissions();
  activeTab.value = 'projects';
};

const rejectSubmission = async () => {
  if (!selectedSubmissionId.value) return;
  const res = await adminFetch(`/api/admin/submissions/${selectedSubmissionId.value}/reject`, {
    method: 'POST',
    body: JSON.stringify({ review_note: submissionReviewNote.value })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '驳回失败');
    return;
  }
  alert('已驳回');
  submissionDraft.value = null;
  selectedSubmissionId.value = null;
  await fetchSubmissions();
};

const prevSubmissionPage = async () => {
  if (submissionsPage.value.page <= 1) return;
  submissionQuery.value.page -= 1;
  await fetchSubmissions();
};

const nextSubmissionPage = async () => {
  const maxPage = Math.max(1, Math.ceil(submissionsPage.value.total / submissionsPage.value.pageSize));
  if (submissionsPage.value.page >= maxPage) return;
  submissionQuery.value.page += 1;
  await fetchSubmissions();
};

// Moderation management
const fetchModeration = async () => {
  try {
    const qs = new URLSearchParams();
    qs.set('status', moderationStatus.value);
    qs.set('page', String(moderationQuery.value.page));
    qs.set('pageSize', String(moderationQuery.value.pageSize));
    const endpoint = moderationKind.value === 'comment'
      ? `/api/admin/moderation/comments?${qs.toString()}`
      : `/api/admin/moderation/bugs?${qs.toString()}`;
    const res = await adminFetch(endpoint);
    if (!res.ok) return;
    const json = await res.json();
    moderationPage.value = json;
  } catch {}
};

const selectModeration = (m: any) => {
  selectedModerationId.value = m.id;
  moderationDraft.value = { ...m };
  moderationReviewNote.value = '';
};

const approveModeration = async () => {
  if (!selectedModerationId.value || !moderationDraft.value) return;
  const endpoint = moderationKind.value === 'comment'
    ? `/api/admin/moderation/comments/${selectedModerationId.value}/approve`
    : `/api/admin/moderation/bugs/${selectedModerationId.value}/approve`;
  const res = await adminFetch(endpoint, { method: 'POST', body: JSON.stringify({}) });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '审核失败');
    return;
  }
  alert('已通过');
  moderationDraft.value = null;
  selectedModerationId.value = null;
  await fetchModeration();
};

const rejectModeration = async () => {
  if (!selectedModerationId.value) return;
  const endpoint = moderationKind.value === 'comment'
    ? `/api/admin/moderation/comments/${selectedModerationId.value}/reject`
    : `/api/admin/moderation/bugs/${selectedModerationId.value}/reject`;
  const res = await adminFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ review_note: moderationReviewNote.value })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '驳回失败');
    return;
  }
  alert('已驳回');
  moderationDraft.value = null;
  selectedModerationId.value = null;
  await fetchModeration();
};

const prevModerationPage = async () => {
  if (moderationQuery.value.page <= 1) return;
  moderationQuery.value.page -= 1;
  await fetchModeration();
};

const nextModerationPage = async () => {
  const maxPage = Math.max(1, Math.ceil(moderationPage.value.total / moderationPage.value.pageSize));
  if (moderationQuery.value.page >= maxPage) return;
  moderationQuery.value.page += 1;
  await fetchModeration();
};

watch(moderationKind, () => {
  moderationQuery.value.page = 1;
  selectedModerationId.value = null;
  moderationDraft.value = null;
  fetchModeration();
});

const uploadImageToMarkdown = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const url = await uploadFile(file);
  if (url) {
    insertText(`\n![图片描述](${url})\n`);
  } else {
    alert('图片上传失败');
  }
};

const insertText = (text: string) => {
  if (!currentStory.value || !markdownTextarea.value) return;
  
  const start = markdownTextarea.value.selectionStart;
  const end = markdownTextarea.value.selectionEnd;
  const currentContent = currentStory.value.content;
  
  currentStory.value.content = 
    currentContent.substring(0, start) + 
    text + 
    currentContent.substring(end);
    
  setTimeout(() => {
    if (markdownTextarea.value) {
      markdownTextarea.value.focus();
      markdownTextarea.value.selectionStart = start + text.length;
      markdownTextarea.value.selectionEnd = start + text.length;
    }
  }, 10);
};

// Users management
const fetchUsers = async () => {
  try {
    const qs = new URLSearchParams();
    if (userQuery.value.q) qs.set('q', userQuery.value.q);
    if (userQuery.value.role) qs.set('role', userQuery.value.role);
    qs.set('page', String(userQuery.value.page));
    qs.set('pageSize', String(userQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/users?${qs.toString()}`);
    if (!res.ok) return;
    const json = await res.json();
    usersPage.value = json;
  } catch {}
};

const selectUser = (u: any) => {
  selectedUserId.value = u.id;
  userDraft.value = { ...u };
};

const prevUserPage = async () => {
  if (usersPage.value.page <= 1) return;
  userQuery.value.page -= 1;
  await fetchUsers();
};

const nextUserPage = async () => {
  const maxPage = Math.max(1, Math.ceil(usersPage.value.total / usersPage.value.pageSize));
  if (usersPage.value.page >= maxPage) return;
  userQuery.value.page += 1;
  await fetchUsers();
};

const updateUserRole = async (role: string) => {
  if (!userDraft.value?.id) return;
  const res = await adminFetch(`/api/admin/users/${userDraft.value.id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '更新失败');
    return;
  }
  userDraft.value = { ...userDraft.value, role };
  await fetchUsers();
  alert('角色更新成功');
};

const updateUserActive = async (isActive: boolean) => {
  if (!userDraft.value?.id) return;
  const res = await adminFetch(`/api/admin/users/${userDraft.value.id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive })
  });
  const json = await res.json();
  if (!res.ok) {
    alert(json?.error ?? '更新失败');
    return;
  }
  userDraft.value = { ...userDraft.value, is_active: isActive };
  await fetchUsers();
  alert(isActive ? '账号已启用' : '账号已禁用');
};

// Restore session on mount
maybeRestoreSession();
</script>

<style scoped>
.prose img {
  border-radius: 1rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  margin: 2rem 0;
}
</style>

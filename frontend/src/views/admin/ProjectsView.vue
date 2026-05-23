<template>
  <div class="h-full min-h-0">
  <ui-ListDetailLayout
    :selected-id="selectedProjectId"
    :selected-item-label="projectDraft?.name"
    :selected-item-icon="Package"
    :searchable="false"
    :infinite="true"
    :has-more="projectsHasMore"
    :loading-more="projectsLoadingMore"
    list-title="项目列表"
    detail-title="项目详情"
    @load-more="loadMoreProjects"
    @back="selectedProjectId = null, projectDraft = null"
  >
    <template #detail>
      <div v-if="projectDraft" class="bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-3xl border border-white/70 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden flex flex-col h-full min-h-0">
        <div class="p-4 lg:p-6 border-b border-border bg-accent/50 dark:bg-slate-900/50 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div class="min-w-0 w-full lg:w-auto lg:flex-1">
            <h2 class="text-lg lg:text-xl font-bold text-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-left">
              正在编辑: <span class="text-emerald-500 break-words">{{ projectDraft.name }}</span>
            </h2>
            <div v-if="projectDraft.slug" class="text-xs text-muted-foreground mt-1 break-all text-left">slug: {{ projectDraft.slug }}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:flex-nowrap lg:justify-end lg:shrink-0">
            <button v-if="projectDraft.id" @click="openRevisions" type="button" class="shrink-0 px-4 py-3 lg:py-2 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-accent transition-colors whitespace-normal text-center min-h-[44px]">
              历史版本
            </button>
            <button @click="saveProjects" type="button" class="shrink-0 px-4 py-3 lg:py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all inline-flex flex-row flex-nowrap items-center justify-center gap-2 whitespace-normal text-left min-h-[44px]">
              <Save class="w-4 h-4 shrink-0" />
              <span>{{ isSaving ? '保存中...' : '保存项目' }}</span>
            </button>
            <button v-if="projectDraft.id" @click="deleteCurrentProject" type="button" class="shrink-0 px-4 py-3 lg:py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold shadow-lg shadow-rose-500/20 transition-all inline-flex flex-row flex-nowrap items-center justify-center gap-2 whitespace-normal text-left min-h-[44px]">
              删除项目
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 p-4 lg:p-8 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8 overflow-y-auto">
          <div class="lg:col-span-1 space-y-5">
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">软件名称</label>
              <input type="text" v-model="projectDraft.name" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">作者 / 开发者</label>
              <SearchSelect
                :key="`dev-user-${selectedProjectId || 'new'}`"
                v-model="projectDraft.developer_user_id"
                :search-fn="searchUsers"
                placeholder="至少输入 1 个字符搜索用户"
                :initial-label="projectDraft.developer_user_name || projectDraft.developer || ''"
                @update:model-value="onDeveloperSelect"
              />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">所属组织</label>
              <SearchSelect
                :key="`org-${selectedProjectId || 'new'}`"
                v-model="projectDraft.organization_id"
                :search-fn="searchOrganizations"
                placeholder="至少输入 1 个字符搜索组织"
                :initial-label="projectDraft.organization_name || ''"
                @update:model-value="(val) => onOrgSelect(val)"
              />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">一句话简介</label>
              <textarea v-model="projectDraft.description" rows="2" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 resize-none text-base"></textarea>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">状态</label>
              <input type="text" v-model="projectDraft.status" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" placeholder="例如：活跃 / 停更 / 维护中" />
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">开源仓库 (Repository)</label>
              <input type="text" v-model="projectDraft.github_url" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
            </div>
          </div>

          <div class="lg:col-span-1 space-y-5">
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">AI 使用率标签</label>
              <select v-model="projectDraft.ai_usage_state" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base">
                <option value="unknown">未知（用户点击后转圈）</option>
                <option value="under50">未超过 50%</option>
                <option value="over50">超过 50%</option>
              </select>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">编辑推荐</label>
              <select v-model="projectDraft.is_editors_choice" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base">
                <option :value="false">否</option>
                <option :value="true">是</option>
              </select>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">功能特性 (逗号分隔)</label>
              <input type="text" v-model="projectDraft.keywords" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" placeholder="例如：白板, 批注, C#" />
              <button
                v-if="projectDraft.id"
                type="button"
                class="mt-2 text-xs font-bold text-emerald-600 hover:underline"
                @click="recommendTagsFromKeywords"
              >
                从关键词推荐 feature 标签
              </button>
            </div>
            <div class="lg:col-span-1">
              <label class="block text-sm font-bold text-muted-foreground mb-2">所属分类</label>
              <select v-model="projectDraft.category_id" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base">
                <option :value="null">未分类</option>
                <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>

          <div class="lg:col-span-2 space-y-5">
            <ProjectMediaFields v-model:icon="projectDraft.icon" v-model:banner="projectDraft.banner" />
          </div>

          <div class="lg:col-span-2 space-y-5">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-bold text-muted-foreground mb-2">编程语言 (Language)</label>
                <input type="text" v-model="projectDraft.language" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
              </div>
              <div>
                <label class="block text-sm font-bold text-muted-foreground mb-2">Star 数量 (Stars)</label>
                <input type="number" v-model.number="projectDraft.stars" class="w-full px-4 py-3.5 lg:py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-bold text-muted-foreground mb-2 flex items-center justify-between">
                <span>关联开发者账号（平台）</span>
                <button @click="addPlatformDeveloper" type="button" class="px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-extrabold hover:bg-accent transition-colors min-h-[36px]">
                  添加
                </button>
              </label>
              <div class="space-y-3">
                <div v-for="(d, idx) in (projectDraft.platform_developers || [])" :key="idx" class="grid grid-cols-1 lg:grid-cols-5 gap-3 p-3 rounded-2xl border border-border bg-white/70 dark:bg-slate-900/30">
                  <input v-model="d.username" type="text" placeholder="username（如 cjk_mkp）" class="lg:col-span-4 px-3 py-3.5 lg:py-2 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-base" />
                  <button @click="removePlatformDeveloper(Number(idx))" type="button" class="lg:col-span-1 px-3 py-3.5 lg:py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors min-h-[48px] lg:min-h-0">
                    删除
                  </button>
                </div>
                <div v-if="!(projectDraft.platform_developers || []).length" class="text-sm text-slate-400">
                  暂无关联账号
                </div>
              </div>
            </div>

            <Card class="shadow-[var(--shadow-card)] rounded-[var(--radius-sm-g2)]">
              <CardHeader class="px-4 py-3 border-b border-[var(--color-border-light)] dark:border-slate-700">
                <CardTitle class="font-bold text-sm text-muted-foreground">标签与展示</CardTitle>
              </CardHeader>
              <CardContent class="p-4 space-y-5">
                <div v-if="!projectDraft.id" class="text-sm text-muted-foreground">保存项目后可关联画廊标签</div>
                <template v-else>
                  <div class="space-y-2">
                    <h4 class="text-xs font-bold text-muted-foreground uppercase">预制系统标签（只读预览）</h4>
                    <p class="text-xs text-muted-foreground">由下方状态、版本、语言、Stars 等字段与 GitHub 同步生成，显示在列表卡片与详情头。</p>
                    <div class="space-y-2">
                      <span class="text-[10px] text-muted-foreground">列表卡片</span>
                      <ProjectTagRow :tags="fullTagPreview.card" />
                    </div>
                    <div class="space-y-2">
                      <span class="text-[10px] text-muted-foreground">详情头</span>
                      <ProjectTagRow :tags="fullTagPreview.header" size="md" />
                    </div>
                  </div>

                  <div class="border-t border-border pt-4 space-y-3">
                    <h4 class="text-xs font-bold text-muted-foreground uppercase">自定义画廊标签</h4>
                    <input
                      v-model="tagPickerQuery"
                      type="text"
                      placeholder="筛选标签…"
                      class="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm"
                    />
                    <div class="flex flex-wrap gap-2 items-end p-3 rounded-xl border border-dashed border-border bg-card/50">
                      <div class="flex-1 min-w-[120px]">
                        <label class="text-xs font-bold text-muted-foreground">快速新建</label>
                        <input v-model="quickTagLabel" type="text" placeholder="标签名称" class="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-sm" />
                      </div>
                      <div class="w-32">
                        <label class="text-xs font-bold text-muted-foreground">分组</label>
                        <select v-model="quickTagGroup" class="w-full mt-1 px-2 py-2 rounded-lg border border-border bg-card text-sm">
                          <option value="feature">功能特性</option>
                          <option value="state">状态与运营</option>
                          <option value="release">版本与发布</option>
                          <option value="community">作者与贡献</option>
                          <option value="custom">其他</option>
                        </select>
                      </div>
                      <button type="button" class="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold" @click="createQuickTag">新建并选中</button>
                    </div>
                    <div v-for="g in filteredTagGroups" :key="g.key" class="space-y-2">
                      <h4 class="text-xs font-bold text-muted-foreground uppercase">{{ g.label }}</h4>
                      <div class="flex flex-wrap gap-2">
                        <label
                          v-for="t in g.items"
                          :key="t.id"
                          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-pointer"
                          :class="projectTagIds.includes(t.id) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-border'"
                        >
                          <input v-model="projectTagIds" type="checkbox" class="sr-only" :value="t.id" />
                          {{ t.label }}
                        </label>
                      </div>
                    </div>
                    <p class="text-xs text-muted-foreground">保存项目时将一并保存标签关联。</p>
                  </div>

                  <div class="border-t border-border pt-4 space-y-2">
                    <span class="text-[10px] text-muted-foreground">标签画廊预览</span>
                    <ProjectTagGallery :gallery="tagPreview.gallery" />
                  </div>
                </template>
              </CardContent>
            </Card>

            <Card class="shadow-[var(--shadow-card)] rounded-[var(--radius-sm-g2)]">
              <CardHeader class="px-4 py-3 border-b border-[var(--color-border-light)] dark:border-slate-700">
                <div class="flex items-center justify-between">
                  <CardTitle class="font-bold text-sm text-muted-foreground">项目成员</CardTitle>
                  <button @click="showAddMember = true" class="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors min-h-[36px]">添加成员</button>
                </div>
              </CardHeader>
              <CardContent class="p-4">
                <div class="space-y-3">
                  <div v-if="projectMembers.length === 0" class="text-sm text-slate-400 text-center py-4">暂无成员</div>
                  <div v-for="m in projectMembers" :key="memberRowKey(m)" class="flex items-center gap-3 p-3.5 lg:p-3 rounded-xl bg-card/50 min-h-[56px]">
                    <img v-if="memberAvatarUrl(m)" :src="memberAvatarUrl(m)" class="w-9 h-9 lg:w-8 lg:h-8 rounded-full object-cover" />
                    <div v-else class="w-9 h-9 lg:w-8 lg:h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">{{ (m.user_name || m.user_id || '?')[0].toUpperCase() }}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-bold text-foreground truncate">{{ m.user_name || m.user_id }}</div>
                      <div class="text-xs text-slate-500">{{ m.org_name || '' }}</div>
                    </div>
                    <span class="px-2 py-1 rounded text-xs font-bold" :class="m.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'">{{ m.role === 'owner' ? '负责人' : '协作者' }}</span>
                    <div v-if="m.user_id" class="flex items-center gap-2 shrink-0">
                      <button
                        v-if="m.role !== 'owner'"
                        type="button"
                        class="text-xs text-amber-600 hover:underline px-2 py-1.5 min-h-[32px]"
                        @click="promoteToOwner(m)"
                      >
                        设为负责人
                      </button>
                      <button v-if="m.role !== 'owner'" type="button" class="text-xs text-rose-500 hover:underline px-2 py-1.5 min-h-[32px]" @click="removeMember(m)">移除</button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </template>

    <template #empty-detail>
      <div class="h-full min-h-0 flex items-center justify-center border-2 border-dashed border-border rounded-3xl bg-white/50 dark:bg-slate-900/35 backdrop-blur-sm">
        <div class="text-center">
          <p class="text-slate-400 mb-2">从列表选择项目</p>
        </div>
      </div>
    </template>

    <template #list-toolbar>
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <button @click="showCategoryManager = true; openCategoryManager()" class="px-3 py-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[40px]">
            分类
          </button>
          <button @click="showTagLibrary = true" class="px-3 py-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[40px]">
            标签库
          </button>
          <button @click="openAuditLogs" class="px-3 py-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[40px]">
            日志
          </button>
          <div class="flex-1"></div>
          <button @click="createNewProject" class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-blue-200 transition-colors" title="添加新软件">
            <Plus class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-2">
          <input v-model="projectQuery.q" @keyup.enter="resetAndFetchProjects" type="text" class="w-full px-3 py-3 lg:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-sm min-h-[48px]" placeholder="搜索项目（名称/开发者/关键词）" />
          <select v-model="projectQuery.category" @change="resetAndFetchProjects" class="w-full px-3 py-3 lg:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-sm min-h-[48px]">
            <option value="">全部分类</option>
            <option v-for="c in adminCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select v-model="projectQuery.tag_id" @change="resetAndFetchProjects" class="w-full px-3 py-3 lg:py-2.5 rounded-xl border border-border bg-card outline-none focus:border-emerald-500 text-sm min-h-[48px]">
            <option value="">全部标签</option>
            <option v-for="t in allRegistryTags" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
          <div class="flex gap-2">
            <button @click="resetAndFetchProjects" class="flex-1 px-3 py-3 lg:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors min-h-[48px]">搜索</button>
            <button @click="resetProjectQuery" class="px-3 py-3 lg:py-2.5 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[48px]">重置</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <button @click="exportJson" class="px-3 py-3 lg:py-2 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[44px]">导出 JSON</button>
          <button @click="exportCsv" class="px-3 py-3 lg:py-2 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[44px]">导出 CSV</button>
          <button @click="triggerImportJson" class="px-3 py-3 lg:py-2 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[44px]">导入 JSON</button>
          <button @click="triggerImportCsv" class="px-3 py-3 lg:py-2 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-accent transition-colors min-h-[44px]">导入 CSV</button>
          <input ref="importJsonInput" type="file" class="hidden" accept="application/json" @change="importProjectsJson" />
          <input ref="importCsvInput" type="file" class="hidden" accept=".csv,text/csv" @change="importProjectsCsv" />
        </div>
      </div>
    </template>

    <template #list>
      <div class="space-y-2">
          <div
            v-for="p in projectsPage.items"
            :key="p.id || p.slug || p.name"
            @click="selectProject(p)"
            class="p-3.5 lg:p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3 min-h-[64px]"
            :class="selectedProjectId === p.id ? 'bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 border-l-[3px] border-l-[var(--color-brand-500)] border-y border-r border-transparent' : 'bg-card/50 border-transparent hover:bg-accent/80'"
          >
            <img v-if="p.icon" :src="p.icon" class="w-10 h-10 lg:w-8 lg:h-8 rounded bg-white object-contain p-0.5" />
            <div v-else class="w-10 h-10 lg:w-8 lg:h-8 rounded bg-muted flex items-center justify-center text-sm lg:text-xs font-bold text-slate-500">{{ (p.name || '?').charAt(0) }}</div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-base lg:text-sm truncate text-foreground">{{ p.name }}</div>
              <div class="text-sm lg:text-xs text-muted-foreground truncate mt-0.5">{{ p.developer }}</div>
              <div class="flex flex-wrap items-center gap-1 mt-1">
                <span v-if="p.status" class="text-[10px] text-muted-foreground">{{ p.status }}</span>
                <span
                  v-for="t in (p.registry_tags || []).slice(0, 3)"
                  :key="t.id"
                  class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                >{{ t.label }}</span>
                <span v-if="(p.registry_tags?.length ?? 0) > 3" class="text-[10px] text-muted-foreground">+{{ p.registry_tags.length - 3 }}</span>
              </div>
            </div>
          </div>
          <ui-EmptyState v-if="projectsPage.items.length === 0" :icon="Inbox" title="暂无数据" />
      </div>
    </template>
  </ui-ListDetailLayout>
  </div>

  <ProjectTagLibraryDialog v-model:open="showTagLibrary" @updated="onTagLibraryUpdated" @filter-by-tag="onFilterByTag" />

  <Dialog v-model:open="showCategoryManager">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>分类管理</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input v-model="newCategoryName" type="text" placeholder="新分类名称" class="sm:col-span-1 px-4 py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500" />
          <input v-model="newCategoryDescription" type="text" placeholder="描述（可选）" class="sm:col-span-2 px-4 py-3 rounded-xl border border-border bg-card outline-none focus:border-emerald-500" />
        </div>
        <button @click="createCategory" class="w-full px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">创建分类</button>

        <div class="space-y-3">
          <div v-for="c in categoryDrafts" :key="c.id" class="p-4 rounded-2xl border border-border bg-card">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <input v-model="c.name" type="text" class="sm:col-span-1 px-3 py-2 rounded-xl border border-border bg-card outline-none focus:border-emerald-500" />
              <input v-model="c.description" type="text" class="sm:col-span-2 px-3 py-2 rounded-xl border border-border bg-card outline-none focus:border-emerald-500" />
            </div>
            <div class="mt-3 flex gap-2">
              <button @click="saveCategory(c)" class="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">保存</button>
              <button @click="deleteCategory(c)" class="px-3 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">删除</button>
            </div>
          </div>
          <ui-EmptyState v-if="categoryDrafts.length === 0" :icon="FolderOpen" title="暂无分类" />
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showRevisionsModal">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>历史版本</DialogTitle>
      </DialogHeader>
      <div class="space-y-3">
        <div v-for="r in revisions" :key="r.id" class="p-4 rounded-2xl border border-border bg-card flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="font-bold truncate">{{ new Date(r.created_at).toLocaleString() }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ r.snapshot?.name }}</div>
          </div>
          <button @click="rollbackToRevision(r.id)" class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors">回滚</button>
        </div>
        <ui-EmptyState v-if="revisions.length === 0" :icon="History" title="暂无历史版本" />
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showAuditModal">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>最近操作日志</DialogTitle>
      </DialogHeader>
      <div class="space-y-2">
        <div v-for="l in auditPage.items" :key="l.id" class="p-4 rounded-2xl border border-border bg-card">
          <div class="flex items-center justify-between gap-4">
            <div class="font-bold">{{ l.action }}</div>
            <div class="text-xs text-muted-foreground">{{ new Date(l.created_at).toLocaleString() }}</div>
          </div>
          <div class="text-sm text-foreground mt-1">{{ l.entity_type }} {{ l.entity_id }}</div>
        </div>
        <ui-EmptyState v-if="auditPage.items.length === 0" :icon="ScrollText" title="暂无日志" />
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showAddMember">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>添加项目成员</DialogTitle>
      </DialogHeader>
      <SearchSelect
        v-model="newMemberId"
        :search-fn="searchUsers"
        placeholder="至少输入 1 个字符搜索用户"
      />
      <div class="mt-3">
        <label class="block text-sm font-bold text-muted-foreground mb-2">成员角色</label>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold border transition-colors"
            :class="newMemberRole === 'collaborator' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-border bg-card'"
            @click="newMemberRole = 'collaborator'"
          >
            协作者
          </button>
          <button
            type="button"
            class="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold border transition-colors"
            :class="newMemberRole === 'owner' ? 'bg-amber-500 text-white border-amber-500' : 'border-border bg-card'"
            @click="newMemberRole = 'owner'"
          >
            负责人
          </button>
        </div>
        <p v-if="newMemberRole === 'owner'" class="text-xs text-muted-foreground mt-2">设为负责人后，原负责人将自动降为协作者，并同步「作者/开发者」字段。</p>
      </div>
      <DialogFooter>
        <button @click="addMember" :disabled="!newMemberId" class="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 transition-colors">确认添加</button>
        <button @click="showAddMember = false; newMemberId = null; newMemberRole = 'collaborator'" class="flex-1 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground font-bold text-sm transition-colors">取消</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Save, Plus, Inbox, FolderOpen, History, ScrollText, Package } from 'lucide-vue-next';
import { adminFetch, formatAdminError, normalizeMediaUrl } from '../../composables/useAdminFetch';
import SearchSelect from '../../components/admin/SearchSelect.vue';
import ProjectMediaFields from '../../components/shared/ProjectMediaFields.vue';
import { ListDetailLayout as uiListDetailLayout, EmptyState as uiEmptyState } from '../../components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import ProjectTagGallery from '../../components/projects/ProjectTagGallery.vue';
import ProjectTagRow from '../../components/projects/ProjectTagRow.vue';
import ProjectTagLibraryDialog from '../../components/admin/ProjectTagLibraryDialog.vue';
import { resolveProjectDisplayTags } from '../../lib/resolveProjectDisplayTags';

const memberRowKey = (m: any) => (m.user_id ? `u:${m.user_id}` : m.org_id ? `o:${m.org_id}` : `j:${m.joined_at ?? ''}`);
const memberAvatarUrl = (m: any) => m.avatar_url || m.user_avatar_url || m.org_avatar_url || '';

const searchUsers = async (query: string) => {
  const qt = query.trim();
  if (qt.length < 1) return [];
  const qs = new URLSearchParams({ q: qt, pageSize: '10' });
  const res = await adminFetch(`/api/admin/users?${qs.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  const items = Array.isArray(json.items) ? json.items : Array.isArray(json) ? json : [];
  const mapped = items.map((u: any) => {
    const label = u.name || u.email || u.id || '';
    const subtitle = [u.email, u.stcn_username].filter(Boolean).join(' · ') || '';
    const row = { id: String(u.id), label, subtitle: subtitle || undefined, avatar: u.avatar_url || '' };
    userLabelCache.set(row.id, label);
    return row;
  });
  return mapped;
};

const searchOrganizations = async (query: string) => {
  const qt = query.trim();
  if (qt.length < 1) return [];
  const qs = new URLSearchParams({ q: qt, status: 'approved', pageSize: '10' });
  const res = await adminFetch(`/api/admin/organizations?${qs.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  const items = Array.isArray(json.items) ? json.items : Array.isArray(json) ? json : [];
  return items.map((o: any) => {
    orgLabelCache.set(String(o.id), o.name || '');
    const statusLabel = o.status === 'approved' ? '已通过' : o.status === 'pending' ? '审核中' : (o.status || '');
    return {
      id: String(o.id),
      label: o.name || '',
      subtitle: [o.slug ? `@${o.slug}` : '', statusLabel].filter(Boolean).join(' · '),
      avatar: o.avatar_url || '',
    };
  });
};

const userLabelCache = new Map<string, string>();
const orgLabelCache = new Map<string, string>();

const onOrgSelect = (val: string | null) => {
  if (val) {
    projectDraft.value.organization_name = orgLabelCache.get(val) || '';
  } else {
    projectDraft.value.organization_name = '';
  }
};

const onDeveloperSelect = (val: string | null) => {
  if (val) {
    const label = userLabelCache.get(val) || '';
    projectDraft.value.developer = label;
    projectDraft.value.developer_user_name = label;
  } else {
    projectDraft.value.developer = '';
    projectDraft.value.developer_user_id = null;
    projectDraft.value.developer_user_name = '';
  }
};

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

const projectsPage = ref<{ items: any[]; page: number; pageSize: number; total: number }>({
  items: [],
  page: 1,
  pageSize: 30,
  total: 0
});
const projectQuery = ref<{ q: string; category: string; tag_id: string; page: number; pageSize: number }>({
  q: '',
  category: '',
  tag_id: '',
  page: 1,
  pageSize: 30
});
const showTagLibrary = ref(false);
const tagPickerQuery = ref('');
const quickTagLabel = ref('');
const quickTagGroup = ref('feature');
const projectsLoading = ref(true);
const projectsLoadingMore = ref(false);
const projectsHasMore = computed(() => projectsPage.value.items.length < projectsPage.value.total);

const selectedProjectId = ref<string | null>(null);
const projectDraft = ref<any | null>(null);
const isSaving = ref(false);

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

const fetchAdminProjects = async (append = false) => {
  if (append) projectsLoadingMore.value = true;
  else projectsLoading.value = true;
  try {
    const qs = new URLSearchParams();
    if (projectQuery.value.q) qs.set('q', projectQuery.value.q);
    if (projectQuery.value.category) qs.set('category', projectQuery.value.category);
    if (projectQuery.value.tag_id) qs.set('tag_id', projectQuery.value.tag_id);
    qs.set('page', String(projectQuery.value.page));
    qs.set('pageSize', String(projectQuery.value.pageSize));
    const res = await adminFetch(`/api/admin/projects?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      projectsPage.value = {
        ...json,
        items: append ? [...projectsPage.value.items, ...(json.items ?? []).map(normalizeProjectDraft)] : (json.items ?? []).map(normalizeProjectDraft),
      };
      return;
    }
  } catch {} finally {
    projectsLoading.value = false;
    projectsLoadingMore.value = false;
  }
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
    projectsPage.value = {
      items: append ? [...projectsPage.value.items, ...items.map(normalizeProjectDraft)] : items.map(normalizeProjectDraft),
      page: projectQuery.value.page,
      pageSize: projectQuery.value.pageSize,
      total,
    };
  } catch {}
};

const resetAndFetchProjects = async () => {
  projectQuery.value.page = 1;
  projectsPage.value = { items: [], page: 1, pageSize: projectQuery.value.pageSize, total: 0 };
  selectedProjectId.value = null;
  projectDraft.value = null;
  projectTagIds.value = [];
  await fetchAdminProjects(false);
};

const loadMoreProjects = async () => {
  if (projectsLoadingMore.value || projectsLoading.value || !projectsHasMore.value) return;
  projectQuery.value.page += 1;
  await fetchAdminProjects(true);
};

const selectProject = (p: any) => {
  selectedProjectId.value = p.id ?? null;
  projectDraft.value = normalizeProjectDraft(p);
  projectTagIds.value = Array.isArray(p.tag_ids)
    ? p.tag_ids.map(String)
    : Array.isArray(p.registry_tags)
      ? p.registry_tags.map((t: any) => String(t.id))
      : [];
  fetchProjectMembers();
};

const createNewProject = () => {
  selectedProjectId.value = 'new';
  projectDraft.value = normalizeProjectDraft({
    name: '新建软件项目',
    developer: '',
    developer_user_id: null,
    developer_user_name: '',
    organization_id: null,
    organization_name: '',
    status: '活跃',
    ai_usage_state: 'unknown',
    description: '',
    github_url: '',
    stars: 0,
    language: '',
    icon: '',
    banner: '',
    recommendation: '',
    keywords: '',
    category_id: projectQuery.value.category || null
  });
};

const saveProjects = async () => {
  isSaving.value = true;
  try {
    if (!projectDraft.value) {
      alert('请先选择一个项目');
      return;
    }
    const p: any = { ...projectDraft.value };
    p.icon = normalizeMediaUrl(p.icon);
    p.banner = normalizeMediaUrl(p.banner);
    delete p.avatar;
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
      await persistProjectTags(String(json.id ?? id));
    } else {
      const res = await adminFetch('/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(p)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(formatAdminError(json, '创建失败', res.status));
      projectDraft.value = normalizeProjectDraft(json);
      selectedProjectId.value = json.id || 'new';
      if (json.id) await persistProjectTags(String(json.id));
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

const resetProjectQuery = async () => {
  projectQuery.value = { q: '', category: '', tag_id: '', page: 1, pageSize: 30 };
  await resetAndFetchProjects();
};

const onTagLibraryUpdated = async () => {
  await fetchAllRegistryTags();
  await resetAndFetchProjects();
};

const onFilterByTag = async (tagId: string) => {
  projectQuery.value.tag_id = tagId;
  await resetAndFetchProjects();
};

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

const allRegistryTags = ref<any[]>([]);
const projectTagIds = ref<string[]>([]);

const TAG_GROUP_LABELS: Record<string, string> = {
  feature: '功能特性',
  state: '状态与运营',
  release: '版本与发布',
  community: '作者与贡献',
  custom: '其他',
};

const tagGroups = computed(() => {
  const order = ['state', 'feature', 'release', 'community', 'custom'];
  const map = new Map<string, any[]>();
  for (const t of allRegistryTags.value) {
    const g = t.group || 'custom';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(t);
  }
  return order
    .filter((g) => (map.get(g)?.length ?? 0) > 0)
    .map((key) => ({ key, label: TAG_GROUP_LABELS[key] ?? key, items: map.get(key) ?? [] }));
});

const filteredTagGroups = computed(() => {
  const q = tagPickerQuery.value.trim().toLowerCase();
  if (!q) return tagGroups.value;
  return tagGroups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((t: any) =>
        String(t.label ?? '').toLowerCase().includes(q) || String(t.slug ?? '').toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
});

const categoryNameForDraft = computed(() => {
  const cid = projectDraft.value?.category_id;
  if (!cid) return '';
  return adminCategories.value.find((c) => c.id === cid)?.name ?? '';
});

const fullTagPreview = computed(() => {
  if (!projectDraft.value) return resolveProjectDisplayTags({});
  const selectedTags = allRegistryTags.value
    .filter((t) => projectTagIds.value.includes(t.id))
    .map((t) => ({ ...t, show_in_gallery: true }));
  return resolveProjectDisplayTags({
    categoryName: categoryNameForDraft.value,
    status: projectDraft.value.status,
    version: projectDraft.value.version,
    last_update: projectDraft.value.last_update,
    language: projectDraft.value.language,
    stars: projectDraft.value.stars,
    registry_tags: selectedTags,
  });
});

const tagPreview = computed(() => ({
  gallery: fullTagPreview.value.gallery,
}));

const parseKeywordList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  return value.split(/[,，;]/).map((x) => x.trim()).filter(Boolean);
};

const matchTagsFromKeywords = (keywords: string[], tags: any[]): string[] => {
  const matched = new Set<string>();
  for (const raw of keywords) {
    const kw = String(raw ?? '').trim().toLowerCase();
    if (!kw) continue;
    for (const tag of tags) {
      const label = String(tag.label ?? '').trim().toLowerCase();
      const slug = String(tag.slug ?? '').trim().toLowerCase();
      if (label === kw || slug === kw || label.includes(kw) || kw.includes(label)) {
        matched.add(tag.id);
      }
    }
  }
  return [...matched];
};

const recommendTagsFromKeywords = () => {
  if (!projectDraft.value) return;
  const keywords = parseKeywordList(projectDraft.value.keywords);
  const featureTags = allRegistryTags.value.filter((t) => t.group === 'feature');
  const ids = matchTagsFromKeywords(keywords, featureTags.length ? featureTags : allRegistryTags.value);
  if (!ids.length) {
    alert('未找到与关键词匹配的标签');
    return;
  }
  const merged = new Set([...projectTagIds.value, ...ids]);
  projectTagIds.value = [...merged];
  alert(`已勾选 ${ids.length} 个推荐标签，保存项目后生效`);
};

const createQuickTag = async () => {
  const label = quickTagLabel.value.trim();
  if (!label) {
    alert('请输入标签名称');
    return;
  }
  try {
    const res = await adminFetch('/api/admin/tags', {
      method: 'POST',
      body: JSON.stringify({
        label,
        group: quickTagGroup.value,
        color_variant: 'slate',
        show_in_gallery: true,
        show_on_card: false,
        show_on_header: false,
        card_priority: 0,
        is_active: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatAdminError(json, '创建标签失败', res.status));
    await fetchAllRegistryTags();
    if (json?.id) projectTagIds.value = [...new Set([...projectTagIds.value, String(json.id)])];
    quickTagLabel.value = '';
    alert('标签已创建并选中');
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : '创建标签失败');
  }
};

const persistProjectTags = async (projectId: string) => {
  const res = await adminFetch(`/api/admin/projects/${encodeURIComponent(projectId)}/tags`, {
    method: 'PUT',
    body: JSON.stringify({ tag_ids: projectTagIds.value }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatAdminError(json, '保存标签失败', res.status));
  projectTagIds.value = json.tag_ids ?? projectTagIds.value;
  if (projectDraft.value) projectDraft.value.registry_tags = json.items ?? [];
};

const fetchAllRegistryTags = async () => {
  try {
    const res = await adminFetch('/api/admin/tags');
    if (!res.ok) return;
    const json = await res.json();
    allRegistryTags.value = json.items ?? [];
  } catch {}
};

const projectMembers = ref<any[]>([]);
const showAddMember = ref(false);
const newMemberId = ref<string | null>(null);
const newMemberRole = ref<'collaborator' | 'owner'>('collaborator');

const fetchProjectMembers = async () => {
  if (!projectDraft.value?.id) {
    projectMembers.value = [];
    return;
  }
  try {
    const res = await adminFetch(`/api/admin/projects/${encodeURIComponent(projectDraft.value.id)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      projectMembers.value = [];
      alert(formatAdminError(json, '加载项目成员失败', res.status));
      return;
    }
    projectMembers.value = Array.isArray(json.members) ? json.members : [];
    projectTagIds.value = Array.isArray(json.tag_ids) ? json.tag_ids.map(String) : [];
    if (projectDraft.value) {
      projectDraft.value.registry_tags = json.registry_tags ?? [];
    }
  } catch (e: unknown) {
    projectMembers.value = [];
    projectTagIds.value = [];
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '加载项目成员失败'));
  }
};

const addMember = async () => {
  if (!newMemberId.value || !projectDraft.value?.id) return;
  const role = newMemberRole.value;
  const userId = newMemberId.value;
  try {
    const res = await adminFetch(`/api/admin/projects/${encodeURIComponent(projectDraft.value.id)}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatAdminError(json, '添加成员失败', res.status));
      return;
    }
    if (role === 'owner' && projectDraft.value) {
      projectDraft.value.developer_user_id = userId;
      const label = userLabelCache.get(userId);
      if (label) {
        projectDraft.value.developer = label;
        projectDraft.value.developer_user_name = label;
      }
    }
    showAddMember.value = false;
    newMemberId.value = null;
    newMemberRole.value = 'collaborator';
    await fetchProjectMembers();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '添加成员失败'));
  }
};

const promoteToOwner = async (m: { user_id?: string; user_name?: string }) => {
  if (!m.user_id || !projectDraft.value?.id) return;
  if (!confirm(`将「${m.user_name || m.user_id}」设为项目负责人？原负责人将降为协作者。`)) return;
  try {
    const res = await adminFetch(
      `/api/admin/projects/${encodeURIComponent(projectDraft.value.id)}/members/${encodeURIComponent(m.user_id)}`,
      { method: 'PATCH', body: JSON.stringify({ role: 'owner' }) }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatAdminError(json, '设置负责人失败', res.status));
      return;
    }
    projectDraft.value.developer_user_id = m.user_id;
    if (m.user_name) {
      projectDraft.value.developer = m.user_name;
      projectDraft.value.developer_user_name = m.user_name;
    }
    await fetchProjectMembers();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '设置负责人失败'));
  }
};

const removeMember = async (m: any) => {
  if (!projectDraft.value?.id || !confirm('确定移除此成员？')) return;
  const pid = projectDraft.value.id;
  let url: string;
  const opts: RequestInit = { method: 'DELETE' };
  if (m.org_id && !m.user_id) {
    url = `/api/admin/projects/${encodeURIComponent(pid)}/members/${encodeURIComponent(m.org_id)}`;
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify({ org_id: m.org_id });
  } else if (m.user_id) {
    url = `/api/admin/projects/${encodeURIComponent(pid)}/members/${encodeURIComponent(m.user_id)}`;
  } else {
    alert('无法移除：成员缺少 user_id / org_id');
    return;
  }
  try {
    const res = await adminFetch(url, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatAdminError(json, '移除成员失败', res.status));
      return;
    }
    await fetchProjectMembers();
  } catch (e: unknown) {
    alert(formatAdminError({ message: e instanceof Error ? e.message : '' }, '移除成员失败'));
  }
};

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

onMounted(() => {
  fetchAdminCategories();
  fetchAdminProjects();
  fetchAllRegistryTags();
});
</script>

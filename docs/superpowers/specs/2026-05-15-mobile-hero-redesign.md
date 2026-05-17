# 手机端 Hero 轮播区域优化设计

## 问题诊断

当前手机端 Hero 区域存在两个核心问题：

1. **视觉断层**：沉浸式轮播卡片（全屏）与下方应用卡片列表之间没有任何过渡衔接，风格割裂
2. **尺寸跳动**：Banner 图尺寸不一，导致轮播卡片高度不一致，滑动时产生明显的跳动感和廉价感

## 优化目标

- 统一轮播卡片高度，消除滑动时的跳动
- 建立轮播区与应用列表区的视觉衔接
- 保持沉浸式的体验感，但提升精致度
- 混合处理 Banner：有图则统一裁剪，无图则渐变背景

## 方案 C：混合模式 + 圆角卡片 + 渐变过渡

### 1. 轮播卡片结构重构

将当前的全屏沉浸式改为**圆角卡片容器**，内部保持沉浸式内容：

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │                       │  │
│  │    Banner/渐变背景     │  │  ← 固定 16:9 比例
│  │    (object-fit: cover) │  │
│  │                       │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  图标  名称        →   │  │  ← 白色内容区
│  │       开发者           │  │
│  │  描述文字...           │  │
│  │  ⭐ 标签               │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
         ↑ 圆角外框（margin 左右留白）
```

**关键样式**：
- 外框：`mx-4 rounded-3xl overflow-hidden shadow-lg`
- 图片区：`aspect-[16/9] w-full object-cover`
- 内容区：白色背景，圆角底部继承外框

### 2. 轮播与列表的过渡衔接

在轮播区域底部增加**渐变过渡带**：

```
轮播卡片区域
    │
    ▼
┌─────────────────────────────┐
│  最后一轮播卡片              │
│  ┌───────────────────────┐  │
│  │  内容区底部             │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
         ↓ 渐变过渡
┌─────────────────────────────┐
│  bg-gradient-to-b           │
│  from-white/80 to-slate-50  │  ← 柔和过渡
│  h-8                        │
└─────────────────────────────┘
         ↓ 分类标签区
┌─────────────────────────────┐
│  [全部] [白板] [课表] ...   │
└─────────────────────────────┘
```

### 3. Banner 混合处理逻辑

```vue
<!-- 统一高度的图片区域 -->
<div class="relative w-full aspect-[16/9] overflow-hidden">
  <template v-if="card.banner">
    <img 
      :src="card.banner" 
      class="w-full h-full object-cover" 
      alt="Banner"
      loading="lazy"
    />
    <!-- 暗色渐变遮罩，确保上方指示器可见 -->
    <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent"></div>
  </template>
  <template v-else>
    <!-- 提取图标颜色生成的渐变背景 -->
    <div 
      class="w-full h-full flex items-center justify-center"
      :style="{ 
        background: cardColors[card.name] 
          ? `linear-gradient(135deg, rgba(${cardColors[card.name]}, 0.2) 0%, rgba(${cardColors[card.name]}, 0.05) 100%)`
          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)'
      }"
    >
      <!-- 大图标 + 装饰圆环 -->
      <div class="relative">
        <div 
          class="absolute inset-0 rounded-full blur-2xl opacity-30 scale-150"
          :style="{ backgroundColor: cardColors[card.name] ? `rgb(${cardColors[card.name]})` : 'rgb(16, 185, 129)' }"
        ></div>
        <img 
          :src="card.icon || card.avatar" 
          class="w-24 h-24 object-contain relative z-10 drop-shadow-lg"
        />
      </div>
    </div>
  </template>
  
  <!-- 指示器 - 固定在图片区域内右上角 -->
  <div class="absolute top-3 right-3 flex items-center gap-1.5 z-10">
    <button
      v-for="(_, i) in heroCards" 
      :key="i" 
      @click.stop="activeHeroSlide = i + 1"
      class="h-1.5 rounded-full transition-all duration-200"
      :class="i === realHeroIndex ? 'bg-white w-5 shadow-sm' : 'bg-white/50 w-1.5'"
    ></button>
  </div>
</div>
```

### 4. 内容区精简优化

当前内容区信息过多，手机端精简为：

```
┌─────────────────────────────┐
│  [图标]  应用名称      查看 → │
│          开发者             │
│  描述文字（2行截断）         │
│  ⭐ 1.2k  |  TypeScript    │
└─────────────────────────────┘
```

- 移除"推荐状态"标签（颜色过多显杂乱）
- Stars 和语言标签保留，但简化样式
- "查看 →" 按钮改为更精致的箭头图标

### 5. 轮播容器高度控制

消除跳动的核心：固定整体高度或统一内容区结构。

由于图片区已固定 `aspect-[16/9]`，内容区文字固定行数（标题1行、开发者1行、描述2行、标签1行），整体高度自然统一。

### 6. 触摸交互保留

保留现有的触摸滑动逻辑：
- `onTouchStart` / `onTouchMove` / `onTouchEnd`
- 自动轮播（5秒间隔）
- 滑动阈值 50px
- 无限循环 `loopCards`

## 视觉风格

- **圆角**：`rounded-3xl` (24px) 外框
- **阴影**：`shadow-lg shadow-slate-200/50`
- **留白**：左右 `mx-4` (16px)，上下卡片间距 `gap-4`
- **过渡**：轮播区底部到列表区的渐变带 `h-8 bg-gradient-to-b`
- **指示器**：圆角胶囊形状，当前项加宽 + 白色阴影

## 文件变更

- **修改**：`frontend/src/views/HomeView.vue`
  - 第 494-567 行：手机端 Hero 区域模板重构
  - 第 100-161 行：触摸逻辑保留（无需修改）

## 验收标准

- [ ] 轮播卡片左右有留白（不贴边），圆角外框
- [ ] 所有轮播卡片高度完全一致，滑动无跳动
- [ ] 有 Banner 的卡片图片统一裁剪填充 16:9
- [ ] 无 Banner 的卡片显示渐变背景 + 大图标
- [ ] 轮播区与下方分类标签之间有渐变过渡
- [ ] 触摸滑动、自动轮播、指示器点击功能正常
- [ ] 暗黑模式样式正常

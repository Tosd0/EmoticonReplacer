# Emoticon Replacer

基于 BM25 算法的智能颜文字替换工具，支持将文本中的关键词标记替换为对应的颜文字。可集成SillyTavern（酒馆）&小手机，节省颜文字世界书的Token，并提供更大量的颜文字选择区间。

## 功能特性

- 🔍 **智能匹配** - 使用 BM25 算法进行关键词搜索和评分
- 🗃️ **数据管理** - 完整的 CRUD 功能：添加/删除/修改颜文字、关键词、分组
- 🧩 **模块化设计** - 易于集成到其他项目
- 🎭 **SillyTavern 集成** - 提供开箱即用的 ST 扩展
- 📝 **自定义数据** - 支持自定义颜文字和关键词映射

## 快速开始

### 安装

```bash
npm install emoticon-replacer
```

或直接克隆仓库使用：

```bash
git clone https://github.com/Tosd0/EmoticonReplacer.git
```

### 数据格式

在 `data/emoticons.template.json` 中定义颜文字映射：

```json
[
  {
    "emoticon": "= =",
    "keywords": ["无语", "黑脸", "无奈"],
    "weight": 1.0,
    "category": ""
  }
]
```

### 三种使用方式

#### 方式 1: 快捷 API（推荐，最简单）

```javascript
const { quickReplace, loadFromFile } = require('emoticon-replacer');

// 从文件加载数据
const emoticons = await loadFromFile('./data/emoticons.template.json');

// 一行代码完成替换
const result = quickReplace('今天真是[emoticon:无语,黑脸]', emoticons);
console.log(result.text); // 输出: 今天真是 = =
```

#### 方式 2: 工厂函数（推荐，灵活配置）

```javascript
const { createReplacer, loadFromFile } = require('emoticon-replacer');

// 加载数据
const emoticons = await loadFromFile('./data/emoticons.template.json');

// 创建替换器实例（自动配置好所有组件）
const replacer = createReplacer({ emoticons });

// 使用替换器
const result = replacer.replaceText('今天真是[emoticon:无语,黑脸]');
console.log(result.text);
```

#### 方式 3: 直接使用类（最灵活）

```javascript
const { EmoticonReplacer, SearchEngine, EmoticonDataManager } = require('emoticon-replacer');

// 1. 创建数据管理器并加载数据
const manager = new EmoticonDataManager();
const response = await fetch('data/emoticons.template.json');
const jsonText = await response.text();
manager.loadFromJSON(jsonText);

// 2. 初始化搜索引擎和替换器
const searchEngine = new SearchEngine();
const replacer = new EmoticonReplacer(searchEngine);
replacer.loadEmoticons(manager.getAllEmoticons());

// 3. 替换文本
const input = '今天真是[emoticon:无语,黑脸]';
const result = replacer.replaceText(input);
console.log(result.text); // 输出: 今天真是 = =

// 4. 数据管理
manager.addKeyword('= =', '不爽');           // 添加关键词
manager.setCategory('= =', '表情');          // 设置分类
const filtered = manager.filterByCategory('表情'); // 按分类筛选
```

#### 方式 4: IndexedDB 存储（推荐，前端项目）

适合前端项目，自动管理数据持久化：

```javascript
const { initEmoticonStorage, quickReplace } = require('emoticon-replacer');

// 初始化存储（首次自动从远程加载，之后使用缓存）
const emoticons = await initEmoticonStorage({
  defaultURL: 'https://your-cdn.com/emoticons.json'  // 可选
});

// 直接使用
const result = quickReplace('今天[emoticon:开心]', emoticons);

// 后续调用直接从 IndexedDB 读取（更快、离线可用）
const cachedEmoticons = await initEmoticonStorage();
```

**特性：**
- ✅ 首次自动从远程加载
- ✅ 之后从 IndexedDB 读取（离线可用）
- ✅ 用户可自定义数据
- ✅ 降级优雅（远程失败返回空数组）

### TypeScript 支持

本库提供完整的 TypeScript 类型定义，支持类型检查和智能提示。

### 标记格式

在文本中使用 `[emoticon:关键词1,关键词2,...]` 格式标记需要替换的位置：

```
今天很[emoticon:开心,高兴]  →  今天很 ヽ(´▽`)/
真是[emoticon:无语]         →  真是 = =
```

## SillyTavern 集成

### 安装步骤

1. 将整个项目复制到 SillyTavern 扩展目录：
   ```
   SillyTavern/public/scripts/extensions/emoticon-replacer/
   ```

2. 在 `manifest.json` 中注册扩展（如需要）

3. 在 SillyTavern 设置中启用扩展

### 使用说明

扩展会自动处理包含 `[emoticon:...]` 标记的消息，支持两种模式：

- **display 模式**: 仅修改显示内容，不影响 AI 上下文
- **content 模式**: 直接修改消息内容，会影响 AI 上下文

## 项目结构

```
EmoticonReplacer/
├── src/core/                    # 核心模块
│   ├── SearchEngine.js          # BM25 搜索引擎
│   ├── EmoticonReplacer.js      # 替换引擎
│   └── EmoticonDataManager.js   # 数据管理器
├── src/integrations/
│   └── sillytavern.js           # SillyTavern 集成
├── data/
│   └── emoticons.template.json  # 数据模板
└── examples/                    # 使用示例
```

## API 参考

### 快捷 API

#### `quickReplace(text, emoticons, options)`

一行代码完成文本替换：

```javascript
const { quickReplace } = require('emoticon-replacer');

const result = quickReplace(
  '今天[emoticon:开心,高兴]',
  emoticons,
  {
    strategy: 'best',
    keepOriginalOnNotFound: true
  }
);

console.log(result.text);
console.log(result.successCount);
```

#### `quickQuery(keywords, emoticons, topK)`

快速查询关键词对应的颜文字：

```javascript
const { quickQuery } = require('emoticon-replacer');

const results = quickQuery('开心', emoticons, 5);
console.log(results[0].emoticon);
```

#### `batchReplace(texts, emoticons, options)`

批量处理多个文本：

```javascript
const { batchReplace } = require('emoticon-replacer');

const texts = [
  '第一条[emoticon:开心]消息',
  '第二条[emoticon:无语]消息'
];

const results = batchReplace(texts, emoticons);
results.forEach(r => console.log(r.text));
```

### 工厂函数

#### `createReplacer(options)`

创建完整配置的替换器：

```javascript
const { createReplacer } = require('emoticon-replacer');

const replacer = createReplacer({
  emoticons: [...],           // 数据数组
  searchConfig: {             // BM25 参数
    k1: 1.5,
    b: 0.75
  },
  replaceConfig: {            // 替换配置
    replaceStrategy: 'best'
  }
});
```

#### `createManager(data)`

创建数据管理器：

```javascript
const { createManager } = require('emoticon-replacer');

// 从数组创建
const manager = createManager([...]);

// 从 JSON 字符串创建
const manager2 = createManager(jsonString);
```

### 核心类 API

#### EmoticonReplacer

```javascript
const { EmoticonReplacer, SearchEngine } = require('emoticon-replacer');

const engine = new SearchEngine();
const replacer = new EmoticonReplacer(engine);

// 替换文本
replacer.replaceText(text, {
  strategy: 'best',              // 'first' | 'best' | 'all'
  keepOriginalOnNotFound: true,  // 找不到时保留原标记
  markNotFound: false            // 找不到时标记为 [?...]
});

// 预览匹配
replacer.preview(text);

// 查询关键词
replacer.query('开心', 5);
replacer.exactQuery('开心');
```

#### SearchEngine

```javascript
const { SearchEngine } = require('emoticon-replacer');

// 创建搜索引擎
const engine = new SearchEngine({
  k1: 1.5,  // 词频饱和参数
  b: 0.75   // 长度归一化参数
});

// 构建索引
engine.buildIndex(emoticons);

// BM25 搜索
engine.search('文本', topK, threshold);

// 精确匹配
engine.exactMatch('文本');
```

#### EmoticonDataManager

```javascript
const { EmoticonDataManager } = require('emoticon-replacer');

// 数据加载
const manager = new EmoticonDataManager();
manager.loadFromJSON(jsonString);
manager.loadFromArray(dataArray);

// 读取操作
manager.getAllEmoticons();                    // 获取所有颜文字
manager.getKeywordsByEmoticon('= =');        // 获取特定颜文字的关键词
manager.getAllKeywords();                    // 获取所有关键词列表
manager.filterByCategory('表情');            // 按分类筛选
manager.findByKeyword('开心');               // 按关键词查找

// 修改操作
manager.addKeyword('= =', '无奈');          // 添加关键词
manager.removeKeyword('= =', '黑脸');       // 删除关键词
manager.updateKeywords('= =', ['新1', '新2']); // 批量更新关键词
manager.setCategory('= =', '表情');         // 设置分类
manager.setWeight('= =', 1.5);              // 设置权重

// 颜文字管理
manager.addEmoticon({                        // 添加新颜文字
  emoticon: '(๑•̀ㅂ•́)و✧',
  keywords: ['加油', '努力'],
  weight: 1.0,
  category: '鼓励'
});
manager.removeEmoticon('= =');               // 删除颜文字

// 数据导出
const json = manager.exportToJSON();         // 导出为 JSON
const array = manager.exportToArray();       // 导出为数组
```

### 数据加载与工具

```javascript
// Node.js 环境：从文件加载
const emoticons = await loadFromFile('./data/emoticons.json');

// 浏览器环境：从 URL 加载
const emoticons = await loadFromURL('/data/emoticons.json');

// 验证数据格式
const result = validateData(data);
```

### IndexedDB 存储 API

前端项目推荐使用 IndexedDB 存储：

```javascript
const {
  initEmoticonStorage,
  getEmoticons,
  saveEmoticons,
  clearEmoticons,
  getStorageStats
} = require('emoticon-replacer');

// 初始化存储（自动管理加载和缓存）
const emoticons = await initEmoticonStorage({
  defaultURL: 'https://cdn.example.com/emoticons.json',  // 可选
  forceReload: false  // 可选：是否强制重新加载
});

// 手动读取
const data = await getEmoticons();  // 返回 Array 或 null

// 手动保存
await saveEmoticons([...]);  // 保存自定义数据

// 清空缓存
await clearEmoticons();

// 获取统计信息
const stats = await getStorageStats();
// { hasData: true, count: 100, sizeKB: "12.34" }
```

**使用场景：**
1. **首次使用**：自动从 `defaultURL` 加载并缓存
2. **后续使用**：直接从 IndexedDB 读取（快速 + 离线可用）
3. **自定义数据**：用户可以保存自己的颜文字配置
4. **降级处理**：远程加载失败时返回空数组，不影响主流程

## 许可证

MIT License

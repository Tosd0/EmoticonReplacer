# Kaomoji Replacer

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
npm install kaomoji-replacer
```

或直接克隆仓库使用：

```bash
git clone https://github.com/Tosd0/KaomojiReplacer.git
```

### 数据格式

在 `data/kaomojis.template.json` 中定义颜文字映射：

```json
[
  {
    "kaomoji": "= =",
    "keywords": ["无语", "黑脸", "无奈", "1.5很无语", "0.8有点无奈"],
    "weight": 1.0,
    "category": ""
  }
]
```

**关键词权重**：关键词支持权重前缀（格式：`"权重关键词"`），用于调整匹配优先级：
- `"1.5开心"` - 权重 1.5，关键词为"开心"（匹配时得分提高 50%）
- `"0.8无奈"` - 权重 0.8，关键词为"无奈"（匹配时得分降低 20%）
- 无前缀时默认权重为 1.0

**权重计算规则**：
- 匹配多个关键词时，如果权重都 >1，取最大值；都 <1，取最小值；既有 >1 又有 <1，则相乘
- 最终得分 = 匹配分数 × 关键词权重 × 颜文字权重（`weight` 字段）

### 标记格式

在文本中使用 `[kaomoji:关键词1,关键词2,...]` 格式标记需要替换的位置：

```
今天很[kaomoji:开心,高兴]  →  今天很 ヽ(´▽`)/
真是[kaomoji:无语]         →  真是 = =
```

### 使用方式

#### Prompt 构建

为了让AI了解颜文字格式，你可以使用下面的 Prompt（或自行优化）指导 AI。Prompt 仅供参考。

```
**颜文字格式**: \`[kaomoji:关键词1,关键词2]\` (根据关键词智能匹配颜文字，如：[kaomoji:开心,高兴] → ヽ(´▽\`)/ 或 [kaomoji:无语] → = =)\n你可以使用2-6个关键词描述你想要发送的颜文字的类型、表情神态、场景、效果、动作、人设类型等。关键词如：“双人”“卖萌”“无语”“大笑”“猫/狗/鸟/...”“跑”“闪亮”“傲娇”“温柔”“腹黑”等。
```

#### 方式 0: UMD + CDN + IndexedDB（推荐，浏览器环境最简单）

无需安装，只需引入一个 UMD 文件，使用 `initKaomojiStorage` 自动从 CDN 加载并缓存：

```html
<!-- 引入 UMD 文件 -->
<script src="https://cdn.jsdelivr.net/npm/kaomoji-replacer/dist/kaomoji-replacer.umd.min.js"></script>

<script>
// 从 CDN 加载默认模板（首次从 CDN 加载，之后从 IndexedDB 缓存读取）
const kaomojis = await KaomojiReplacer.initKaomojiStorage({
    defaultURL: 'https://cdn.jsdelivr.net/npm/kaomoji-replacer/data/kaomojis.template.json'
});

// 创建替换器
const replacer = KaomojiReplacer.createReplacer({ kaomojis });

// 使用
const result = replacer.replaceText('今天很[kaomoji:开心,高兴]');
console.log(result.text); // 输出: 今天很ヽ(´▽`)/
</script>
```

**特性：**
- ✅ 只需一个 UMD 文件，无需额外依赖
- ✅ 首次从 CDN 加载，之后从 IndexedDB 缓存读取
- ✅ 离线可用
- ✅ 支持 jsDelivr 和 unpkg 两种 CDN

**示例文件：** [examples/quick-start.html](examples/quick-start.html)

#### 方式 1: 快捷 API（推荐，Node.js 环境最简单）

```javascript
import { quickReplace, loadFromFile } from 'kaomoji-replacer';

// 从文件加载数据
const kaomojis = await loadFromFile('./data/kaomojis.template.json');

// 一行代码完成替换
const result = quickReplace('今天真是[kaomoji:无语,黑脸]', kaomojis);
console.log(result.text); // 输出: 今天真是 = =
```

#### 方式 2: 工厂函数（推荐，灵活配置）

```javascript
import { createReplacer, loadFromFile } from 'kaomoji-replacer';

// 加载数据
const kaomojis = await loadFromFile('./data/kaomojis.template.json');

// 创建替换器实例（自动配置好所有组件）
const replacer = createReplacer({ kaomojis });

// 使用替换器
const result = replacer.replaceText('今天真是[kaomoji:无语,黑脸]');
console.log(result.text);
```

#### 方式 3: 直接使用类（最灵活）

```javascript
import { KaomojiReplacer, SearchEngine, KaomojiDataManager } from 'kaomoji-replacer';

// 1. 创建数据管理器并加载数据
const manager = new KaomojiDataManager();
const response = await fetch('data/kaomojis.template.json');
const jsonText = await response.text();
manager.loadFromJSON(jsonText);

// 2. 初始化搜索引擎和替换器
const searchEngine = new SearchEngine();
const replacer = new KaomojiReplacer(searchEngine);
replacer.loadKaomojis(manager.getAllKaomojis());

// 3. 替换文本
const input = '今天真是[kaomoji:无语,黑脸]';
const result = replacer.replaceText(input);
console.log(result.text); // 输出: 今天真是 = =

// 4. 数据管理
manager.addKeyword('= =', '不爽');           // 添加关键词
manager.setCategory('= =', '表情');          // 设置分类
const filtered = manager.filterByCategory('表情'); // 按分类筛选
```

#### 方式 4: ES Module + IndexedDB 存储（推荐，前端项目）

适合前端项目，自动管理数据持久化：

```javascript
import { initKaomojiStorage, quickReplace } from 'kaomoji-replacer';

// 初始化存储（首次自动从远程加载，之后使用缓存）
const kaomojis = await initKaomojiStorage({
  defaultURL: 'https://your-cdn.com/kaomojis.json'  // 可选
});

// 直接使用
const result = quickReplace('今天[kaomoji:开心]', kaomojis);

// 后续调用直接从 IndexedDB 读取（更快、离线可用）
const cachedKaomojis = await initKaomojiStorage();
```

**特性：**
- ✅ 首次自动从远程加载
- ✅ 之后从 IndexedDB 读取（离线可用）
- ✅ 用户可自定义数据
- ✅ 降级优雅（远程失败返回空数组）

### TypeScript 支持

本库提供完整的 TypeScript 类型定义，支持类型检查和智能提示。

## SillyTavern 集成

### 安装步骤

1. 将整个项目复制到 SillyTavern 扩展目录：
   ```
   SillyTavern/public/scripts/extensions/kaomoji-replacer/
   ```

2. 在 `manifest.json` 中注册扩展（如需要）

3. 在 SillyTavern 设置中启用扩展

### 使用说明

扩展会自动处理包含 `[kaomoji:...]` 标记的消息，支持两种模式：

- **display 模式**: 仅修改显示内容，不影响 AI 上下文
- **content 模式**: 直接修改消息内容，会影响 AI 上下文

## 项目结构

```
KaomojiReplacer/
├── src/core/                    # 核心模块
│   ├── SearchEngine.js          # BM25 搜索引擎
│   ├── KaomojiReplacer.js      # 替换引擎
│   └── KaomojiDataManager.js   # 数据管理器
├── src/integrations/
│   └── sillytavern.js           # SillyTavern 集成
├── data/
│   └── kaomojis.template.json  # 数据模板
└── examples/                    # 使用示例
```

## API 参考

### 快捷 API

#### `quickReplace(text, kaomojis, options)`

一行代码完成文本替换：

```javascript
import { quickReplace } from 'kaomoji-replacer';

const result = quickReplace(
  '今天[kaomoji:开心,高兴]',
  kaomojis,
  {
    strategy: 'best',
    keepOriginalOnNotFound: true
  }
);

console.log(result.text);
console.log(result.successCount);
```

#### `quickQuery(keywords, kaomojis, topK)`

快速查询关键词对应的颜文字：

```javascript
import { quickQuery } from 'kaomoji-replacer';

const results = quickQuery('开心', kaomojis, 5);
console.log(results[0].kaomoji);
```

#### `batchReplace(texts, kaomojis, options)`

批量处理多个文本：

```javascript
import { batchReplace } from 'kaomoji-replacer';

const texts = [
  '第一条[kaomoji:开心]消息',
  '第二条[kaomoji:无语]消息'
];

const results = batchReplace(texts, kaomojis);
results.forEach(r => console.log(r.text));
```

### 工厂函数

#### `createReplacer(options)`

创建完整配置的替换器：

```javascript
import { createReplacer } from 'kaomoji-replacer';

const replacer = createReplacer({
  kaomojis: [...],           // 数据数组
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
import { createManager } from 'kaomoji-replacer';

// 从数组创建
const manager = createManager([...]);

// 从 JSON 字符串创建
const manager2 = createManager(jsonString);
```

### 核心类 API

#### KaomojiReplacer

```javascript
import { KaomojiReplacer, SearchEngine } from 'kaomoji-replacer';

const engine = new SearchEngine();
const replacer = new KaomojiReplacer(engine);

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
import { SearchEngine } from 'kaomoji-replacer';

// 创建搜索引擎
const engine = new SearchEngine({
  k1: 1.5,  // 词频饱和参数
  b: 0.75   // 长度归一化参数
});

// 构建索引
engine.buildIndex(kaomojis);

// BM25 搜索
engine.search('文本', topK, threshold);

// 精确匹配
engine.exactMatch('文本');
```

#### KaomojiDataManager

```javascript
import { KaomojiDataManager } from 'kaomoji-replacer';

// 数据加载
const manager = new KaomojiDataManager();
manager.loadFromJSON(jsonString);
manager.loadFromArray(dataArray);

// 读取操作
manager.getAllKaomojis();                    // 获取所有颜文字
manager.getKeywordsByKaomoji('= =');        // 获取特定颜文字的关键词
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
manager.addKaomoji({                        // 添加新颜文字
  kaomoji: '(๑•̀ㅂ•́)و✧',
  keywords: ['加油', '努力'],
  weight: 1.0,
  category: '鼓励'
});
manager.removeKaomoji('= =');               // 删除颜文字

// 数据导出
const json = manager.exportToJSON();         // 导出为 JSON
const array = manager.exportToArray();       // 导出为数组
```

### 数据加载与工具

```javascript
import { loadFromFile, loadFromURL, validateData } from 'kaomoji-replacer';

// Node.js 环境：从文件加载
const kaomojis = await loadFromFile('./data/kaomojis.json');

// 浏览器环境：从 URL 加载
const kaomojis = await loadFromURL('/data/kaomojis.json');

// 验证数据格式
const result = validateData(data);
```

### IndexedDB 存储 API

前端项目推荐使用 IndexedDB 存储：

```javascript
import {
  initKaomojiStorage,
  getKaomojis,
  saveKaomojis,
  clearKaomojis,
  getStorageStats
} from 'kaomoji-replacer';

// 初始化存储（自动管理加载和缓存）
const kaomojis = await initKaomojiStorage({
  defaultURL: 'https://cdn.example.com/kaomojis.json',  // 可选
  forceReload: false  // 可选：是否强制重新加载
});

// 手动读取
const data = await getKaomojis();  // 返回 Array 或 null

// 手动保存
await saveKaomojis([...]);  // 保存自定义数据

// 清空缓存
await clearKaomojis();

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

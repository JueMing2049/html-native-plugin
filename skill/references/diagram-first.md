# 图显前置工作台（diagram-first 模板）

给**智能体应用开发**用的前置工作台：先画五张图，再把结论誊成字段，最后导出 `diagram-first.json` 与 `app-spec.md` 交给 `workswarm-app-builder`。

它解决三个返工点：角色拓扑选错（该 Team NPC 做成单角色）、验收标准缺失（上架前才发现会话泄漏）、效果与预期不符（做完才说不是这个意思）。

## 五个阶段

| 阶段 | 名字 | 出口条件 |
| --- | --- | --- |
| 0 | 定级 | 选了 Quick / Light / Full |
| 1 | 对标（BDMP） | 参考达标（Quick 豁免） |
| 2 | 画图 | 本级别要求的图全部勾"已确认" |
| 3 | 誊字段 | 必答项无空 |
| 4 | 导出 | — |

模板只覆盖原文档五段里的「问清楚 + 画图纸」。「动手做 / 分步验 / 收尾记档」以交付契约的形式交给 app-builder。

## 复杂度分级

| 级别 | 触发条件 | 要画的图 | 质量门 |
| --- | --- | --- | --- |
| Quick | 纯静态工具，无 AI | 效果图 + 流程图 | G0 |
| Light | 单角色 AI，无需服务端 | + 时序图 | G0–G1 |
| Full | Team NPC / 需要服务端 / 多页面 | 五张全画 | G0–G3 |

级别决定 `figuresRequired` 与 `gates`，也决定门禁强度。Quick 需求不该被五张图压死——这是分级的全部意义。

## 五张图

| 图 | 骨架画什么 | 回答什么 |
| --- | --- | --- |
| `effect` 效果图 | 设备框 + 区域块 + 标注线 | 长什么样 |
| `flow` 流程图 | 输入→AI→渲染→验收，含失败重试 | 谁在什么时候做什么 |
| `orchestration` 编排图 | DAG + gate 菱形 + 回退虚线 | 先后、并行、阻塞 |
| `architecture` 架构图 | 页面 / 应用服务 / Gateway / 模型 | 系统怎么搭 |
| `sequence` 时序图 | 六条泳道 + 回合收口线 | 一轮谁说话、到哪算结束 |

每张图必须回答三件事：**给谁看 / 答什么问题 / 明确不答什么**。答不上就别勾"已确认"。

### Diagram-as-Code

图源是独立文件 `figures/*.svg`，不是焊在 HTML 里的：

- **可 diff**：改图就是改文本，能 review、能回滚
- **可替换**：团队用 Mermaid / Archify 出图，把产物覆盖到同名文件即可，页面不用动
- **可单文件**：要离线分发时 `scaffold --single`（或 `build/inline.mjs --inline-svg`）把 SVG 内联进 HTML

图只读——页面里不能拖拽改图。要改内容就编辑 `figures/*.svg`。

## 效果图的三种来源

| 模式 | 做法 | 边界 |
| --- | --- | --- |
| `placeholder` | 显示骨架，标注"这是占位" | 默认 |
| `uploaded` | 选图 → 预览 → 下载成 `effect.png` → 放进 `figures/` | 纯静态页不能写盘，所以是"下载 + 自动填路径"两步 |
| `generated` | 页面给四段式生图提示词，外部生成后走上传 | **模板不调模型** |

生图提示词四段：意图 / 结构（区域与元素）/ 风格（配色、密度）/ 禁忌（不要什么）。要内建生图就得接 Gateway，破坏"纯静态、双击可用"，本版不做。

## 对标（BDMP）

- **入口**：A 朴素灵感（先找参考）/ B 明确对标（已有参考，直接拆）
- **参考清单**：至少 1 条（Quick 可 0 条），写明"借它什么"：布局 / 交互 / 风格 / 内容
- **六层拆解**：布局 / 组件 / 交互 / 数据 / 风格 / 内容
- **体量**：轻量 <1 万行 / 中量 1–50 万 / 重量 >50 万。**阈值是示例**，按团队能力、合规、周期调整
- 体量决定交付策略：轻量走快速原型，中量模块化拆解，重量架构先行

BDMP 是方法参照，不引入其代码。

## 与 Spec-Superpower 的关系

只借三样：复杂度分级、六步骨架、质量门 G0–G3。**不引其代码、不调其脚本、不声明其许可证**——原文档里它也只是"公开仓库的方法参照"。

| ssp 六步 | 本模板 |
| --- | --- |
| 对话探索 | 阶段 0 定级 + 阶段 1 对标提问 |
| 复杂度分级 | 阶段 0 |
| 规范化 | 阶段 3 字段 |
| 计划 | 阶段 3 编排 + gate |
| 实现 / 归档 | 交给 app-builder |

## 范式包 schema v1

```json
{
  "schema": "hnp.diagram-first/1",
  "generatedAt": "ISO",
  "status": "draft | final",
  "complexity": { "level": "", "reason": "", "figuresRequired": [], "gates": [] },
  "benchmark": { "entry": "", "refs": [], "layers": {}, "executability": {}, "scale": "", "scaleNote": "" },
  "app": { "name": "", "oneLine": "", "audience": "", "reference": "" },
  "effectImage": { "mode": "", "path": "figures/effect.png", "prompt": "" },
  "figures": { "effect": { "source": "", "reader": "", "question": "", "outOfScope": "", "confirmed": false } },
  "agent": { "topology": "", "roles": [], "needsServer": false, "needsAI": true },
  "orchestration": [{ "stage": "ask", "artifact": "", "gate": "", "done": false }],
  "acceptance": [{ "id": "Q1", "question": "", "answer": "" }],
  "open": []
}
```

`status = final` 的条件：**本级别要求的图**全部 `confirmed` **且** `open` 为空。字段名一旦被消费只加不改。

## 与 app-builder 的映射

| 范式包字段 | app-builder 动作 |
| --- | --- |
| `complexity.level` | 拆几个文件、是否先做架构骨架、评审轮数 |
| `benchmark.scale` | 交付策略（快速原型 / 模块化 / 架构先行） |
| `agent.topology = single` | `mode:"agent"` + `role_instructions` |
| `agent.topology = team` | `mode:"team"` + `npc_team.members`，按 `roles[]` 填名册 |
| `agent.needsServer` | 为真才生成 `scripts/app_server.py` |
| `agent.roles[].outputSchema` | 写进首轮 `role_instructions` 的输出约束 |
| `figures.sequence` | 回合收口实现（`turn_request_id` 匹配、逐条展示） |
| `orchestration[].gate` | G0–G3 逐道过 |
| `acceptance[]` | 转成上架前验证清单 |

`app-spec.md` 结尾固定三行：拓扑 / 是否需要服务端 / 必须通过的三条硬验证。

## 与 decision 插件的取舍

页面里的选择组用轻量 `.choice` 组件，没有用 `decision` 插件。原因：插件形态带"选中 → 确认 → 落库"三段，适合做决策卡；而这里是表单输入，多一次确认反而碍事。样式仍复用 `hnp.css` 的 token，视觉一致。

## 打印

`@media print` 下隐藏工具栏与批注浮层，**本级别所有图强制展开**，黑白可读、A4 不破版。这条对应原文档检查表里的"能不能打印"。

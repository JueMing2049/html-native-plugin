# 接入既有项目时反复踩到的坑

这些不是理论风险，是实际调试中撞出来的。接新页面前扫一遍，比事后翻控制台快。

## 1. 脚本顺序反了，插件全部静默失效

插件文件靠 `HNP.define` 注册，运行时没到就先执行会得到 `HNP is not defined`；被包在 `if (!window.HNP) return` 里的会**静默跳过**——控制台干净，页面没交互，最难查。

顺序固定：`hnp.js` 在最前，其后任意顺序放插件。

## 2. 类名写错不报错，只是没反应

`.hnp-tabs__bar`、`.hnp-dcard__q`、`.hnp-cmp__h` 这些内部类名少一个下划线就静默不工作。不确定就照 `references/blocks.md` 抄。

## 3. 批注必须落在 `data-block` 里

`anno` 只认带 `data-block` 的容器。全文都没有这个属性时，选中文字什么都不会出现，也不会有提示。给正文每个 section 加 `data-block="<块名>"` 即可。

## 4. 多组筛选互相清空

`filter` 早期版本在 `document` 上找条目，一组筛选会让另一组的条目也消失。现在作用域收窄到最近的 `[data-hnp-scope]`，**但前提是你包了这一层**。页面有两处以上筛选时，每处都要独立包。

## 5. `file://` 打不开不代表坏了

沙箱里的浏览器常禁止 `file:` 协议。验证前先起个静态服务（`node` 起一个即可），别把浏览器安全策略当成页面缺陷。

## 6. 浏览器缓存会让你验证旧代码

改完 `hnp.css` 后刷新，可能仍读到旧样式——CSSOM 里出现文件里早已删掉的规则就是缓存。验证时给静态服务加 `Cache-Control: no-store`，或在开发者工具里勾 Disable cache，否则会得出"改动没生效"的错误结论。

## 7. 重复挂载是幂等的，卸载才是关键

`HNP.mount(document)` 连调三次不会绑三遍事件，这是内核保证的。真正要验的是 `HNP.unmount(document, 'tabs')` 之后点击无响应——监听器没登记到 `ctx.on` 的插件，卸载后照样会响应，那才是 bug。

## 8. 与 kunpeng-ops 的样式变量同名

`hnp.css` 的 token（`--bg` `--panel` `--jade` 等）与 kunpeng-ops 的 `kit.css` 同名同值。两个都引入时**后引入的赢**，值是兼容的，但如果你在页面里覆盖过 token，要确认覆盖顺序。组件类名不冲突（HNP 全部 `hnp-` 前缀）。

## 9. `reveal` 的内容消失问题

历史实现用 `html.js` 类隐藏待渐入内容，导致"只引 CSS 没引 reveal 插件"的页面内容凭空消失。现在隐藏规则收在 `.hnp-anim` 下，由插件挂载时才添加。**不要自己往 `<html>` 手写 `hnp-anim`**，那会绕过这个保护。

## 10. 发布：token 不要进命令参数

Windows 下 `git -c http.extraHeader="Authorization: Basic xxx"` 会被 PowerShell 按空格拆成多个参数，导致 `git: 'Authorization: Basic' is not a git command`。正确做法是把配置塞进 `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_0` / `GIT_CONFIG_VALUE_0` 环境变量，argv 里不出现 token，也不会写进 `.git/config`。

## 11. 发布：仓库已存在时不要"顺手覆盖"

`scaffold.mjs --publish` 遇到同名仓库直接失败退出。不要改成静默追加或强制推送——用户可能有个同名项目，覆盖等于毁掉别人的历史。

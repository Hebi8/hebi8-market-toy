# 「hebi8 外汇回放」宣传片

一条 51.5 秒的 Remotion 视频（1920×1080，30 fps，H.264，没有音轨），介绍这个 Toy 是什么、怎么玩、
在哪里。分镜和每一段的字幕原文在 [STORYBOARD.zh-CN.md](STORYBOARD.zh-CN.md)。

这个目录和 Toy 本体分开：自己的 `package.json` 和依赖，不进 Toy 的包，也不参与仓库根目录的
`npm run check` / `npm test`。

## 做一遍

需要 Node.js 22+、`google-chrome`（采集用）、系统里的 Noto Sans CJK SC 和 Noto Color Emoji 字体。

```bash
# 仓库根目录：被录的页面是 dist/toy/
npm ci && npm run build

cd promo
npm ci
npm run capture   # 真打一局并录下来，约 2 分钟，写进 public/captures/
npm run render    # out/hebi8-fx-replay-pv.mp4
npm run stills    # out/stills/ 每段的代表帧，out/hebi8-fx-replay-cover.png 封面
```

- `npm run studio` 打开 Remotion Studio，可以单独看每一段（`PV-Scenes` 下）和封面（`Cover`）。
- `npm run stills -- --qa` 另外每 15 帧出一张半尺寸的图到 `out/qa/`，用来把整条片子过一遍。
- `npm run lint` 是 ESLint 加 TypeScript。
- 渲染并发固定为 4（`remotion.config.ts`），这台机器上还跑着别的服务。

`public/captures/` 和 `out/` 都不入库，随时可以重做。

## 画面是怎么来的

片子里所有的产品画面都出自 `capture/capture.mjs` 打的**同一局**：2022-09-22「24 年来首次买入日元」，
USD/JPY。脚本在自己的端口（默认 8831，`PORT` 可改）上起 `scripts/preview.mjs --dist`，用无头 Chrome
点「10×」档、七下「+」、「买入」，把倍速调到 30×，然后看着它走到 16:03 的干预、被强平、弹出
「爆仓了」。之后在同一局上打开分享面板、取出分享图和挑战链接，再用这条链接在手机尺寸下打开一次，
拍下挑战卡。预览服务和 Chrome 都是脚本自己启动、按自己的 PID 关掉的。

局内那一段是**逐帧**录的。游戏的回放循环靠 `requestAnimationFrame` 和 `performance.now()` 走；采集时
在页面自己的脚本之前换掉这两个（还有 `setTimeout`，提示条靠它消失），换成一只由脚本拨动的钟：拨
1/30 秒，截一张图，再拨。回放用的还是游戏自己的循环、自己的倍速、自己的引擎，只是每一帧都落在
确定的时刻，截图再慢也不丢帧。Toy 的 `src/` 没有为此改动，也没有加钩子。干预前后那二十分钟按
每秒 60 帧录，剪辑时可以放慢。

`public/captures/manifest.json` 记下每一帧的时刻、账户栏三个数字的位置、几个按钮的位置，以及下单、
提速、干预、结束各在第几帧。场景从这里读位置和时间，所以片子里没有任何手写的成绩数字：结算页、
分享图、挑战卡上的都是这一局自己的。换一局（改 `capture.mjs` 顶上的 `PLAN`）重新采集，这些会跟着
变；但片子讲的是一次爆仓，`PLAN` 打不出「爆仓了」时采集会报错。

排行榜、昵称、头像只在 B 站域名下才有，本地采集不到，片子里只指出入口，不展示名次。

## 贴纸

贴纸是 emoji 字符，渲染时由系统的彩色 emoji 字体画出来（`src/project.ts` 里的 `EMOJI` 字体栈；
这台机器上是 Noto Color Emoji，SIL Open Font License 1.1）。仓库里没有任何 emoji 图片。换一台机器
渲染，贴纸的画风会跟着那台机器的 emoji 字体变。

## 目录

```
capture/    采集：chrome.mjs（无头 Chrome）、capture.mjs（打那一局并录下来）
tools/      stills.mjs（代表帧和封面）
src/        project.ts（尺寸、时长、文案、manifest 的类型）、motion.ts、
            components/（网格背景、飞入飞散、贴纸、卡片、截图框、点击圈、二维码）、
            scenes/（六段和封面）
public/     captures/（采集结果，不入库）
out/        成片、代表帧、封面（不入库）
```

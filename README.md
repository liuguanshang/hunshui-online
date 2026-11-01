# 浑水摸鱼 · 联机网页版

一盆金鱼，只有一条是人。一人藏、一人捞，手机浏览器或微信里打开链接就能联机。

## 目录

```
server.js                联机服务器（Node.js，零依赖：静态网页 + WebSocket 房间）
package.json             npm run build（下载字体） / npm start（启动）
Dockerfile               用 Docker 部署时使用
scripts/fetch-fonts.mjs  构建时下载页面用到的字体，失败也不影响运行
public/index.html        游戏本体（玩法参数都在文件里的 CFG 对象中）
public/audio/            BGM：bgm-lobby.mp3（界面）、bgm-game.mp3（游戏中通用，池塘用它）
                         场景专属：bgm-sea（海里）/ bgm-sushi（寿司店）/ bgm-grill（烤鱼店）/ bgm-tank（鱼缸）
public/fonts/            字体（构建后生成）
```

## 本地运行

需要 Node.js 18 或更高版本，不需要 npm install。

```
npm run build   # 可选：下载字体
npm start       # 打开 http://localhost:3000
```

## 部署要点

- 启动命令：`npm start`；构建命令：`npm run build`（可省略）
- 端口：读取环境变量 `PORT`，默认 3000
- 联机走 WebSocket，路径 `/ws`，平台必须支持 WebSocket 长连接
- 必须用 HTTPS 访问（页面会自动改用 `wss://`），否则微信里可能连不上
- 健康检查地址：`/healthz`（返回 ok）
- 只跑 1 个实例；房间数据在内存里，重启后房间清空，不需要数据库

## 怎么玩

- 2～6 人上场，其余观战。开房间的人点「复制邀请链接」发给好友，好友打开就能进房间
- 每个人自己选当鱼、抓鱼的还是观战；房主选场景并开局
- 五个场景：池塘（纸网）、海里（鱼钩）、寿司店（手抓）、烤鱼店（抄网）、鱼缸（猫爪）
- 抓到真鱼时全员播放 3 秒过场动画，计时暂停

## 换 BGM

把 mp3 放进 public/audio/，文件名按上面写的来，重新部署即可。场景专属的文件不存在时，自动用 bgm-game.mp3。
换成新的场景 BGM 后，要把 public/index.html 里 LOOPS 那一行对应场景的循环点删掉（删掉后整首从头循环），或者把新文件发给 Claude 重新找循环点。

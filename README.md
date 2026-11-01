# 浑水摸鱼 · 联机网页版

一盆金鱼，只有一条是人。一人藏、一人捞，手机浏览器或微信里打开链接就能联机。

## 目录

```
server.js                联机服务器（Node.js，零依赖：静态网页 + WebSocket 房间）
package.json             npm run build（下载字体） / npm start（启动）
Dockerfile               用 Docker 部署时使用
scripts/fetch-fonts.mjs  构建时下载页面用到的字体，失败也不影响运行
public/index.html        游戏本体（玩法参数都在文件里的 CFG 对象中）
public/audio/            两首 BGM（界面 / 游戏中）
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

开房间的人得到 4 位房间号，点「复制邀请链接」发给好友，好友打开就能进房间。开房的人选「藏」或「捞」，对方自动拿另一个身份，多出来的人观战。

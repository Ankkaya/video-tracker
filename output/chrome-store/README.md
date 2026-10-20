# Chrome Web Store 资料

适用当前源码：0.0.14。更新日期：2026-10-20。仅更新仓库，未上传或提交审核。旧上传记录保留在 archive/delivery-before-2026-10-20.json，历史状态不代表本次资料已上传。请使用与当前素材一致的版本安装包。

- 中英文名称、短描述、详情、截图说明与更新内容：各语言目录的 listing.json、description.txt、release-notes.txt。
- 每种语言 5 张 1280×800 JPG：记录、设置、站点排除、弹窗、反馈。来自当前真实 Vue 组件和虚构数据，无真实账号，反馈预览不发送请求。
- 宣传图：每种语言 440×280 和 1400×560；使用当前功能文案。
- 官网：https://video-tracker.ankkaya.top/
- 隐私政策：https://video-tracker.ankkaya.top/privacy-policy.html
- 支持：https://github.com/Ankkaya/video-tracker/issues
- 统一权限说明与审核步骤：../../docs/STORE_LISTING.md；Edge 专用说明：../../docs/edge-certification-notes.md。

更新统一文案后运行 npm run generate:store。宣传图运行 node scripts/store-preview/capture-promos.mjs；截图可运行 node scripts/store-preview/capture-assets.js（需先启动该目录的 Vite 预览配置）。

发布前构建包含当前源码功能的安装包，更新既有商店包时使用商店接受的新版本号；核对正式扩展 ID 的认证回调并验证登录、同步与反馈。审核账号只填私密字段。填写最新数据披露、上传中英文素材后再按授权提交审核。本地已构建 video-tracker-0.0.14-chrome-mv3.zip，SHA-256 见 delivery.json；未上传商店或提交审核。

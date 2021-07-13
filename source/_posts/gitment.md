---
title: 添加gitment
date: 2021-07-13 13:08:13
tags: Gitment
---
# 问题
> Gitment不显示在界面上的问题，只要项目公开就一定有隐私泄露的风险
# 解决方案
> 在`xx.md`页面可直接嵌入`HTML`代码

# 参考链接
1.[Gitment：使用 GitHub Issues 搭建评论系统 ](https://imsun.net/posts/gitment-introduction/)

<div id="container"></div>
<link rel="stylesheet" href="https://imsun.github.io/gitment/style/default.css">
<script src="https://imsun.github.io/gitment/dist/gitment.browser.js"></script>
<script>
var gitment = new Gitment({
  owner: 'firework',
  repo: 'git_comment',
  oauth: {
    client_id: '8a085244b132bd131808',
    client_secret: 'bd7d2304a4d0056f0fab6265176b50614343bdd8',
  },
})
gitment.render('container')
</script>
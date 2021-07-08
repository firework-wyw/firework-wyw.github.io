---
title: swagger-bug
date: 2021-07-08 10:46:38
tags: Bug
---
# Swagger出现404错误
开始学习使用Swagger，然而发现按照教程的步骤写的实例项目有时候可以正常实现功能，有时候却不可以，问题到底出现在什么地方呢？
# 解决方案
>仔细比对了可以正常运行和不能正常运行的项目，发现唯一的区别就是`pom.xml`中的依赖版本不同，一个是`2.x`版本，一个是`3.0.0`，改成`2.x`后正常运行。
> 网上搜索了以下swagger3与之前的swagger2使用的方法并不相同，连API的访问路径也不相同，而我看的教程是`2.x`版的，使用的是`3.x`，学习教程要注意版本号，新版本的使用要以官方介绍为准。

# 参考链接
1.[升级使用SpringFox的swagger-ui 3.0.0版本](https://blog.csdn.net/qq_15973399/article/details/107436089)
2.[Spring Boot整合Swagger2构建RESTful API](https://mrbird.cc/Spring-Boot-Swagger2-RESTful-API.html)
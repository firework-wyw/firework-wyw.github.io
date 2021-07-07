---
title: RBAC权限介绍
date: 2021-07-07 08:37:52
tags: 计算机基础
---
# RBAC是什么
RBAC模型（Role-Based Access Control:基于角色的访问控制）

1.概述
> RBAC认为授权实际上就是Who、What、How三元组之间的关系，也就是Who对What进行How的操作，即“主体”对“客体”的操作
> * Who:是权限的拥有者或主体（如User,Role）
> * What:是操作或对象（operation,object）
> * How:具体的权限（Privilege,正向授权和负向授权）

2.RBAC的组成
> 在RBAC的模型里，有3个基础组成部分，分别是：用户、角色和权限。
> RBAC通过定义角色的权限，并对用户授予某个角色从而控制用户的权限，实现用户和权限的逻辑分离（区别于[ACL模型](https://baike.baidu.com/item/%E8%AE%BF%E9%97%AE%E6%8E%A7%E5%88%B6%E5%88%97%E8%A1%A8/1844390?fromtitle=ACL&fromid=362453&fr=aladdin)）
> 它们之间的关系如下图所示：
> ![RBAC关系图](https://shuwoom.com/wp-content/uploads/2019/04/rbacrole-based-access-control-1.png "RBAC关系图"")

3.RBAC支持的安全原则
> * 最小权限原则：RBAC可以将角色配置成其完成任务所需的最小的权限集合
> * 责任分离原则：可以通过调用相互独立互斥的角色共同完成敏感的任务，例如要求一个记账员和财务管理员共同参与统一过账操作
> * 数据抽象原则：可以通过权限的抽象来体现，例如财务操作用借款、存款等抽象权限，而不是使用典型的读、写等执行权限

4.RBAC的优缺点
> * 优点：
>    * 简化用户和权限的关系
>    * 易于扩展维护
> * 缺点：
>    * RBAC模型没有提供操作顺序的控制机制，这一缺陷使得RBAC模型很难适合那些对操作次序有严格要求的系统
# RBAC分类
分为4类：<font color="red">RBAC0</font>、<font color="red">RBAC1</font>、<font color="red">RBAC2</font>、<font color="red">RBAC3</font>
>* RBAC0：是
> 
# 参考链接
1.[RBAC权限系统分析、设计与实现](https://shuwoom.com/?p=3041)
2.[RBAC权限管理模型：基本模型及角色模型解析及举例](http://www.woshipm.com/pd/440765.html)
3.[RBAC介绍（权限）](https://www.cnblogs.com/niuli1987/p/9871182.html)
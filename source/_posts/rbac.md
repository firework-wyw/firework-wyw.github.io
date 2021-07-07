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
> ![RBAC关系图](https://shuwoom.com/wp-content/uploads/2019/04/rbacrole-based-access-control-1.png "RBAC关系图")

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

* RBAC0
> <font color="red">RBAC0是最简单、最原始的事项方式，也是其他RBAC模型的基础</font>
> ![RBAC0](https://shuwoom.oss-cn-beijing.aliyuncs.com/rbac0. "RBAC0")
> 在这个模型中，我们把权限赋予角色，再把角色赋予用户。用户和角色，角色和权限都是多对多的关系，用户拥有的权限等于他所有的角色持有权限之和。

* RBAC1
> <font color="red">RBAC1是基于RBAC0的模型，引入了角色间的继承关系，即角色上有了上下级的区别</font>
> ![RBAC1](https://shuwoom.oss-cn-beijing.aliyuncs.com/rbac1.png "RBAC1")
> 角色间的继承关系可分为一般继承关系和受限继承关系。一般继承关系仅要求角色继承关系是一个绝对偏序关系，允许角色间的多继承。
> 而受限继承关系则进一步要求角色继承关系是一个树结构，实现角色间的单继承。
> 这种模型适合于角色之间层次分明的业务，可以给角色分组分层。

* RBAC2
> <font color="red">RBAC2是基于RBAC0模型的基础上，进行了角色的访问控制</font>
> RBAC2的角色限制具体分为两类：静态职责分离SSD（Static Separation of Duty）,动态职责分离DSD(Dynamic Separation of Duty)
> ![RBAC2](http://image.woshipm.com/wp-files/2016/11/0OHUFCNitWfqlnptsJ3b.png "RBAC2")
> RBAC2中的一个基本限制是互斥角色的限制，互斥角色是指各自权限可以互相制约的两个角色。对于这类角色一个用户在某一次的活动中只能被分配其中的一个角色，不能同事获取两个角色的使用权
> 该模型有以下几种约束：
> * 互斥角色：同一用户只能分配到一组互斥角色集合中至多一个角色，支持责任分离的原则。互斥角色是指各自权限互相制约的两个角色。对于这类角色一个用户在某一次活动中只能被分配到其中的一个角色，不能同时获得两个角色的使用权。举个栗子：在审计活动中，一个角色不能同时被指派会计角色和审计员角色。
> * 基数约束：一个角色被分配的用户数量受限；一个用户可拥有的角色数目受限；同样一个角色对应的访问权限数目也应受限，以控制高级权限在系统中的分配。例如公司的领导人是有限的。
> * 先决条件角色：可以分配角色给用户仅当该用户已经是另一角色的成员；对应的可以分配访问权限给角色，仅当该角色已经拥有另一种访问权限。要想获得较高的权限，首先拥有低一级的权限。就像我们生活中，国家主席是从副主席中选举的一样。
> * 运行时互斥：例如，允许一个用户具有两个角色的成员资格，但在运行中不可同时激活这两个角色。

# 如何设计RBAC
1.RBAC的功能模块
![RBAC的功能模块](https://shuwoom.oss-cn-beijing.aliyuncs.com/RBAC%E6%A8%A1%E5%9D%97%E5%8A%9F%E8%83%BD.png "RBAC的功能模块")

2.RBAC的执行流程
![RBAC的执行流程](https://shuwoom.oss-cn-beijing.aliyuncs.com/RBAC%E6%B5%81%E7%A8%8B.png "RBAC的执行流程")

3.RBAC的数据库设计
![RBAC的数据库设计](https://shuwoom.oss-cn-beijing.aliyuncs.com/rbac%E6%95%B0%E6%8D%AE%E5%BA%93%E8%AE%BE%E8%AE%A1.png "RBAC的数据库设计")

# 参考链接
1.[RBAC权限系统分析、设计与实现](https://shuwoom.com/?p=3041)
2.[RBAC权限管理模型：基本模型及角色模型解析及举例](http://www.woshipm.com/pd/440765.html)
3.[RBAC介绍（权限）](https://www.cnblogs.com/niuli1987/p/9871182.html)
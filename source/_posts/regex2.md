---
title: 复杂匹配规则
date: 2021-07-05 13:57:30
tags: 计算机基础
---
匹配开头和结尾
>用`^`表示开头，用`$`表示结尾

匹配指定范围
> * <font color="red">[123456789]</font>可以匹配<font color="red">[1~9]</font>，还有另外一种表示方法<font color="red">[0-9a-fA-F]</font>，
> 还有一种排除法，即不包含指定范围的字符。<font color="red">[^1-9]</font>

或规则匹配
>* 用`|`连接的两个正则规则是或规则，例如<font color="red">AB|CD</font>

使用括号
>* 如果匹配字符串<font color="red">learn java</font>、<font color="red">learn php</font>、<font color="red">learn go</font>，可以这样写`learn\\s(java|php|go)`

分组匹配
>* 如何正则匹配<font color="red">区号-电话号</font>这个规则，按照前边的介绍完全可以匹配到，但是匹配成功后，如何区分区号和电话号码，分别存入数据库。
>也就是如何提取匹配的子串？
> 正确的方法是用<font color="red">(...)</font>先把要提取的规则分组，然后引入`java.until.regex`包，用`Pattern`对象匹配，匹配获得一个`Matcher`对象，如果匹配成功，可以直接从`Matcher.group(index)`返回子串

非贪婪匹配
>* 给定一个字符串表示的数字，判断该数字末尾`0`的个数，例如`123000`末尾3个`0`，`10010`末尾1个`0`。
> 我们的思路是这样的：利用分组匹配把字符串分为末尾为`0`的部分和其余部分，正则表达式可以这样写：<font color="red>(\d+)(0*)</font>
> 然而事情并不是我们想象的那样，为`0`的那部分始终为空，因为<font>(\d+)</font>已经包含匹配后面的`0`，第二部分规则根本没机会
> 所以我们要让<font color="red">(\d+)</font>少匹配，让<font color="red">(0*)</font>尽量多匹配，就必须使用非贪婪规则。
> 在规则<font color="red">(\d+)</font>后面加<font color="red">?</font>即可表示非贪婪匹配


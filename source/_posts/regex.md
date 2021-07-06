---
title: regex
date: 2021-07-05 13:04:05
tags: 计算机基础
categories: 计算机基础
---
# 什么是正则表达式？
>正则表达式大概类似于输出语句中的占位符
# 匹配规则
> + 正则表达式的匹配规则是从左到右按规则匹配，如果表达式中有特殊字符，就用<font color="red">\\</font>转义，例如，正则表达式<font color="red">a\\&c</font>,其中<font color="red">\\&</font>是用来匹配特殊字符<font color="red">\&</font>的
> + 正则表达式在java代码中也是一个字符串，所以，对于正则表达式<font color="red">a\\&c</font>来说，对应的java字符串是<font color="red">a\\\\&c</font>，因为<font color="red">\\</font>也是java字符串的转义字符，两个<font color="red">\\</font>实际表示的是一个<font color="red">\\</font>
---
> + 匹配任意字符，例如正则表达式<font color="red">a.c</font>中间的<font color="red">.</font>可以匹配一个任意字符
> + 匹配数字，如果想匹配<font color="red">0~9</font>这样的数字，可以用<font color="red">\d</font>匹配
> + 匹配常用字符，用<font color="red">\w</font>可以匹配一个字母、数字或下划线，<font color="red">w</font>的意思是<font color="red">word</font>
> + 匹配空格字符，用<font color="red">\s</font>可以匹配一个空格字符，注意空格字符不但包括空格` `，还包括<font color="red">tab</font>字符（在java中用<font color="red">\t</font>表示）
> + 匹配非数字，用<font color="red">\D</font>匹配非数字，于<font color="red">\d</font>刚好相反，类似的<font color="red">\W</font>可以匹配<font color="red">\w</font>不能匹配的字符，<font coloe="red">\S</font>匹配<font color="red">\s</font>不能匹配的字符
> + 重复匹配，修饰符<font color="red">*</font>可以匹配任意个字符，包括0个字符
> + 修饰符<font color="red">+</font> 可以匹配至少一个字符
> + 修饰符<font color="red">?</font>可以匹配0个或一个字符
> + 匹配n个字符，用<font color="red'>{n}</font>就可以
> + 如果匹配n~m个字符，可以使用<font color="red">{n,m}</font>
> + 修饰符<font color="red">{n,}</font>表示至少匹配n个字符

参考链接：[正则表达式](https://www.liaoxuefeng.com/wiki/1252599548343744/1304066080636961)
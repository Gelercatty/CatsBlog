---
title: RL Basics
date: 2025-12-21 15:09:34
tags: RL 强化学习 概率论
mathjax: true
---

有关强化学习中一些基础概念的理解与思考。

## 塔式性
各种教程中对于RL里面价值函数这一部分的推导经常默认看得懂全期望公式。

$$
\begin{array}{l}
V(s)=\mathbb{E}[G_t\mid S_t=s] \\
=\mathbb{E}[R_t+\gamma R_{t+1}+\gamma^2R_{t+2}+\cdots \mid S_t=s] \\
=\mathbb{E}[R_t+\gamma(R_{t+1}+\gamma R_{t+2}+\cdots)\mid S_t=s] \\
=\mathbb{E}[R_t+\gamma G_{t+1}\mid S_t=s] \\
=\mathbb{E}[R_t+\gamma V(S_{t+1})\mid S_t=s]
\end{array}
$$


为什么$G_{t+1}$能够直接等于本应取决于$S_{t+1}$的价值函数？这就涉及到全概率公式的概念。

对于随机变量$X$, $Y$ 期望的塔性法则指出：
$$\mathbb{E}[X] = \mathbb{E}[\mathbb{E}[X | Y]]$$

随机变量的期望，等于条件期望的期望。

回想一下，全期望公式告诉我们，如果要对整体取期望，可以对分组取期望。再根据分组出现的概率，当作系数加和，得到最终的期望。
（[ref](https://blog.csdn.net/qq_52032801/article/details/147079838)）


$\mathbb{E}[X\mid Y]$ 本身不是一个常数，而是一个关于随机变量 $Y$的新的随机变量。我们定义一个函数 $g(\cdot)$，令 $g(y)=\mathbb{E}[X\mid Y=y]$，于是有 $\mathbb{E}[X\mid Y]=g(Y)$。因此外层的 $\mathbb{E}[\mathbb{E}[X\mid Y]]$ 就是在对随机变量 $g(Y)$ 取期望。对离散的 $Y$，按全期望公式，可以得到：

$$
\mathbb{E}[\mathbb{E}[X\mid Y]]
=\mathbb{E}[g(Y)]
=\sum_y g(y)\,P(Y=y)
=\sum_y \mathbb{E}[X\mid Y=y]\,P(Y=y).
$$

接着用条件期望的定义，把内层 $\mathbb{E}[X\mid Y=y]$ 展开成对 $X$ 的加权和：

$$
\mathbb{E}[X\mid Y=y]=\sum_x x\,P(X=x\mid Y=y).
$$

代回去得到：

$$
\mathbb{E}[\mathbb{E}[X\mid Y]]
=\sum_y\left(\sum_x x\,P(X=x\mid Y=y)\right)P(Y=y).
$$

最后交换求和顺序，并利用全概率公式 $$\sum_y P(X=x\mid Y=y)P(Y=y)=P(X=x)$$，即可推出：

$$
\sum_y\left(\sum_x x\,P(X=x\mid Y=y)\right)P(Y=y)
=\sum_x x\sum_y P(X=x\mid Y=y)P(Y=y)
=\sum_x x\,P(X=x)
=\mathbb{E}[X].
$$


塔式法则告诉我们，一个总体期望，可以查分成现在某个条件下求期望，再对这个信息本身的随机性做一次平均。对应到MDP里面，未来的回报本身是不确定的，取决于下一个状态，下一个动作。所以价值函数是一个期望。
$$V^\pi (s) = \mathbb{E}_\pi[G_t | S_t = s]$$

但我要对当前的价值做个估计，根据塔式性，我们可以求未来的在各个状态/动作影响后价值函数，再对以这些状态为划分的价值期望求期望，就能够间接的求出当前的价值期望。是一种递归的分解。

回到一开始的疑问：$G_{t+1}$依赖于未知的$S_{t+1}$
这时候，令分组变量是下一个状态$S_{t+1}$

$$\mathbb{E}_\pi[G_{t+1} | S_t = s] = \mathbb{E}_\pi[\mathbb{E}_\pi[G_{t+1}|S_{t+1}]|S_t=s]$$

这里面就把对于未来的不可控转化成了下一个状态价值的平均。

价值函数是在估计未来，而不看过。站在当前时间步，可以用未来所有状态的经验分布预估未来价值，同时确定观测当前时间步的回报。
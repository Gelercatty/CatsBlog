---
title: DQN
date: 2025-12-19 23:59:31
tags: RL UE
mathjax: true
---

## Q-learning

RL的最终目标，是让整个Agent在行动中，最终拿到的奖励最大。划分到每一步上，Agent要学会在每一步上，根据当前的观测决定如何行动。这个行动也是我们唯一能干预的。把好坏直接定义在A(s)能大大降低问题的复杂度。而反应(s,a) 好坏的，就是Q函数。Q-learning就是在学习这个。
### 基本的定义
假设我们的环境是一个`MDP`：$(\mathbin{S,A,P,R,\gamma})$，分别是状态，行动，状态转移，回报，衰减，这个MDP过程由这些变量决定。

从一个时刻t开始，通过$\gamma$进行衰减递减的折扣回报$G_t$可以表示为
$$G_t = \sum_{k=0}^\infty{\gamma^kr_{t+k}}$$


定义策略$\pi (a\mid s)$下的`状态`价值$V^\pi(s)$:
$$V^\pi (s) = \mathbb{E}[G_t | s_t = s]$$

$V^\pi(s)$是在某个状态上，对这个未来所有可能采样的期望。反映了这个状态的预期好坏。

如果在这个基础上，根据策略，采取某个行动a，就可以定义动作价值，也就是Q函数$Q^\pi(s,a)$:
$$
Q^\pi(s,a) = \mathbb{E}_\pi[G_t | s_t=a, a_t = a]
$$

### 固定期望的贝尔曼方程

动作价值里面的$G_t$要求所有未来的交互数据，这是不可能计算的。每次交互后都会有及时的反馈$s$, 并且环境的变化也是及时的：$s\rightarrow s^`$。
对动作价值进一步推导：

$$
Q^\pi(s,a) = \mathbb{E}[r + \gamma V^\pi(s^`) | s, a]
$$

其中，如果按照某个策略，在$s^\prime$处采样，动作价值函数就退化为价值函数，也就有：
$$V^\pi(s^\prime ) =\mathbb{E}_{a^\prime ～ \pi(·|s^\prime)}[Q^\pi(s^\prime,a^\prime)]
$$

代回去：
$$
Q^\pi(s,a) = \mathbb{E}[r + \gamma \mathbb{E}_{a^\prime ～ \pi(·|s^\prime)}[Q^\pi(s^\prime,a^\prime)]]
$$

### 优化的目标
可以定义两个最优的价值：
$$
V^*(s)=\max_{\pi} V^{\pi}(s), \quad Q^*(s,a)=\max_{\pi} Q^{\pi}(s,a)
$$

在所有的策略中，总有一个策略比其他策略在一个状态下的状态好，或者不差于那个策略。而我们能干预的，是行动。如果知道最优的价值函数$Q^\star$ 那么最优的策略就是
$$
\pi^\star (s) = arg\max_{a}Q^\star(s, a)
$$
在状态s下，选择让Q最大的动作就可以。
因此最优价值函数就是：
$$
Q^\star(s, a) = \mathbb{E}[r + \gamma\max_{a^ \prime} Q^{\star}(s^\prime,a^\prime) | s, a]
$$

这个公式就是贝尔曼最优方程给出的$Q^\star$的固定点形式，由于不知道转移概率P，无法直接计算期望。但是可以同构每次交互得到的样本点，作为这个期望的近似，做增量的更新：



$$
Q(s_t, a_t) \leftarrow Q(s_t, a_t) + \alpha(y_t - Q(s_t, a_t))
$$
y 是最优策略期望在给定s时得到的一个采样。这个采样可以近似的理解为符合最优的Q：
$$
(s_t, a_t, r_t, s_{t+1})
$$

用这个样本，构建一个基本的单步目标
$$
y_t = r_t + \gamma \max_{a`}Q(s`, a`)
$$

一次样本当然不能代表整个期望，但是反复采样，根据大数定律，这个增量就会逼近最优的Q的期望。



## basic Q-learning

最基本的，如果$S, A$ 是有限，且数量可控的，那么Q就是一个$Q \in R^{s \star a}$的表格。学习中，更新$Q[s_i][a_i]$的值即可。


$$
Q(s_t,a_t)\leftarrow Q(s_t,a_t)+\alpha\Big(r_t+\gamma\max_{a'}Q(s_{t+1},a')-Q(s_t,a_t)\Big)
$$


整个算法流程：

- 初始化 $Q(s,a)$
- for 序列 $e = 1 \rightarrow E$ do：
  - 得到初始状态 $s$
  - for 时间步 $t = 1 \rightarrow T$ do：
    - 用 $\epsilon$-greedy 策略根据 $Q$ 选择当前状态 $s$ 下的动作 $a$
    - 得到环境反馈的 $r,\, s'$
    - $$
      Q(s,a)\leftarrow Q(s,a)+\alpha\Big[r+\gamma \max_{a'}Q(s',a')-Q(s,a)\Big]
      $$
    - $s \leftarrow s'$
  - end for
- end for

其中$\epsilon$-greedy 是一种引入随机性的策略，每次贪心的选择最高Q的a，但是一定概率选择其他的a，来避免某些a永远得不到使用。
## DQN

如果状态空间是连续的，比如速度，位置等等，就不能用一张表来表达。Q可以看成是一个函数，而神经网络强大的拟合功能刚好适合做这个工作。

同样是拟合，对于${(s_i, a_i, r_i, s`_i)}$，可以很自然的将Q网络的损失函数构建为MSE：
$$
\omega^*=\arg\min_{\omega}\;\frac{1}{2N}\sum_{i=1}^{N}
\left[
Q_{\omega}(s_i,a_i)-\left(r_i+\gamma \max_{a'} Q_{\omega}(s'_i,a')\right)
\right]^2
$$

DQN 的区别在于拥有一个经验回放，和目标网络

### 经验回放

维护一个缓冲区，将每次从环境中采样得到的四元组${(s, a, r, s`)}$放入缓冲区内，训练时，直接在缓冲区内随机采样若干数据进行训练。


### 目标网络。

在DQN的损失函数里面，可以发现存在两个跟Q网络有关的项。从有监督的视角出发，ground truth 跟网络有关， 优化的目标时网络，两段都有Q，会导致网络不稳定。
引入目标网路的概念。`训练网络`正常更新，`目标网络`使用较旧的参数。

- 用随机的网络参数 $\omega$ 初始化当前网络 $Q_{\omega}(s,a)$
- 复制相同的参数 $\omega^- \leftarrow \omega$ 来初始化目标网络 $Q_{\omega^-}(s,a)$
- 初始化经验回放池 $R$
- for 序列 $e = 1 \rightarrow E$ do
  - 获取环境初始状态 $s_1$
  - for 时间步 $t = 1 \rightarrow T$ do
    - 根据当前网络 $Q_{\omega}(s,a)$ 以 $\epsilon$-贪婪策略选择动作 $a_t$
    - 执行动作 $a_t$，获得回报 $r_t$，环境状态变为 $s_{t+1}$
    - 将 $(s_t,a_t,r_t,s_{t+1})$ 存储进回放池 $R$ 中
    - 若 $R$ 中数据足够，从 $R$ 中采样 $N$ 个数据 $\{(s_i,a_i,r_i,s_{i+1})\}_{i=1,\ldots,N}$
    - 对每个数据，用目标网络计算目标值
      $$
      y_i = r_i + \gamma \max_{a} Q_{\omega^-}(s_{i+1},a)
      $$
    - 最小化损失
      $$
      L = \frac{1}{N}\sum_i \left(y_i - Q_{\omega}(s_i,a_i)\right)^2
      $$
      以此更新当前网络 $Q_{\omega}$
    - 更新目标网络（硬更新或软更新）
  - end for
- end for

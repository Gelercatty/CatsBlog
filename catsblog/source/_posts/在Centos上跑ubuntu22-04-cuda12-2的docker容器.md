---
title: 在Centos上跑ubuntu22.04+cuda12.2的docker容器
date: 2025-11-01 01:32:14
tags: linux
---

最近在做Gaussian相关的工作，虽然有init-free的Init方法，但总归绕不开MFS的集大成者——Colmap。colmap作为传统reconstruction的集大成者，已经能做到很好的点云生成。官方提供windows的GUI版本，以及预编译colmap的docker容器，但支持gpu加速的只有cuda12.9的版本。linux上建议使用docker部署编译。官方给的docker脚手架是针对ubuntu+cuda12.9的，实验室的4090只支持到12.2的cuda，而且还是centOS，几番折腾后投降。


查阅了一些资料后，发现是可以通过docker在centos上运行ubuntu容器的于是我希望能够在cenos上安装一个ubuntu容器，支持cuda12.2，这个有官方的镜像支持，在此容器中，从源码编译带12.9cuda支持的colmap


# 在Centos上跑ubuntu22.04+cuda12.2的docker容器

听上去有点反直觉，在CentOS上还能运行Ubuntu的系统，但这正是docker的精髓之处：用户态和系统态分离。


首先验证本机的nvidia-toolkit支持：

>nvidia-smi
记下cuda版本，这是宿主机器最高支持的cuda版本。


在docker image中![图片](https://images.geler.org/blog/d7/d72df5ecffc423dafb37.png)

确实存在12.2，且版本是22.04的镜像。

在宿主机器中运行


>docker run -d --name colmapfix --gpus all --ipc=host --restart unless-stopped \
>  -e NVIDIA_VISIBLE_DEVICES=all \
>  -e LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu \
>  -v colmapfix-home:/root -v colmapfix-ws:/workspace \
>  nvidia/cuda:12.2.0-runtime-ubuntu22.04 
按照你的需要调整 -v 绑定的docker工作区

![图片](https://images.geler.org/blog/e8/e8eb3bfe3076c78d3eea.png)
在容器中运行

>nvidia-smi
![图片](https://images.geler.org/blog/40/404ef7a9e884d375718b.png)
能看到宿主的gpu。


# 编译colmap

之后按照colmap官方指南编译，注意一些修改：[https://colmap.github.io/install.html#build-from-source](https://colmap.github.io/install.html#build-from-source)


>git clone [https://github.com/colmap/colmap](https://github.com/colmap/colmap)

>apt-get install \
>    git \
>    cmake \
>    ninja-build \
>    build-essential \
>    libboost-program-options-dev \
>    libboost-graph-dev \
>    libboost-system-dev \
>    libeigen3-dev \
>    libfreeimage-dev \
>    libmetis-dev \
>    libgoogle-glog-dev \
>    libgtest-dev \
>    libgmock-dev \
>    libsqlite3-dev \
>    libglew-dev \
>    qtbase5-dev \
>    libqt5opengl5-dev \
>    libcgal-dev \
>    libceres-dev \
>    libcurl4-openssl-dev \
>    libmkl-full-dev
注意在容器中不用使用sudo

我们的容器已经有cuda的支持了，所以官方这一步不要运行，否则会破坏我们的环境

![图片](https://images.geler.org/blog/c0/c0fa913f328950e21268.png)
准备好代码库

>git clone https://github.com/colmap/colmap.git
>cd colmap
>mkdir build
>cd build
检查当前使用的nvcc编译器路径：

>which nvcc

![图片](https://images.geler.org/blog/d1/d110a8fc3b90d1a02bb5.png)

明确的指定Cuda计算架构。自行百度自己显卡的架构，这里是4090，架构为89

指定nvcc编译器路径

由于在服务器上做数据处理，不需要gui，设置gui为off

>cmake .. -GNinja   -DBLA_VENDOR=Intel10_64lp   -DCMAKE_CUDA_ARCHITECTURES=89   -DCMAKE_CUDA_COMPILER=/usr/local/cuda/bin/nvcc
>-DGUI_ENABLED=OFF
看看是否运行成功

>colmap -h

如果遇到缺少qt5相关的动态依赖，请参考

WSL安装ROS2报错：libQt5Core.so.5: cannot open shared object file：

[https://blog.csdn.net/weixin_40837318/article/details/119305270](https://blog.csdn.net/weixin_40837318/article/details/119305270)


![图片](https://images.geler.org/blog/5a/5a3a060b42f15d36d045.png)

Enjoy it!!


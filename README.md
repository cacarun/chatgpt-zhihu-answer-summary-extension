## 插件说明

用 ChatGPT 回答和总结知乎的问题，作为问题答案的参考。

前提：
你需要有一个自己的 chatgpt 账号, 注册地址 https://chat.openai.com

主要功能：
1. 用 ChatGPT 回答问题。
2. 用 ChatGPT 总结部分用户的回答（受限于 ChatGPT 输入限制效果一般）。
3. 复制 ChatGPT 的回答。


## 插件安装

### chrome 应用商店安装

[点击安装](https://chrome.google.com/webstore/detail/chatgpt-for-zhihu-answer/odancjbkgpejldfefcloihopaoeefppe)

### 本地安装

1. 下载 `*.zip` from [Releases](https://github.com/cacarun/chatgpt-zhihu-answer-summary-extension/releases)
2. 解压 zip
3. 打开网址 `chrome://extensions`
4. 打开开发者模式
5. 将解压包拖到当前页面，或者手动引入也可以

## 本地构建

1. clone
2. 运行命令 `npm install`
3. 执行 `./build.sh`
4. 加载 `build` 文件夹到你的 chrome 中

## TODO

- [ ] 优化 ChatGPT 总结回答能力
- [ ] 支持 GPT3 API
- [ ] 支持 prompt 选择


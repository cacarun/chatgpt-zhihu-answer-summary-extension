import Browser from "webextension-polyfill";

var port

const zhTitle =
  document.querySelector(".QuestionHeader-title")?.textContent || "";
const zhSubTitle = document.querySelector(".QuestionRichText")?.textContent || "";

function requestChatGPT(btnType) {
  var curUrl = window.location.href;
  let params = { 
    type: btnType,
    url: curUrl,
    title: zhTitle,
    subTitle: zhSubTitle 
  }
  console.log('params:', params);
  port.postMessage(params);
}

async function run() {
  const theme = document.documentElement.dataset.theme;
  let container = document.querySelector("div.chat-gpt-zhihu");
  if (container) {
    container.remove();
  }
  container = document.createElement("div");
  container.classList.add("chat-gpt-zhihu");
  if (theme === "dark") {
    container.classList.add("dark");
  }
  const customButton = `
    <div class="chat-gpt-zhihu-icon-container">
      <div class="chat-gpt-zhihu-header-icon answer">回答</div>
      <div class="chat-gpt-zhihu-header-icon summary">总结</div>
      <div class="chat-gpt-zhihu-header-icon copy">复制</div>
    </div>
  `;

  container.innerHTML = `
    <div class="chat-gpt-zhihu-header">
      <div class="chat-gpt-zhihu-header-text">ChatGPT</div>
      ${customButton}
    </div>
    <div class="chat-gpt-zhihu-answer"></div>
  `;

  const firstCard = document.querySelector(".Question-sideColumn .Card");
  if (!firstCard) {
    setTimeout(() => {
      run();
    }, 500);
    return;
  }
  firstCard.parentNode.insertBefore(container, firstCard);

  let content = container.querySelector(".chat-gpt-zhihu-answer")

  container
    .querySelector(".chat-gpt-zhihu-header-icon.answer")
    .addEventListener("click", async (e) => {
      content.innerHTML = "正在等待 ChatGPT 回答...";
      requestChatGPT('answer');
    });
  
  container
    .querySelector(".chat-gpt-zhihu-header-icon.summary")
    .addEventListener("click", async (e) => {
      content.innerHTML = "正在等待 ChatGPT 总结...";
      requestChatGPT('summary');
    });

  container
    .querySelector(".chat-gpt-zhihu-header-icon.copy")
    .addEventListener("click", async (e) => {
      await navigator.clipboard.writeText(answer);
      // e.target.style.display = "none";
      // container.querySelector(
      //   ".chat-gpt-zhihu-header-icon.ok"
      // ).style.display = "inline-block";
    });

  let answer = "";

  port = Browser.runtime.connect();
  port.onMessage.addListener(function (msg) {

    console.log("onMessage answer", msg);

    if (msg.answer) {
      answer = msg.answer;
      answer = answer.replace(/^\n\n/, '');
      content.innerHTML = answer;
    } else if (msg.error === "UNAUTHORIZED") {
      content.innerHTML = `1、检查 <a href="https://chat.openai.com" target="_blank" style="text-decoration: underline;">chat.openai.com</a> 登录状态<br />2、重新点击 [回答] 或 [总结]`;
    }  else if (msg.error.includes("network error")) {
      content.innerHTML = `ChatGPT 网络异常, 请重新点击 [回答] 或 [总结]!`;
    } else {
      if (answer === "") {
        content.innerHTML = "无法从 ChatGPT 获取回答, 请重新点击 [回答] 或 [总结]!";
      }
    }
  });
}

window.onload = function () {
  run();
};

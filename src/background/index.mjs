import ExpiryMap from "expiry-map";
import { v4 as uuidv4 } from "uuid";
import Browser from "webextension-polyfill";
import { fetchSSE } from "./fetch-sse.mjs";
import cheerio from "cheerio";

const KEY_ACCESS_TOKEN = "accessToken";

const cache = new ExpiryMap(10 * 1000);

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
};

var zhUrl = "";
var zhTitle = "";
var zhSubTitle = "";
var zhAnswerDict = {};

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN);
  }
  const data = await fetch("https://chat.openai.com/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (!data.accessToken) {
    throw new Error("UNAUTHORIZED");
  }
  cache.set(KEY_ACCESS_TOKEN, data.accessToken);
  return data.accessToken;
}

async function getAnswer(port, question) {
  const accessToken = await getAccessToken();

  const controller = new AbortController();
  port.onDisconnect.addListener(() => {
    console.error("onDisconnect...");
    controller.abort();
  });
  console.log("question", question);

  await fetchSSE("https://chat.openai.com/backend-api/conversation", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: "next",
      messages: [
        {
          id: uuidv4(),
          role: "user",
          content: {
            content_type: "text",
            parts: [question],
          },
        },
      ],
      model: "text-davinci-002-render",
      // model: "text-davinci-002-render-next",
      parent_message_id: uuidv4(),
    }),
    onMessage(message) {
      console.info("sse message", message);
      if (message === "[DONE]") {
        // port.postMessage({ event: "DONE" });
        // deleteConversation();
        return;
      }

      let data = "";
      try {
        data = JSON.parse(message);
      } catch (err) {
        console.error("sse message error", err);
      }

      const text = data.message?.content?.parts?.[0];
      // conversationId = data.conversation_id;
      if (text) {
        port.postMessage({
          answer: text,
          // messageId: data.message.id,
          // conversationId: data.conversation_id,
        });
      }
    },
  });
}

async function requestZhihuData() {
  try {
    const response = await fetch(zhUrl, { headers });
    const html = await response.text();

    const loadHtml = cheerio.load(html);
    const scriptContent = loadHtml('#js-initialData').html();
    const initialData = JSON.parse(scriptContent);
    const initialState = initialData.initialState;

    const questionId = zhUrl.match(/\/question\/(\d+)/)[1];

    console.log('[requestZhihuData] initialData:', initialData, 'questionId:', questionId);

    var title = initialState.entities.questions[questionId].title;
    if (title && title.trim().length > 0) {
      zhTitle = title;
    }
    var subTitle = initialState.entities.questions[questionId].detail;
    if (subTitle && subTitle.trim().length > 0) {
      console.log('[requestZhihuData] before subTitle:', subTitle);
      zhSubTitle = cheerio.load(subTitle).text();
    }
    console.log('[requestZhihuData] title:', zhTitle, ' subTitle:', zhSubTitle);

    const answers = initialState.entities.answers;
    Object.keys(answers).forEach((key) => {
      var answer = answers[key].content
      console.log('[requestZhihuData] before answer:', answer);
      answer = cheerio.load(answer).text();
      console.log('[requestZhihuData] after answer:', answer);
      zhAnswerDict[key] = answer;
    });
    console.log('[requestZhihuData] zhAnswerDict:', zhAnswerDict);

  } catch (error) {
    console.error(error);
  }
}


Browser.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg) => {
    console.log("received msg", msg);

    zhUrl = msg.url
    zhTitle = msg.title;
    zhSubTitle = msg.subTitle;
    zhAnswerDict = {};

    await requestZhihuData()
    // await getTopAnswers(msg.url).then((topAnswers) => {
    //   console.log(topAnswers);
    // });

    var input = ""
    if (msg.type === 'answer') {
      input = `${zhTitle} ${zhSubTitle}`
    } else if (msg.type === 'summary') {

    }
    try {
      await getAnswer(port, input);
    } catch (err) {
      console.error("catch error", err);
      port.postMessage({ error: err.message });
      cache.delete(KEY_ACCESS_TOKEN);
    }
  });
});



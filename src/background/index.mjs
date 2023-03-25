import ExpiryMap from "expiry-map";
import { v4 as uuidv4 } from "uuid";
import Browser from "webextension-polyfill";
import { fetchSSE } from "./fetch-sse.mjs";
import cheerio from "cheerio";
import { getSummaryPrompt } from "./prompt.mjs";

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

async function requestBackendAPI(token, method, path, data) {
  return fetch(`https://chat.openai.com/backend-api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
}

async function fetchModels(token) {
  const resp = await requestBackendAPI(token, 'GET', '/models').then((r) => r.json())
  return resp.models
}

async function getModelName(token) {
  try {
    const models = await fetchModels(token)    
    return models[0].slug
  } catch (err) {
    console.error(err)
    return 'text-davinci-002-render-sha'
  }
}

async function setConversationProperty(
  token,
  conversationId,
  propertyObject
) {
  await requestBackendAPI(token, 'PATCH', `/conversation/${conversationId}`, propertyObject)
}

async function getAnswer(port, prompt) {
  const accessToken = await getAccessToken();

  let conversationId = ""

  const cleanup = () => {
    if (conversationId && conversationId.trim().length > 0) {
      console.log("[cleanup] conversationId=", conversationId)
      setConversationProperty(accessToken, conversationId, { is_visible: false })
    }
  }

  const controller = new AbortController();
  port.onDisconnect.addListener(() => {
    console.error("onDisconnect...");
    controller.abort();
  });
  console.log("[getAnswer] prompt=", prompt);

  const modelName = await getModelName(accessToken)
  console.log('[getAnswer] modelName=', modelName);

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
            parts: [prompt],
          },
        },
      ],
      model: modelName,
      parent_message_id: uuidv4(),
    }),
    onMessage(message) {
      console.info("[getAnswer] sse message", message);
      if (message === "[DONE]") {
        cleanup()
        return;
      }

      let data = "";
      try {
        data = JSON.parse(message);
      } catch (err) {
        console.error("[getAnswer] sse message error", err);
      }

      const text = data.message?.content?.parts?.[0];
      conversationId = data.conversation_id
      if (text) {
        port.postMessage({
          answer: text
        });
      }
    },
  });

  return { cleanup }
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

function getPrompt(title, answerDict) {
  const text = Object.values(answerDict).join(" ");
  const prompt = getSummaryPrompt(text);
  console.log('[getPrompt] prompt=', prompt)

  const queryText = `
说明：请用中文总结以下内容。
标题：${title}
内容：${prompt}`

  console.log('[getPrompt] queryText=', queryText)
  return queryText;
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
      console.log("[answer] input=", input)
    } else if (msg.type === 'summary') {
      input = getPrompt(zhTitle, zhAnswerDict)
      console.log("[summary] input prompt=", input)
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



import GPT3Tokenizer from 'gpt3-tokenizer'
const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })

export function getSummaryPrompt(transcript) {
  const text = transcript
    ? transcript
        .replace(/(\r\n)+/g, '\r\n')
        .replace(/(\s{2,})/g, ' ')
        .replace(/^(\s)+|(\s)$/g, '')
    : ''

  return truncateTranscript(text)
}

// Seems like 15,000 bytes is the limit for the prompt
const textLimit = 14000
const limit = 1100 // 1000 is a buffer
const apiLimit = 2000

export function getChunckedTranscripts(textData, textDataOriginal) {
  // [Thought Process]
  // (1) If text is longer than limit, then split it into chunks (even numbered chunks)
  // (2) Repeat until it's under limit
  // (3) Then, try to fill the remaining space with some text
  // (eg. 15,000 => 7,500 is too much chuncked, so fill the rest with some text)

  let result = ''
  const text = textData
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  const bytes = textToBinaryString(text).length

  if (bytes > limit) {
    // Get only even numbered chunks from textArr
    const evenTextData = textData.filter((t, i) => i % 2 === 0)
    result = getChunckedTranscripts(evenTextData, textDataOriginal)
  } else {
    // Check if any array items can be added to result to make it under limit but really close to it
    if (textDataOriginal.length !== textData.length) {
      textDataOriginal.forEach((obj, i) => {
        if (textData.some((t) => t.text === obj.text)) {
          return
        }

        textData.push(obj)

        const newText = textData
          .sort((a, b) => a.index - b.index)
          .map((t) => t.text)
          .join(' ')
        const newBytes = textToBinaryString(newText).length

        if (newBytes < limit) {
          const nextText = textDataOriginal[i + 1]
          const nextTextBytes = textToBinaryString(nextText.text).length

          if (newBytes + nextTextBytes > limit) {
            const overRate = (newBytes + nextTextBytes - limit) / nextTextBytes
            const chunkedText = nextText.text.substring(
              0,
              Math.floor(nextText.text.length * overRate),
            )
            textData.push({ text: chunkedText, index: nextText.index })
            result = textData
              .sort((a, b) => a.index - b.index)
              .map((t) => t.text)
              .join(' ')
          } else {
            result = newText
          }
        }
      })
    } else {
      result = text
    }
  }

  const originalText = textDataOriginal
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  return result == '' ? originalText : result // Just in case the result is empty
}

function truncateTranscript(str) {
  let textStr = str

  const textBytes = textToBinaryString(str).length
  if (textBytes > textLimit) {
    const ratio = textLimit / textBytes
    const newStr = str.substring(0, str.length * ratio)
    textStr = newStr
  }

  const tokenLimit = limit

  const encoded = tokenizer.encode(textStr)
  const bytes = encoded.bpe.length

  if (bytes > tokenLimit) {
    const ratio = tokenLimit / bytes
    const newStr = textStr.substring(0, textStr.length * ratio)

    return newStr
  }

  return textStr
  // } else {
  //   const bytes = textToBinaryString(str).length
  //   if (bytes > tokenLimit) {
  //     const ratio = tokenLimit / bytes
  //     const newStr = str.substring(0, str.length * ratio)
  //     return newStr
  //   }
  //   return str
  // }
}

function truncateTranscriptByToken(str, providerConfigs) {
  const tokenLimit = providerConfigs === ProviderType.GPT3 ? apiLimit : limit

  // if (providerConfigs === ProviderType.GPT3) {
  const encoded = tokenizer.encode(str)
  const bytes = encoded.bpe.length

  if (bytes > tokenLimit) {
    const ratio = tokenLimit / bytes
    const newStr = str.substring(0, str.length * ratio)

    return newStr
  }

  return str
}

export function textToBinaryString(str) {
  const escstr = decodeURIComponent(encodeURIComponent(escape(str)))
  const binstr = escstr.replace(/%([0-9A-F]{2})/gi, function (match, hex) {
    const i = parseInt(hex, 16)
    return String.fromCharCode(i)
  })
  return binstr
}



// export function getSummaryPrompt(title, transcript, byteLimit) {
//   const truncatedTranscript = limitTranscriptByteLength(transcript, byteLimit);
//   return `标题: "${title.replace(/\n+/g, " ").trim()}"\n字幕: "${truncatedTranscript.replace(/\n+/g, " ").trim()}"\n中文总结:`;
// }

// export function limitTranscriptByteLength(str, byteLimit) {
//   const utf8str = unescape(encodeURIComponent(str));
//   const byteLength = utf8str.length;
//   if (byteLength > byteLimit) {
//     const ratio = byteLimit / byteLength;
//     const newStr = str.substring(0, Math.floor(str.length * ratio));
//     return newStr;
//   }
//   return str;
// }
// function filterHalfRandomly<T>(arr: T[]): T[] {
//   const filteredArr: T[] = [];
//   const halfLength = Math.floor(arr.length / 2);
//   const indicesToFilter = new Set<number>();

//   // 随机生成要过滤掉的元素的下标
//   while (indicesToFilter.size < halfLength) {
//     const index = Math.floor(Math.random() * arr.length);
//     if (!indicesToFilter.has(index)) {
//       indicesToFilter.add(index);
//     }
//   }

//   // 过滤掉要过滤的元素
//   for (let i = 0; i < arr.length; i++) {
//     if (!indicesToFilter.has(i)) {
//       filteredArr.push(arr[i]);
//     }
//   }

//   return filteredArr;
// }
// function getByteLength(text: string) {
//   return unescape(encodeURIComponent(text)).length;
// }

// function itemInIt(textData: SubtitleItem[], text: string): boolean {
//   return textData.find(t => t.text === text) !== undefined;
// }


// export function getSmallSizeTranscripts(newTextData, oldTextData, byteLimit) {
//   const text = Object.values(newTextData).join("\n\n");
//   const byteLength = getByteLength(text);

//   if (byteLength > byteLimit) {
//     const filtedData = filterHalfRandomly(newTextData);
//     return getSmallSizeTranscripts(filtedData, oldTextData, byteLimit);
//   }

//   let resultData = newTextData.slice();
//   let resultText = text;
//   let lastByteLength = byteLength;

//   for (let i = 0; i < oldTextData.length; i++) {
//     const obj = oldTextData[i];
//     if (itemInIt(newTextData, obj.text)) {
//       continue;
//     }

//     const nextTextByteLength = getByteLength(obj.text);
//     const isOverLimit = lastByteLength + nextTextByteLength > byteLimit;
//     if (isOverLimit) {
//       const overRate = (lastByteLength + nextTextByteLength - byteLimit) / nextTextByteLength;
//       const chunkedText = obj.text.substring(0, Math.floor(obj.text.length * overRate));
//       resultData.push({ text: chunkedText, index: obj.index });
//     } else {
//       resultData.push(obj);
//     }
//     resultText = resultData.sort((a, b) => a.index - b.index).map(t => t.text).join(" ");
//     lastByteLength = getByteLength(resultText);
//   }

//   return resultText;
// }
  
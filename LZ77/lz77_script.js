const encodeBtn = document.getElementById("encodeBtn");
const decodeBtn = document.getElementById("decodeBtn");

const inputText = document.getElementById("inputText");
const dictSizeInput = document.getElementById("dictSize");
const bufferSizeInput = document.getElementById("bufferSize");

const tokensBody = document.getElementById("tokensBody");
const decodedText = document.getElementById("decodedText");
const validation = document.getElementById("validation");
const windowView = document.getElementById("windowView");
const stats = document.getElementById("stats");

let encodedTokens = [];

function findLongestMatch(data, currentPosition, dictSize, bufferSize) {

  let bestMatchDistance = 0;
  let bestMatchLength = 0;

  const dictionaryStart = Math.max(0, currentPosition - dictSize);

  for (let i = dictionaryStart; i < currentPosition; i++) {

    let length = 0;

    while (
      length < bufferSize &&
      currentPosition + length < data.length &&
      data[i + length] === data[currentPosition + length]
    ) {
      length++;
    }

    if (length > bestMatchLength) {
      bestMatchLength = length;
      bestMatchDistance = currentPosition - i;
    }
  }

  return {
    offset: bestMatchDistance,
    length: bestMatchLength
  };
}

function encodeLZ77(data, dictSize, bufferSize) {

  const tokens = [];
  const steps = [];

  let position = 0;

  while (position < data.length) {

    const match = findLongestMatch(
      data,
      position,
      dictSize,
      bufferSize
    );

    const nextChar = data[position + match.length] || "";

    const matchStart = Math.max(0, position - match.offset);
    const matchEnd = matchStart + Math.min(match.length, dictSize);

    const prefix = data.slice(0, matchStart);

    const dictionaryMatch = data.slice(
      matchStart,
      Math.min(position, matchEnd)
    );

    const middle = data.slice(
      Math.min(position, matchEnd),
      position
    );

    const bufferMatch = data.slice(
      position,
      Math.min(position + match.length, data.length)
    );

    const postfix = data.slice(
      Math.min(position + match.length, data.length),
      data.length
    );


    steps.push({
      prefix,
      dictionaryMatch,
      middle,
      bufferMatch,
      postfix,
      token: {
        offset: match.offset,
        length: match.length,
        nextChar
      }
    });

    tokens.push({
      offset: match.offset,
      length: match.length,
      nextChar
    });

    position += match.length + 1;
  }

  renderSteps(steps);

  return tokens;
}

function renderSteps(steps) {

  windowView.innerHTML = "";

  steps.forEach((step, index) => {

    const stepDiv = document.createElement("div");

    stepDiv.className = "step";

    stepDiv.innerHTML = `
    <div class="step-title">
      Шаг ${index + 1}
    </div>

    <div class="step-window">

      ${step.prefix
        ? `
          <span class="regular">
            ${step.prefix}
          </span>
        `
        : ""
      }

      ${step.dictionaryMatch
        ? `
          <span class="match">
            ${step.dictionaryMatch}
          </span>
        `
        : ""
      }

      ${step.middle
        ? `
          <span class="regular">
            ${step.middle}
          </span>
        `
        : ""
      }

      ${step.bufferMatch
        ? `
          <span class="buffer">
            ${step.bufferMatch}
          </span>
        `
        : ""
      }

      ${step.postfix
        ? `
          <span class="regular">
            ${step.postfix}
          </span>
        `
        : ""
      }

    </div>

    <div class="token-info">
      Токен:
      (
        ${step.token.offset},
        ${step.token.length},
        ${step.token.nextChar || "∅"}
      )
    </div>
    `;
    windowView.appendChild(stepDiv);
  });
}

// Декодирование
function decodeLZ77(tokens) {

  let output = ""; // Накапливаем вывод

  for (const token of tokens) {

    if (token.length !== 0) { // Если требуется копировать
      
      const start = output.length - token.offset; // Идем назад

      for (let i = 0; i < token.length; i++) {
        output += output[start + i]; // Копируем пока не наберем указанную длину
      }
    
    }

    output += token.nextChar;
  }

  return output;
}

function renderTokens(tokens) {

  tokensBody.innerHTML = "";

  tokens.forEach((token, index) => {

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${token.offset}</td>
      <td>${token.length}</td>
      <td>${token.nextChar || "∅"}</td>
    `;

    tokensBody.appendChild(row);
  });
}

/*function renderWindow(data, dictSize, bufferSize) {

  const dictionary = data.slice(0, dictSize);
  const buffer = data.slice(dictSize, dictSize + bufferSize);

  windowView.innerHTML = `
    <span class="dictionary">${dictionary}</span>
    <span class="buffer">${buffer}</span>
  `;
}*/

function renderStats(original, tokens) {

  const originalSize = original.length;

  const compressedSize = tokens.length * 3;

  const ratio = (
    (1 - compressedSize / originalSize) * 100
  ).toFixed(2);

  stats.innerHTML = `
    Размер исходных данных: ${originalSize} символов<br>
    Размер сжатых данных (в единицах токенов): ${tokens.length}<br>
    Оценочный размер сжатых данных (в эквиваленте символов): ${compressedSize}<br>
    Коэффициент сжатия: ${ratio}%
  `;
}

encodeBtn.addEventListener("click", () => {

  const text = inputText.value;

  const dictSize = parseInt(dictSizeInput.value);
  const bufferSize = parseInt(bufferSizeInput.value);

  encodedTokens = encodeLZ77(
    text,
    dictSize,
    bufferSize
  );

  renderTokens(encodedTokens);

  renderStats(text, encodedTokens);

  decodedText.innerHTML = "";
  validation.innerHTML = "";
});

decodeBtn.addEventListener("click", () => {

  const decoded = decodeLZ77(encodedTokens);

  decodedText.innerHTML = decoded;

  if (decoded === inputText.value) {
    validation.innerHTML = "✅ Восстановленные данные совпадают с исходными";
  } else {
    validation.innerHTML = "❌ Восстановленные данные не совпадают с исходными";
  }
});
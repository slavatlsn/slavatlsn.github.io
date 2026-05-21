function renderSteps(steps) {

  const container =
    document.getElementById("stepsContainer");

  container.innerHTML = "";

  steps.forEach(step => {

    const div = document.createElement("div");

    div.className = "step";

    div.innerHTML = `
      <div class="step-title">
        ${step.title}
      </div>

      <div class="math">
        ${step.math}
      </div>

      <div class="explanation">
        ${step.explanation}
      </div>
    `;

    container.appendChild(div);
  });
}

function renderKeys(result) {

  const keysInfo =
    document.getElementById("keysInfo");

  keysInfo.innerHTML = `
    <div class="result">
      Открытый ключ: (${result.publicKey.e}, ${result.publicKey.n})
    </div>

    <div class="result">
      Закрытый ключ: (${result.privateKey.d}, ${result.privateKey.n})
    </div>
  `;
}

function renderEncryption(result) {

  const encryptionInfo =
    document.getElementById("encryptionInfo");

  encryptionInfo.innerHTML = `
    <div class="result">
      Исходное сообщение: ${result.decrypted}
    </div>

    <div class="result">
      Зашифрованное сообщение: ${result.encrypted}
    </div>

    <div class="result">
      Расшифрованное сообщение: ${result.decrypted}
    </div>
  `;
}
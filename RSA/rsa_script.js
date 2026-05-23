const generateBtn =
  document.getElementById("generateBtn");

generateBtn.addEventListener("click", () => {

  try {

    const p = BigInt(
      document.getElementById("pInput").value
    );

    const q = BigInt(
      document.getElementById("qInput").value
    );

    const message = BigInt(
      document.getElementById("messageInput").value
    );

    const result =
      generateRSA(p, q, message);

    renderSteps(result.steps);

    renderKeys(result);

    renderEncryption(message, result);

  } catch (error) {

    alert(error.message);
  }
});

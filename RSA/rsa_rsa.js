function generateRSA(p, q, message) {

  const steps = [];

  if (!isPrime(p) || !isPrime(q)) {
    throw new Error("p и q должны быть простыми числами");
  }

  steps.push({
    title: "Шаг 1 — Простые числа",
    math: `p = ${p}, q = ${q}`,
    explanation:
      "RSA начинается с выбора двух простых чисел."
  });

  const n = p * q;

  steps.push({
    title: "Шаг 2 — Вычисление n",
    math: `n = p × q = ${n}`,
    explanation:
      "Модуль n используется как в открытом, так и в закрытом ключе."
  });

  const phi = (p - 1n) * (q - 1n);

  steps.push({
    title: "Шаг 3 — Функция Эйлера",
    math: `φ(n) = (${p}-1)(${q}-1) = ${phi}`,
    explanation:
      "Функция Эйлера показывает количество чисел, взаимно простых с n."
  });

  let e = 3n;

  while (gcd(e, phi) !== 1n) {
    e += 2n;
  }

  steps.push({
    title: "Шаг 4 — Выбор открытой экспоненты e",
    math: `e = ${e}`,
    explanation:
      `Число выбрано, потому что gcd(${e}, ${phi}) = 1`
  });

  const d = modInverse(e, phi);

  steps.push({
    title: "Шаг 5 — Вычисление закрытой экспоненты d",
    math: `d = ${d}`,
    explanation:
      `Потому что (${e} × ${d}) mod ${phi} = 1`
  });

  const encrypted = modPow(message, e, n);

  steps.push({
    title: "Шаг 6 — Шифрование сообщения",
    math: `c = ${message}^${e} mod ${n} = ${encrypted}`,
    explanation:
      "Шифр создается с помощью открытого ключа."
  });

  const decrypted = modPow(encrypted, d, n);

  steps.push({
    title: "Шаг 7 — Расшифровка сообщения",
    math: `m = ${encrypted}^${d} mod ${n} = ${decrypted}`,
    explanation:
      "Исходное сообщение восстанавливается с помощью закрытого ключа."
  });

  return {
    steps,
    publicKey: {
      e,
      n
    },
    privateKey: {
      d,
      n
    },
    encrypted,
    decrypted
  };
}
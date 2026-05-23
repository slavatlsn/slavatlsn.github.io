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
    "Функция Эйлера показывает количество чисел, взаимно простых с n.",

  extra: `
  <div class="extra-box">
    Рассмотрим все числа от 1 до p × q.<br><br>

    Исключим числа, которые не взаимно просты с n = p × q:<br>
    кратные p и кратные q.<br><br>

    Кратные p: их q штук (p, 2p, ..., qp)<br>
    Кратные q: их p штук (q, 2q, ..., pq)<br>
    Пересечение этих двух множеств: p × q (одно число)<br><br>

    По формуле включений-исключений:<br>
    φ(n) = p × q − p − q + 1<br><br>

    Любое число, делящееся на p или q, мы исключили.<br>
    Других простых делителей у n нет, так как n = p × q и p, q — простые.<br><br>

    Значит оставшиеся числа не имеют общих делителей с n,<br>
    кроме 1, то есть являются взаимно простыми с n.<br><br>

    Итог:<br>
    φ(n) = (p − 1) × (q − 1)
  </div>
`
});

  let e = 3n;

  while (gcd(e, phi) !== 1n) {
    e += 2n;
  }

  steps.push({
    title: "Шаг 4 — Выбор открытой экспоненты e",
    math: `e = ${e}`,
    explanation:
  `Должно выполняться: gcd(e, φ(n)) = 1`
  });

  const d = modInverse(e, phi);

  steps.push({
  title: "Шаг 5 — Вычисление закрытой экспоненты d",
  math: `d = ${d}`,
  explanation:
  `Должно выполняться e × d ≡ 1 (mod φ(n))`,

  extra: `
  <div class="extra-box">
    Начинаем с условия обратимости:<br>
    e·d ≡ 1 (mod φ(n))<br><br>

    По определению модульной арифметики это значит:<br>
    e·d = φ(n)·k + 1<br><br>

    Переносим всё в одну сторону:<br>
    e·d − φ(n)·k = 1<br><br>

    Это уже диофантово уравнение.<br><br>

    Его решают с помощью расширенного алгоритма Евклида относительно переменных k и d.
  </div>
`
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

function gcd(a, b) {

  while (b !== 0n) {
    const temp = b;
    b = a % b;
    a = temp;
  }

  return a;
}

function modPow(base, exponent, modulus) {

  if (modulus === 1n) return 0n;

  let result = 1n;

  base = base % modulus;

  while (exponent > 0n) {

    if (exponent % 2n === 1n) {
      result = (result * base) % modulus;
    }

    exponent = exponent >> 1n;

    base = (base * base) % modulus;
  }

  return result;
}

function extendedGCD(a, b) {

  if (b === 0n) {
    return {
      gcd: a,
      x: 1n,
      y: 0n
    };
  }

  const result = extendedGCD(b, a % b);

  return {
    gcd: result.gcd,
    x: result.y,
    y: result.x - (a / b) * result.y
  };
}

function modInverse(e, phi) {

  const result = extendedGCD(e, phi);

  if (result.gcd !== 1n) {
    throw new Error("Modular inverse does not exist");
  }

  return ((result.x % phi) + phi) % phi;
}

function isPrime(n) {

  if (n < 2n) return false;

  for (let i = 2n; i * i <= n; i++) {
    if (n % i === 0n) {
      return false;
    }
  }

  return true;
}
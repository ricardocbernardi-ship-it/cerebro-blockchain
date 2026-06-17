const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

console.log("=".repeat(60));
console.log("  CEREBRO BLOCKCHAIN — PROCESSO DE MINERACAO AO VIVO");
console.log("=".repeat(60));

// Simular exatamente o que o CEREBRO faz
const previousHash = "0000fe2097f04fa345dde9b4920e50198ead12752ccfd20343cede831392b0c0";
const timestamp    = Date.now();
const transactions = JSON.stringify([{ from: "RECOMPENSA", to: "SUA_CARTEIRA", amount: 3.125 }]);
const difficulty   = 4;
const alvo         = "0".repeat(difficulty);

console.log("\n📋 DADOS DO BLOCO A SER MINERADO:");
console.log("   Hash anterior : " + previousHash.substring(0,32) + "...");
console.log("   Timestamp     : " + timestamp);
console.log("   Transacoes    : " + transactions);
console.log("   Dificuldade   : " + difficulty + " zeros");
console.log("   Alvo          : " + alvo + "...");

console.log("\n⛏️  INICIANDO MINERACAO — testando nonces...\n");

let nonce = 0;
let encontrado = false;
const inicio = Date.now();
const logInterval = [];

while (!encontrado) {
  nonce++;
  const dados = previousHash + timestamp + transactions + nonce;
  const hash = sha256(dados);

  // Mostrar as primeiras 20 tentativas
  if (nonce <= 20) {
    const zerosCount = hash.match(/^0+/)?.[0]?.length || 0;
    const emoji = zerosCount >= difficulty ? "✅" : zerosCount === difficulty-1 ? "🔥" : zerosCount === difficulty-2 ? "🟡" : "❌";
    console.log("   nonce=" + String(nonce).padStart(6) + " | " + hash.substring(0,40) + "... " + emoji);
  }

  // Mostrar a cada 10000 tentativas
  if (nonce > 20 && nonce % 10000 === 0) {
    const elapsed = ((Date.now() - inicio) / 1000).toFixed(1);
    const hashrate = Math.round(nonce / ((Date.now() - inicio) * 1e-3));
    console.log("   nonce=" + String(nonce).padStart(6) + " | " + hash.substring(0,32) + "...  [" + elapsed + "s | " + hashrate.toLocaleString() + " H/s]");
  }

  if (hash.startsWith(alvo)) {
    const elapsed = ((Date.now() - inicio) / 1000).toFixed(3);
    const hashrate = Math.round(nonce / parseFloat(elapsed));
    console.log("\n" + "=".repeat(60));
    console.log("  🎉 BLOCO ENCONTRADO!");
    console.log("=".repeat(60));
    console.log("  Nonce vencedor  : " + nonce.toLocaleString("pt-BR"));
    console.log("  Hash encontrado : " + hash);
    console.log("  Zeros iniciais  : " + (hash.match(/^0+/)?.[0] || "").length);
    console.log("  Tempo total     : " + elapsed + " segundos");
    console.log("  Hashrate medio  : " + hashrate.toLocaleString("pt-BR") + " hashes/segundo");
    console.log("  Recompensa      : 3.125 CBR depositados na carteira");
    console.log("=".repeat(60));
    encontrado = true;
  }
}

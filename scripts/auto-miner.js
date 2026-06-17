/**
 * CEREBRO Auto-Miner
 * Minera blocos automaticamente enquanto houver transações pendentes
 * Uso: node scripts/auto-miner.js
 * Env: REWARD_ADDRESS=<seu endereço>, INTERVAL_MS=5000
 */
const http = require("http");

const REWARD = process.env.REWARD_ADDRESS || "04c75840724a4fdc4abc9f3d445f712d18fcad0ce08ca322199c4b6e41cdd829b18dcfc0adadafefd7b7d3d3d0b803c6200aa6abcb023074a04f12d5c006d6b5e3";
const INTERVAL = parseInt(process.env.INTERVAL_MS) || 8000;
const API = process.env.API_URL || "http://localhost:3001";

let totalBlocos = 0;
let totalCBR = 0;
let ultimoBloco = null;

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(API + path);
    const opts = { hostname: url.hostname, port: url.port || 3001, path: url.pathname, method, headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } };
    const r = http.request(opts, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
    r.on("error", () => resolve({}));
    if (data) r.write(data);
    r.end();
  });
}

async function verificarEMinerar() {
  const pending = await req("GET", "/api/pending");
  const stats = await req("GET", "/api/stats");

  const hora = new Date().toLocaleTimeString("pt-BR");

  if (pending.total > 0) {
    const result = await req("POST", "/api/mine", { rewardAddress: REWARD });
    if (result.ok) {
      totalBlocos++;
      const recompensa = stats.recompensaAtual || 50;
      totalCBR += recompensa;
      ultimoBloco = result.bloco;
      console.log(`[${hora}] ⛏️  Bloco #${result.bloco} minerado! +${recompensa} CBR | Total: ${totalCBR} CBR em ${totalBlocos} blocos`);
    }
  } else {
    if (totalBlocos % 10 === 0) {
      console.log(`[${hora}] 💤 Aguardando transações... (Blocos: ${stats.blocos || 0} | Supply: ${stats.supplyTotal || 0} CBR)`);
    }
  }
}

console.log("╔═══════════════════════════════════╗");
console.log("║   CEREBRO AUTO-MINER              ║");
console.log("╚═══════════════════════════════════╝");
console.log(`  Carteira: ${REWARD.slice(0, 20)}...`);
console.log(`  Intervalo: ${INTERVAL}ms`);
console.log(`  API: ${API}`);
console.log("  Pressione Ctrl+C para parar\n");

verificarEMinerar();
setInterval(verificarEMinerar, INTERVAL);

process.on("SIGINT", () => {
  console.log(`\n  Mineração encerrada. Total: ${totalBlocos} blocos, ${totalCBR} CBR ganhos.`);
  process.exit(0);
});

const https = require("https");
const http = require("http");

const BASE = "http://localhost:3001";

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": data.length }
    }, res => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => resolve(JSON.parse(raw)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, res => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => resolve(JSON.parse(raw)));
    }).on("error", reject);
  });
}

async function minerar() {
  console.clear();
  console.log("=".repeat(55));
  console.log("   ⛏️  CEREBRO BLOCKCHAIN — MEU MINERADOR PESSOAL");
  console.log("=".repeat(55));

  // Criar carteira
  const w = await post("/api/wallet/new", {});
  const endereco = w.publicKey;
  console.log("\n✅ CARTEIRA CRIADA");
  console.log("   Endereço: " + endereco.substring(0, 35) + "...");
  console.log("\n🚀 MINERANDO... (Ctrl+C para parar)\n");

  let totalCBR = 0;
  let totalBlocos = 0;
  let inicio = Date.now();

  while (true) {
    try {
      const antes = Date.now();
      const mine = await post("/api/mine", { rewardAddress: endereco });
      if (mine.erro) {
        if (mine.erro.includes("Muitas")) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(mine.erro);
      }
      const tempo = Date.now() - antes;
      const recompensa = await get(`/api/balance/${endereco}`);
      totalBlocos++;
      totalCBR = recompensa.balance;

      const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(0);
      const blocosPorHora = Math.round(totalBlocos / (tempoTotal / 3600));

      console.log(
        `⛏️  BLOCO #${mine.bloco}` +
        ` | ${tempo}ms` +
        ` | hash: ${mine.hash.substring(0,20)}...` +
        ` | +CBR` +
        ` | TOTAL: ${totalCBR} CBR`
      );

      // Mostrar stats a cada 5 blocos
      if (totalBlocos % 5 === 0) {
        const stats = await get("/api/stats");
        console.log("\n" + "-".repeat(55));
        console.log(`📊 STATS: ${stats.blocos} blocos na chain | ${stats.supplyTotal} CBR em circulação`);
        console.log(`💰 VOCÊ TEM: ${totalCBR} CBR | ⏱️ ${tempoTotal}s rodando`);
        console.log("-".repeat(55) + "\n");
      }
    } catch(e) {
      console.log("⚠️  Erro: " + e.message + " — tentando novamente...");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

minerar();

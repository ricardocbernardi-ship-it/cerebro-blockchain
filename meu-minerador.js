/**
 * CEREBRO BLOCKCHAIN — MEU MINERADOR (PoW REAL)
 * CPU local calcula SHA-256 ate achar o hash com N zeros.
 * Igual Bitcoin de verdade.
 */
const crypto = require("crypto");
const http   = require("http");
const fs     = require("fs");

const BASE = "http://localhost:3001";

function request(method, path, body) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: "localhost", port: 3001, path: path, method: method,
      headers: { "Content-Type": "application/json" }
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    var r = http.request(opts, function(res) {
      var raw = "";
      res.on("data", function(d) { raw += d; });
      res.on("end", function() {
        try { resolve(JSON.parse(raw)); }
        catch(e) { reject(new Error("Resposta invalida")); }
      });
    });
    r.on("error", reject);
    r.setTimeout(30000, function() { r.destroy(); reject(new Error("Timeout")); });
    if (data) r.write(data);
    r.end();
  });
}

function esperar(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function carregarCarteira() {
  if (!fs.existsSync("minha-carteira.txt")) return null;
  var txt  = fs.readFileSync("minha-carteira.txt", "utf8");
  var rPub = txt.match(/Chave Publica[^:]*:\n(04[0-9a-f]+)/i);
  var rPrv = txt.match(/Chave Privada[^:]*:\n([0-9a-f]{64})/i);
  if (rPub && rPrv) return { publicKey: rPub[1], privateKey: rPrv[1] };
  return null;
}

function salvarCarteira(pub, priv) {
  fs.writeFileSync("minha-carteira.txt",
    "==================================================\n" +
    "  CEREBRO BLOCKCHAIN - MINHA CARTEIRA\n" +
    "==================================================\n\n" +
    "GUARDE ESTE ARQUIVO COM SEGURANCA!\n\n" +
    "Chave Publica (seu endereco CBR):\n" + pub + "\n\n" +
    "Chave Privada (NUNCA COMPARTILHE):\n" + priv + "\n\n" +
    "Criada em: " + new Date().toLocaleString("pt-BR") + "\n"
  );
}

function fazerPoW(template) {
  var alvo     = "0".repeat(template.difficulty);
  var txStr    = JSON.stringify(template.transactions);
  var nonce    = 0;
  var hash     = "";
  var inicio   = Date.now();

  while (true) {
    hash = crypto.createHash("sha256")
      .update(template.previousHash + template.timestamp + txStr + nonce)
      .digest("hex");

    if (hash.startsWith(alvo)) break;
    nonce++;

    if (nonce % 100000 === 0) {
      var hr = Math.round(nonce / ((Date.now() - inicio) / 1000) / 1000);
      process.stdout.write("\r  Calculando... nonce: " + nonce.toLocaleString("en") + " | " + hr + " kH/s   ");
    }

    if (nonce > Number.MAX_SAFE_INTEGER) throw new Error("Nonce overflow");
  }

  var tempo = (Date.now() - inicio) / 1000;
  return {
    nonce:    nonce,
    hash:     hash,
    tempo:    tempo,
    hashrate: Math.round(nonce / tempo / 1000)
  };
}

async function main() {
  console.clear();
  console.log("=".repeat(55));
  console.log("  CEREBRO BLOCKCHAIN - MEU MINERADOR (PoW REAL)");
  console.log("  CPU local calcula SHA-256 -- igual Bitcoin!");
  console.log("=".repeat(55));

  // Carteira
  var carteira = carregarCarteira();
  if (!carteira) {
    console.log("\n  Criando nova carteira...");
    carteira = await request("POST", "/api/wallet/new", {});
    salvarCarteira(carteira.publicKey, carteira.privateKey);
    console.log("  Salva em minha-carteira.txt");
  } else {
    console.log("\n  Carteira: " + carteira.publicKey.substring(0, 30) + "...");
  }

  var endereco = carteira.publicKey;
  var saldo    = await request("GET", "/api/balance/" + endereco, null).catch(function() { return { balance: 0 }; });
  console.log("  Saldo atual: " + saldo.balance + " CBR");
  console.log("\n  MINERANDO... (Ctrl+C para parar)\n");
  console.log("-".repeat(55));

  var totalBlocos  = 0;
  var totalCBR     = saldo.balance || 0;
  var erros        = 0;
  var inicioSessao = Date.now();

  while (true) {
    try {
      // 1. Buscar template com tx de recompensa ja incluida
      var template = await request("GET", "/api/mine/template?rewardAddress=" + endereco, null);
      if (template.erro) throw new Error(template.erro);

      // 2. PoW REAL no CPU local
      var pow = fazerPoW(template);
      process.stdout.write("\r" + " ".repeat(60) + "\r");

      // 3. Submeter bloco resolvido
      var sub = await request("POST", "/api/mine/submit", {
        nonce:         pow.nonce,
        previousHash:  template.previousHash,
        timestamp:     template.timestamp,
        transactions:  template.transactions,
        rewardAddress: endereco
      });

      if (sub.stale) {
        console.log("  [stale] Outro minerou primeiro — buscando proximo...");
        continue;
      }
      if (sub.erro) throw new Error(sub.erro);

      totalBlocos++;
      totalCBR += (sub.recompensa || 0);
      erros     = 0;

      var seg = Math.floor((Date.now() - inicioSessao) / 1000);
      var hh  = ("0" + Math.floor(seg / 3600)).slice(-2);
      var mm  = ("0" + Math.floor((seg % 3600) / 60)).slice(-2);
      var ss  = ("0" + (seg % 60)).slice(-2);

      console.log(
        "[" + hh + ":" + mm + ":" + ss + "]" +
        " BLOCO #" + sub.bloco +
        " | nonce: " + pow.nonce.toLocaleString("en") +
        " | " + pow.tempo.toFixed(1) + "s" +
        " | " + pow.hashrate + " kH/s" +
        " | +" + (sub.recompensa || 0) + " CBR" +
        " | Total: " + totalCBR + " CBR"
      );

      if (totalBlocos % 5 === 0) {
        var stats = await request("GET", "/api/stats", null).catch(function() { return {}; });
        console.log("-".repeat(55));
        console.log("  " + totalBlocos + " blocos | " + totalCBR + " CBR | Supply: " + (stats.supplyTotal || "?") + " / 21.000.000");
        console.log("-".repeat(55));
      }

    } catch(e) {
      erros++;
      var espera = Math.min(erros * 3, 30);
      console.log("  [AVISO] " + e.message + " - aguardando " + espera + "s...");
      await esperar(espera * 1000);
    }
  }
}

main();

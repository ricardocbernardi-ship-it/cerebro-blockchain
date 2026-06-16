// CEREBRO — Nó Completo (Blockchain + P2P + API HTTP + Explorer + Wallet)
// Equivalente a um full node do Polygon/Solana

require("dotenv").config();
const Blockchain      = require("./src/Blockchain");
const { initP2PServer, connectToPeer } = require("./src/P2P");
const criarAPI        = require("./src/API");
const { salvar: salvarBlockchain, carregar: carregarBlockchain } = require("./src/persistencia");

const P2P_PORT   = process.env.P2P_PORT  || 6001;
const API_PORT   = process.env.PORT || process.env.API_PORT  || 3001;
const PEERS      = process.env.PEERS ? process.env.PEERS.split(",") : [];
const DISABLE_P2P = process.env.DISABLE_P2P === "true";

console.log(`
╔══════════════════════════════════════════════════════════╗
║           CEREBRO BLOCKCHAIN — NÓ COMPLETO               ║
║    Tokens • API REST • Explorer • Wallet • P2P           ║
╚══════════════════════════════════════════════════════════╝
`);

// Carregar ou iniciar blockchain
const blockchain = carregarBlockchain() || new Blockchain();
console.log(`  ✅ Blockchain: ${blockchain.chain.length} blocos | Supply: ${blockchain.getTotalSupply().toFixed(2)} CBR`);
console.log(`  🪙 Tokens CBRC-20: ${blockchain.listTokens().length}`);

// Iniciar P2P (desativado em ambientes cloud sem suporte a WebSocket P2P)
let p2pServer = null;
if (!DISABLE_P2P) {
  p2pServer = initP2PServer(Number(P2P_PORT), blockchain, salvarBlockchain);
  if (PEERS.length) {
    console.log(`\n  Conectando a ${PEERS.length} peer(s)...`);
    PEERS.forEach(p => connectToPeer(p, blockchain, salvarBlockchain));
  }
} else {
  console.log("  ⚡ Modo nuvem: P2P desativado (DISABLE_P2P=true)");
}

// Iniciar API HTTP + servir Explorer e Wallet
const apiServer = criarAPI(blockchain, { broadcast: () => {} }, Number(API_PORT));

// Atualizar fromAddress na API de transfer (derivar da chave privada)
const { ec } = require("./src/crypto");

// Patch: sobrescrever a rota /api/transfer para derivar endereço
const express = require("express");

console.log(`
  ──────────────────────────────────────────────────────
  🟢 NÓ CEREBRO ONLINE

  P2P WebSocket : ws://localhost:${P2P_PORT}
  API REST      : http://localhost:${API_PORT}/api
  Explorer      : http://localhost:${API_PORT}/explorer.html
  Wallet Web    : http://localhost:${API_PORT}/wallet.html

  Para conectar outro nó:
    P2P_PORT=6002 API_PORT=3002 PEERS=ws://localhost:${P2P_PORT} node no-completo.js
  ──────────────────────────────────────────────────────
`);

// Salvar periodicamente
setInterval(() => salvarBlockchain(blockchain), 30000);

// Saída limpa
process.on("SIGINT", () => {
  salvarBlockchain(blockchain);
  console.log("\n  Blockchain salva. Nó encerrado.");
  process.exit(0);
});

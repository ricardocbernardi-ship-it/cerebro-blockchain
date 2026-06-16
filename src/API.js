// CEREBRO — API HTTP REST (igual a uma RPC de Polygon/Solana)
const express = require("express");
const cors = require("cors");
const path = require("path");
const Transaction = require("./Transaction");
const { ec } = require("./crypto");

function criarAPI(blockchain, p2p, porta = 3001) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../public")));

  // ── INFO GERAL ──────────────────────────────────────────────
  app.get("/api/stats", (req, res) => {
    res.json({
      blocos: blockchain.chain.length,
      dificuldade: blockchain.difficulty,
      recompensaAtual: blockchain.getMiningReward(),
      supplyTotal: blockchain.getTotalSupply(),
      supplyMaximo: blockchain.maxSupply,
      tokens: blockchain.listTokens().length,
      pendentesTx: blockchain.pendingTransactions.length,
      versao: "CEREBRO v2.0",
      rede: "mainnet"
    });
  });

  // ── BLOCOS ───────────────────────────────────────────────────
  app.get("/api/chain", (req, res) => {
    const limite = parseInt(req.query.limit) || 50;
    const chain = [...blockchain.chain].reverse().slice(0, limite);
    res.json({ total: blockchain.chain.length, blocos: chain });
  });

  app.get("/api/block/:index", (req, res) => {
    const idx = parseInt(req.params.index);
    if (isNaN(idx) || idx < 0 || idx >= blockchain.chain.length) {
      return res.status(404).json({ erro: "Bloco não encontrado" });
    }
    res.json(blockchain.chain[idx]);
  });

  app.get("/api/block/hash/:hash", (req, res) => {
    const bloco = blockchain.chain.find(b => b.hash === req.params.hash);
    if (!bloco) return res.status(404).json({ erro: "Bloco não encontrado" });
    res.json(bloco);
  });

  // ── ENDEREÇOS ────────────────────────────────────────────────
  app.get("/api/balance/:address", (req, res) => {
    const addr = req.params.address;
    res.json({
      address: addr,
      balance: blockchain.getBalanceOfAddress(addr),
      transacoes: blockchain.getAllTransactionsForAddress(addr).length
    });
  });

  app.get("/api/address/:address", (req, res) => {
    const addr = req.params.address;
    const txs = blockchain.getAllTransactionsForAddress(addr);
    const tokens = blockchain.listTokens().map(t => ({
      symbol: t.symbol,
      name: t.name,
      balance: blockchain.getTokenBalance(t.symbol, addr)
    })).filter(t => t.balance > 0);
    res.json({
      address: addr,
      balance: blockchain.getBalanceOfAddress(addr),
      transacoes: txs,
      tokens
    });
  });

  // ── TRANSAÇÕES ───────────────────────────────────────────────
  app.get("/api/pending", (req, res) => {
    res.json({ total: blockchain.pendingTransactions.length, txs: blockchain.pendingTransactions });
  });

  app.post("/api/transfer", (req, res) => {
    try {
      const { toAddress, amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const fromAddress = keyPair.getPublic("hex");
      const tx = new Transaction(fromAddress, toAddress, Number(amount));
      tx.signTransaction(keyPair);
      blockchain.adicionarTransacao(tx);
      if (p2p) p2p.broadcast({ type: "NEW_TRANSACTION", data: tx });
      res.json({ ok: true, txHash: tx.calculateHash(), from: fromAddress });
    } catch (e) {
      res.status(400).json({ erro: e.message });
    }
  });

  // ── TOKENS CBRC-20 ───────────────────────────────────────────
  app.get("/api/tokens", (req, res) => {
    res.json(blockchain.listTokens());
  });

  app.get("/api/token/:symbol", (req, res) => {
    const info = blockchain.getTokenInfo(req.params.symbol.toUpperCase());
    if (!info) return res.status(404).json({ erro: "Token não encontrado" });
    res.json(info);
  });

  app.get("/api/token/:symbol/balance/:address", (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const balance = blockchain.getTokenBalance(symbol, req.params.address);
    res.json({ symbol, address: req.params.address, balance });
  });

  app.post("/api/token/deploy", (req, res) => {
    try {
      const { name, symbol, supply, decimals, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const ownerAddress = keyPair.getPublic("hex");
      const tx = blockchain.deployToken(name, symbol.toUpperCase(), supply, decimals || 18, ownerAddress, keyPair);
      if (p2p) p2p.broadcast({ type: "NEW_TRANSACTION", data: tx });
      res.json({ ok: true, contract: `CBRC20-${symbol.toUpperCase()}`, txHash: tx.calculateHash() });
    } catch (e) {
      res.status(400).json({ erro: e.message });
    }
  });

  app.post("/api/token/transfer", (req, res) => {
    try {
      const { symbol, toAddress, amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const fromAddress = keyPair.getPublic("hex");
      const tx = blockchain.transferToken(symbol.toUpperCase(), fromAddress, toAddress, amount, keyPair);
      if (p2p) p2p.broadcast({ type: "NEW_TRANSACTION", data: tx });
      res.json({ ok: true, txHash: tx.calculateHash() });
    } catch (e) {
      res.status(400).json({ erro: e.message });
    }
  });

  // ── MINERAÇÃO ────────────────────────────────────────────────
  app.post("/api/mine", (req, res) => {
    try {
      const { rewardAddress } = req.body;
      blockchain.minerarTransacoesPendentes(rewardAddress);
      if (p2p) p2p.broadcast({ type: "NEW_BLOCK", data: blockchain.getLatestBlock() });
      res.json({ ok: true, bloco: blockchain.chain.length - 1, hash: blockchain.getLatestBlock().hash });
    } catch (e) {
      res.status(400).json({ erro: e.message });
    }
  });

  // ── VALIDAÇÃO ────────────────────────────────────────────────
  app.get("/api/valid", (req, res) => {
    res.json({ valida: blockchain.isChainValid(), blocos: blockchain.chain.length });
  });

  const server = app.listen(porta, () => {
    console.log(`  🌐 API CEREBRO rodando em http://localhost:${porta}`);
    console.log(`  📊 Explorer em http://localhost:${porta}/explorer.html`);
    console.log(`  💳 Wallet em  http://localhost:${porta}/wallet.html`);
  });

  return server;
}

module.exports = criarAPI;

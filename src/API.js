const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const Transaction = require("./Transaction");
const { ec } = require("./crypto");

function sanitizeError(e) {
  return e.message.replace(/[0-9a-fA-F]{64}/g, "[CHAVE_REDACTED]");
}

const limiterGeral = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde 1 minuto." }
});

const limiterEscrita = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas transações. Aguarde 1 minuto." }
});

const limiterFaucet = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Limite do faucet atingido. Aguarde 24h." }
});

function criarAPI(blockchain, p2p, porta = 3001) {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  }));

  app.disable("x-powered-by");
  app.use(limiterGeral);
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(path.join(__dirname, "../public")));

  const server = http.createServer(app);

  // ── WebSocket tempo real (como Solana's subscription API) ───
  const wss = new WebSocket.Server({ server });
  const clients = new Set();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: "CONNECTED", data: blockchain.getNetworkStats() }));
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(type, data) {
    const msg = JSON.stringify({ type, data, ts: Date.now() });
    for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
  }

  // Auto-mine após cada transação (finality < 100ms — mais rápido que Solana)
  function autoMine(rewardAddress = "CEREBRO_PROTOCOL") {
    if (blockchain.pendingTransactions.length === 0) return null;
    const block = blockchain.minerarTransacoesPendentes(rewardAddress);
    broadcast("NEW_BLOCK", { block, stats: blockchain.getNetworkStats() });
    return block;
  }

  // ── STATS ───────────────────────────────────────────────────
  app.get("/api/stats", (_, res) => res.json(blockchain.getNetworkStats()));
  app.get("/api/valid", (_, res) => res.json({ valida: blockchain.isChainValid(), blocos: blockchain.chain.length }));

  // ── BLOCOS ──────────────────────────────────────────────────
  app.get("/api/chain", (req, res) => {
    const limite = Math.min(parseInt(req.query.limit) || 50, 500);
    const chain = [...blockchain.chain].reverse().slice(0, limite);
    res.json({ total: blockchain.chain.length, blocos: chain });
  });

  app.get("/api/block/:index", (req, res) => {
    const idx = parseInt(req.params.index);
    const b = blockchain.chain[idx];
    if (!b) return res.status(404).json({ erro: "Bloco não encontrado" });
    res.json(b);
  });

  app.get("/api/block/hash/:hash", (req, res) => {
    const b = blockchain.chain.find(b => b.hash === req.params.hash);
    if (!b) return res.status(404).json({ erro: "Bloco não encontrado" });
    res.json(b);
  });

  // ── ENDEREÇOS ───────────────────────────────────────────────
  app.get("/api/balance/:address", (req, res) => {
    const addr = req.params.address;
    res.json({
      address: addr,
      balance: blockchain.getBalanceOfAddress(addr),
      staked: blockchain.getStake(addr),
      transacoes: blockchain.getAllTransactionsForAddress(addr).length,
      nfts: blockchain.getNFTsByOwner(addr).length
    });
  });

  app.get("/api/address/:address", (req, res) => {
    const addr = req.params.address;
    const tokens = blockchain.listTokens().map(t => ({
      symbol: t.symbol, name: t.name, balance: blockchain.getTokenBalance(t.symbol, addr)
    })).filter(t => t.balance > 0);
    res.json({
      address: addr,
      balance: blockchain.getBalanceOfAddress(addr),
      staked: blockchain.getStake(addr),
      transacoes: blockchain.getAllTransactionsForAddress(addr),
      tokens,
      nfts: blockchain.getNFTsByOwner(addr),
      contratos: blockchain.listContracts().filter(c => c.deployer === addr)
    });
  });

  // ── TRANSAÇÕES ──────────────────────────────────────────────
  app.get("/api/pending", (_, res) => res.json({ total: blockchain.pendingTransactions.length, txs: blockchain.pendingTransactions }));

  app.post("/api/transfer", limiterEscrita, (req, res) => {
    try {
      const { toAddress, amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const fromAddress = keyPair.getPublic("hex");
      const tx = new Transaction(fromAddress, toAddress, Number(amount));
      tx.signTransaction(keyPair);
      blockchain.adicionarTransacao(tx);
      broadcast("NEW_TX", tx);
      const block = autoMine(fromAddress);
      res.json({ ok: true, txHash: tx.calculateHash(), from: fromAddress, block: block?.hash });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── MINERAÇÃO SERVIDOR (legado) ─────────────────────────────
  app.post("/api/mine", limiterEscrita, (req, res) => {
    try {
      const { rewardAddress } = req.body;
      const block = blockchain.minerarTransacoesPendentes(rewardAddress);
      broadcast("NEW_BLOCK", { block, stats: blockchain.getNetworkStats() });
      res.json({ ok: true, bloco: blockchain.chain.length - 1, hash: block.hash });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── MINERAÇÃO DISTRIBUÍDA (cliente faz o PoW real) ──────────
  // GET /api/mine/template?rewardAddress=04...
  app.get("/api/mine/template", (req, res) => {
    try {
      const { rewardAddress } = req.query;
      if (!rewardAddress || !/^04[0-9a-fA-F]{128}$/.test(rewardAddress))
        return res.status(400).json({ erro: "rewardAddress inválido" });

      const lastBlock  = blockchain.getLatestBlock();
      const recompensa = blockchain.getMiningReward();
      const timestamp  = Date.now();

      // Monta transações: pendentes + coinbase (recompensa ao minerador)
      const txs = [...blockchain.pendingTransactions];
      if (recompensa > 0 && blockchain.getTotalSupply() < blockchain.maxSupply) {
        txs.push({
          fromAddress: null,
          toAddress:   rewardAddress,
          amount:      recompensa,
          timestamp,
          signature:   null,
          type:        "TRANSFER"
        });
      }

      res.json({
        previousHash: lastBlock.hash,
        difficulty:   blockchain.difficulty,
        timestamp,
        transactions: txs,
        blocoNum:     blockchain.chain.length,
        recompensa,
        rewardAddress
      });
    } catch (e) { res.status(500).json({ erro: sanitizeError(e) }); }
  });

  // POST /api/mine/submit — cliente envia nonce resolvido
  app.post("/api/mine/submit", limiterEscrita, (req, res) => {
    try {
      const { nonce, previousHash, timestamp, transactions, rewardAddress } = req.body;

      if (!rewardAddress || !/^04[0-9a-fA-F]{128}$/.test(rewardAddress))
        return res.status(400).json({ erro: "rewardAddress inválido" });
      if (typeof nonce !== "number" || nonce < 0)
        return res.status(400).json({ erro: "nonce inválido" });

      // Bloco desatualizado? outro minerou antes
      const lastBlock = blockchain.getLatestBlock();
      if (lastBlock.hash !== previousHash)
        return res.status(409).json({ erro: "Bloco desatualizado — busque novo template.", stale: true });

      // Verificar PoW do cliente
      const crypto   = require("crypto");
      const hashCalc = crypto.createHash("sha256")
        .update(previousHash + timestamp + JSON.stringify(transactions) + nonce)
        .digest("hex");

      const alvo = "0".repeat(blockchain.difficulty);
      if (!hashCalc.startsWith(alvo))
        return res.status(400).json({ erro: "PoW inválido — hash não atinge dificuldade" });

      // Verificar que a tx de recompensa bate com o rewardAddress
      const txRecompensa = transactions.find(t => t.fromAddress === null);
      if (txRecompensa && txRecompensa.toAddress !== rewardAddress)
        return res.status(400).json({ erro: "Endereço de recompensa adulterado" });

      // Tudo OK — adicionar bloco à chain
      const Block = require("./Block");
      const block = new Block(timestamp, transactions, previousHash);
      block.nonce = nonce;
      block.hash  = hashCalc;

      blockchain.chain.push(block);
      blockchain.pendingTransactions = [];
      blockchain._updateTPS();

      broadcast("NEW_BLOCK", { block, stats: blockchain.getNetworkStats() });

      const recompensa = txRecompensa ? txRecompensa.amount : 0;
      res.json({
        ok:        true,
        bloco:     blockchain.chain.length - 1,
        hash:      block.hash,
        recompensa,
        minerador: rewardAddress.substring(0, 20) + "..."
      });
    } catch (e) { res.status(500).json({ erro: sanitizeError(e) }); }
  });

  // ── TOKENS CBRC-20 ──────────────────────────────────────────
  app.get("/api/tokens", (_, res) => res.json(blockchain.listTokens()));
  app.get("/api/token/:symbol", (req, res) => {
    const info = blockchain.getTokenInfo(req.params.symbol.toUpperCase());
    if (!info) return res.status(404).json({ erro: "Token não encontrado" });
    res.json(info);
  });
  app.get("/api/token/:symbol/balance/:address", (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    res.json({ symbol, address: req.params.address, balance: blockchain.getTokenBalance(symbol, req.params.address) });
  });

  app.post("/api/token/deploy", limiterEscrita, (req, res) => {
    try {
      const { name, symbol, supply, decimals, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const ownerAddress = keyPair.getPublic("hex");
      const tx = blockchain.deployToken(name, symbol.toUpperCase(), supply, decimals || 18, ownerAddress, keyPair);
      broadcast("NEW_TX", tx);
      autoMine(ownerAddress);
      res.json({ ok: true, contract: `CBRC20-${symbol.toUpperCase()}`, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  app.post("/api/token/transfer", limiterEscrita, (req, res) => {
    try {
      const { symbol, toAddress, amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const fromAddress = keyPair.getPublic("hex");
      const tx = blockchain.transferToken(symbol.toUpperCase(), fromAddress, toAddress, amount, keyPair);
      broadcast("NEW_TX", tx);
      autoMine(fromAddress);
      res.json({ ok: true, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── NFTs CBRC-721 ───────────────────────────────────────────
  app.get("/api/nfts", (_, res) => res.json(blockchain.listAllNFTs()));
  app.get("/api/nft/:tokenId", (req, res) => {
    const nft = blockchain.getNFTInfo(req.params.tokenId);
    if (!nft) return res.status(404).json({ erro: "NFT não encontrado" });
    res.json(nft);
  });
  app.get("/api/nft/owner/:address", (req, res) => res.json(blockchain.getNFTsByOwner(req.params.address)));

  app.post("/api/nft/mint", limiterEscrita, (req, res) => {
    try {
      const { name, description, imageUrl, collection, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const ownerAddress = keyPair.getPublic("hex");
      const tx = blockchain.mintNFT(name, description, imageUrl, collection, ownerAddress, keyPair);
      broadcast("NEW_NFT", tx.data);
      autoMine(ownerAddress);
      res.json({ ok: true, tokenId: tx.data.tokenId, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  app.post("/api/nft/transfer", limiterEscrita, (req, res) => {
    try {
      const { tokenId, toAddress, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const fromAddress = keyPair.getPublic("hex");
      const tx = blockchain.transferNFT(tokenId, toAddress, fromAddress, keyPair);
      broadcast("NEW_TX", tx);
      autoMine(fromAddress);
      res.json({ ok: true, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── SMART CONTRACTS JavaScript ───────────────────────────────
  app.get("/api/contracts", (_, res) => res.json(blockchain.listContracts()));
  app.get("/api/contract/:address", (req, res) => {
    const c = blockchain.getContractInfo(req.params.address);
    if (!c) return res.status(404).json({ erro: "Contrato não encontrado" });
    res.json(c);
  });

  app.post("/api/contract/deploy", limiterEscrita, (req, res) => {
    try {
      const { name, sourceCode, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const ownerAddress = keyPair.getPublic("hex");
      const tx = blockchain.deployContract(name, sourceCode, ownerAddress, keyPair);
      broadcast("NEW_CONTRACT", tx.data);
      autoMine(ownerAddress);
      res.json({ ok: true, contractAddress: tx.data.contractAddress, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  app.post("/api/contract/call", limiterEscrita, (req, res) => {
    try {
      const { contractAddress, method, args, value, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const callerAddress = keyPair.getPublic("hex");
      const result = blockchain._executeContract(contractAddress, method, args, callerAddress);
      if (result.error) return res.status(400).json({ erro: result.error });
      res.json({ ok: true, result: result.result, events: result.events, state: result.state });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── STAKING ─────────────────────────────────────────────────
  app.get("/api/stake/:address", (req, res) => {
    const addr = req.params.address;
    res.json({ address: addr, staked: blockchain.getStake(addr), totalStaked: blockchain.getTotalStaked() });
  });

  app.post("/api/stake", limiterEscrita, (req, res) => {
    try {
      const { amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const addr = keyPair.getPublic("hex");
      const tx = blockchain.stake(amount, addr, keyPair);
      broadcast("NEW_TX", tx);
      autoMine(addr);
      res.json({ ok: true, staked: amount, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  app.post("/api/unstake", limiterEscrita, (req, res) => {
    try {
      const { amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const addr = keyPair.getPublic("hex");
      const tx = blockchain.unstake(amount, addr, keyPair);
      broadcast("NEW_TX", tx);
      autoMine(addr);
      res.json({ ok: true, unstaked: amount, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── DEX BUILT-IN ────────────────────────────────────────────
  app.get("/api/pools", (_, res) => res.json(blockchain.listPools()));
  app.get("/api/pool/:a/:b", (req, res) => {
    const poolKey = [req.params.a.toUpperCase(), req.params.b.toUpperCase()].sort().join("_");
    res.json(blockchain._getPool(poolKey));
  });

  app.post("/api/swap", limiterEscrita, (req, res) => {
    try {
      const { fromToken, toToken, amount, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const addr = keyPair.getPublic("hex");
      const tx = blockchain.swap(fromToken.toUpperCase(), toToken.toUpperCase(), amount, addr, keyPair);
      broadcast("NEW_SWAP", tx.data);
      autoMine(addr);
      res.json({ ok: true, amountOut: tx.data.amountOut, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  app.post("/api/liquidity/add", limiterEscrita, (req, res) => {
    try {
      const { tokenA, tokenB, amountA, amountB, privateKey } = req.body;
      const keyPair = ec.keyFromPrivate(privateKey, "hex");
      const addr = keyPair.getPublic("hex");
      const tx = blockchain.addLiquidity(tokenA.toUpperCase(), tokenB.toUpperCase(), amountA, amountB, addr, keyPair);
      broadcast("NEW_TX", tx);
      autoMine(addr);
      res.json({ ok: true, pool: tx.data.poolKey, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  // ── CARTEIRA ────────────────────────────────────────────────
  app.post("/api/wallet/new", (_, res) => {
    const keyPair = ec.genKeyPair();
    res.json({ privateKey: keyPair.getPrivate("hex"), publicKey: keyPair.getPublic("hex") });
  });

  // ── FAUCET ──────────────────────────────────────────────────
  const fs = require("fs");
  const faucetFile = require("path").join(__dirname, "../dados/faucet-usados.json");
  const _carregarFaucet = () => {
    try { return new Set(JSON.parse(fs.readFileSync(faucetFile, "utf8"))); }
    catch { return new Set(); }
  };
  const _salvarFaucet = (set) => {
    try { fs.writeFileSync(faucetFile, JSON.stringify([...set])); } catch {}
  };
  const faucetUsados = _carregarFaucet();

  app.post("/api/faucet", limiterFaucet, (req, res) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== "string" || address.length < 10)
        return res.status(400).json({ erro: "Endereço inválido" });
      if (faucetUsados.has(address))
        return res.status(400).json({ erro: "Faucet já usado para este endereço" });
      const FAUCET_KEY = process.env.FAUCET_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";
      const keyPair = ec.keyFromPrivate(FAUCET_KEY, "hex");
      const faucetAddr = keyPair.getPublic("hex");
      const saldo = blockchain.getBalanceOfAddress(faucetAddr);
      if (saldo < 10) return res.status(400).json({ erro: "Faucet sem saldo. Mine blocos primeiro." });
      const tx = new Transaction(faucetAddr, address, 10);
      tx.signTransaction(keyPair);
      blockchain.adicionarTransacao(tx);
      faucetUsados.add(address);
      _salvarFaucet(faucetUsados);
      autoMine(faucetAddr);
      res.json({ ok: true, amount: 10, txHash: tx.calculateHash() });
    } catch (e) { res.status(400).json({ erro: sanitizeError(e) }); }
  });

  server.listen(porta, () => {
    console.log(`  🌐 CEREBRO v3.0 rodando em http://localhost:${porta}`);
    console.log(`  📊 Explorer  → http://localhost:${porta}/explorer.html`);
    console.log(`  💳 Wallet    → http://localhost:${porta}/wallet.html`);
    console.log(`  🔌 WebSocket → ws://localhost:${porta}`);
    console.log(`  ⚡ Finality instantânea ATIVA (auto-mine)`);
  });

  return server;
}

module.exports = criarAPI;

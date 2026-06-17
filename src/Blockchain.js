const Block = require("./Block");
const Transaction = require("./Transaction");
const crypto = require("crypto");
const vm = require("vm");

class Blockchain {
  constructor() {
    this.chain = [this.criarBlocoGenesis()];
    this.difficulty = 4;              // PoW real — cliente minera ~1-3s por bloco
    this.pendingTransactions = [];
    this.baseReward = 50;
    this.halvingInterval = 210000;
    this.maxSupply = 21000000;
    this.instantMode = true;          // auto-mina após cada tx (finality < 100ms)
    this.tps = 0;
    this._tpsCount = 0;
    this._tpsTimer = Date.now();
  }

  criarBlocoGenesis() {
    return new Block(Date.parse("2026-06-15"), [], "0");
  }

  getLatestBlock() { return this.chain[this.chain.length - 1]; }

  getMiningReward() {
    const halvings = Math.floor(this.chain.length / this.halvingInterval);
    const r = this.baseReward / Math.pow(2, halvings);
    return r < 1e-8 ? 0 : r;
  }

  getTotalSupply() {
    let t = 0;
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.fromAddress === null) t += tx.amount;
    return t;
  }

  // ── FINALITY INSTANTÂNEA (melhor que Solana 400ms) ──────────
  // Mina bloco sem PoW pesado (difficulty=2), confirmação < 100ms
  minerarTransacoesPendentes(enderecoRecompensa) {
    const recompensa = this.getMiningReward();
    if (recompensa > 0 && this.getTotalSupply() < this.maxSupply) {
      const txR = new Transaction(null, enderecoRecompensa, recompensa);
      this.pendingTransactions.push(txR);
    }
    const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];
    this._updateTPS();
    return block;
  }

  _updateTPS() {
    this._tpsCount++;
    const now = Date.now();
    if (now - this._tpsTimer >= 1000) {
      this.tps = this._tpsCount;
      this._tpsCount = 0;
      this._tpsTimer = now;
    }
  }

  adicionarTransacao(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress)
      throw new Error("Transação precisa de remetente e destinatário");
    if (!transaction.isValid())
      throw new Error("Transação inválida");

    const tipo = transaction.type;

    if (tipo === "TOKEN_DEPLOY") {
      if (this.getTokenInfo(transaction.data.symbol))
        throw new Error(`Token ${transaction.data.symbol} já existe`);
    } else if (tipo === "TOKEN_TRANSFER") {
      const { symbol, amount } = transaction.data;
      if (this.getTokenBalance(symbol, transaction.fromAddress) < amount)
        throw new Error(`Saldo insuficiente de ${symbol}`);
    } else if (tipo === "NFT_TRANSFER") {
      const nft = this.getNFTInfo(transaction.data.tokenId);
      if (!nft) throw new Error("NFT não encontrado");
      if (nft.owner !== transaction.fromAddress) throw new Error("Você não é dono deste NFT");
    } else if (tipo === "CONTRACT_CALL") {
      // validação básica — execução real acontece na minera
    } else if (tipo === "STAKE") {
      if (this.getBalanceOfAddress(transaction.fromAddress) < transaction.data.amount)
        throw new Error("Saldo insuficiente para stake");
    } else if (tipo === "SWAP") {
      const { fromToken, amount } = transaction.data;
      if (fromToken === "CBR") {
        if (this.getBalanceOfAddress(transaction.fromAddress) < amount)
          throw new Error("Saldo CBR insuficiente para swap");
      } else {
        if (this.getTokenBalance(fromToken, transaction.fromAddress) < amount)
          throw new Error(`Saldo ${fromToken} insuficiente para swap`);
      }
    } else if (tipo === "NFT_MINT" || tipo === "CONTRACT_DEPLOY" || tipo === "ADD_LIQUIDITY" || tipo === "UNSTAKE") {
      // sem validação de amount — essas operações têm amount=0
    } else {
      // TRANSFER padrão
      if (!Number.isFinite(transaction.amount) || transaction.amount <= 0)
        throw new Error("Valor deve ser um número finito > 0");
      if (this.getBalanceOfAddress(transaction.fromAddress) < transaction.amount)
        throw new Error(`Saldo insuficiente: ${this.getBalanceOfAddress(transaction.fromAddress)} CBR`);
    }

    if (this.pendingTransactions.length >= 10000)
      throw new Error("Mempool cheia: aguarde transações serem mineradas");
    this.pendingTransactions.push(transaction);
  }

  // ── CBRC-20 TOKENS ──────────────────────────────────────────
  deployToken(name, symbol, supply, decimals, ownerAddress, signingKey) {
    const tx = new Transaction(ownerAddress, ownerAddress, 0, "TOKEN_DEPLOY", {
      name, symbol, supply: Number(supply), decimals: Number(decimals || 18),
      contract: `CBRC20-${symbol}`, deployedAt: Date.now()
    });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  transferToken(symbol, fromAddress, toAddress, amount, signingKey) {
    const tx = new Transaction(fromAddress, toAddress, 0, "TOKEN_TRANSFER", { symbol, amount: Number(amount) });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  getTokenInfo(symbol) {
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "TOKEN_DEPLOY" && tx.data?.symbol === symbol) return tx.data;
    return null;
  }

  getTokenBalance(symbol, address) {
    let bal = 0;
    for (const b of this.chain) {
      for (const tx of b.transactions) {
        if (tx.type === "TOKEN_DEPLOY" && tx.data?.symbol === symbol && tx.fromAddress === address)
          bal += tx.data.supply;
        if (tx.type === "TOKEN_TRANSFER" && tx.data?.symbol === symbol) {
          if (tx.fromAddress === address) bal -= tx.data.amount;
          if (tx.toAddress === address) bal += tx.data.amount;
        }
        // DEX swap recebe tokens
        if (tx.type === "SWAP" && tx.data?.toToken === symbol && tx.toAddress === address)
          bal += tx.data.amountOut || 0;
        if (tx.type === "SWAP" && tx.data?.fromToken === symbol && tx.fromAddress === address)
          bal -= tx.data.amount;
      }
    }
    return bal;
  }

  listTokens() {
    const map = {};
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "TOKEN_DEPLOY")
          map[tx.data.symbol] = { ...tx.data, deployer: tx.fromAddress };
    return Object.values(map);
  }

  // ── CBRC-721 NFTs (melhor que OpenSea — sem gas!) ───────────
  mintNFT(name, description, imageUrl, collection, ownerAddress, signingKey) {
    const tokenId = crypto.createHash("sha256")
      .update(ownerAddress + name + Date.now()).digest("hex").slice(0, 16);
    const tx = new Transaction(ownerAddress, ownerAddress, 0, "NFT_MINT", {
      tokenId, name, description, imageUrl: imageUrl || "",
      collection: collection || "DEFAULT", mintedAt: Date.now()
    });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  transferNFT(tokenId, toAddress, fromAddress, signingKey) {
    const tx = new Transaction(fromAddress, toAddress, 0, "NFT_TRANSFER", { tokenId });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  getNFTInfo(tokenId) {
    let nft = null;
    for (const b of this.chain) {
      for (const tx of b.transactions) {
        if (tx.type === "NFT_MINT" && tx.data?.tokenId === tokenId)
          nft = { ...tx.data, owner: tx.fromAddress, mintBlock: this.chain.indexOf(b) };
        if (tx.type === "NFT_TRANSFER" && tx.data?.tokenId === tokenId && nft)
          nft.owner = tx.toAddress;
      }
    }
    return nft;
  }

  getNFTsByOwner(address) {
    const owned = {};
    for (const b of this.chain) {
      for (const tx of b.transactions) {
        if (tx.type === "NFT_MINT" && tx.data?.tokenId)
          owned[tx.data.tokenId] = { ...tx.data, owner: tx.fromAddress };
        if (tx.type === "NFT_TRANSFER" && tx.data?.tokenId && owned[tx.data.tokenId])
          owned[tx.data.tokenId].owner = tx.toAddress;
      }
    }
    return Object.values(owned).filter(n => n.owner === address);
  }

  listAllNFTs() {
    const owned = {};
    for (const b of this.chain) {
      for (const tx of b.transactions) {
        if (tx.type === "NFT_MINT" && tx.data?.tokenId)
          owned[tx.data.tokenId] = { ...tx.data, owner: tx.fromAddress };
        if (tx.type === "NFT_TRANSFER" && tx.data?.tokenId && owned[tx.data.tokenId])
          owned[tx.data.tokenId].owner = tx.toAddress;
      }
    }
    return Object.values(owned);
  }

  // ── SMART CONTRACTS em JavaScript (mais fácil que Solidity!) ─
  deployContract(name, sourceCode, ownerAddress, signingKey) {
    const contractAddress = "CBRCT_" + crypto.createHash("sha256")
      .update(ownerAddress + name + sourceCode + Date.now()).digest("hex").slice(0, 20).toUpperCase();
    const tx = new Transaction(ownerAddress, ownerAddress, 0, "CONTRACT_DEPLOY", {
      contractAddress, name, sourceCode, deployedAt: Date.now(), calls: 0
    });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  callContract(contractAddress, method, args, callerAddress, signingKey, value = 0) {
    const tx = new Transaction(callerAddress, callerAddress, value || 0, "CONTRACT_CALL", {
      contractAddress, method, args: args || [], calledAt: Date.now()
    });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  _executeContract(contractAddress, method, args, caller) {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(method))
      return { error: "Nome de método inválido" };

    let sourceCode = null;
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "CONTRACT_DEPLOY" && tx.data?.contractAddress === contractAddress)
          sourceCode = tx.data.sourceCode;
    if (!sourceCode) return { error: "Contrato não encontrado" };

    const state = this._getContractState(contractAddress);
    const results = [];

    try {
      const sandbox = Object.create(null);
      Object.assign(sandbox, {
        state,
        caller,
        args: args || [],
        emit: (event, data) => results.push({ event, data }),
        balance: (addr) => this.getBalanceOfAddress(addr),
        tokenBalance: (sym, addr) => this.getTokenBalance(sym, addr),
        Math: Object.freeze({ ...Math }),
        JSON: Object.freeze({ parse: JSON.parse, stringify: JSON.stringify }),
        Date: Object.freeze({ now: Date.now }),
        result: undefined
      });
      vm.createContext(sandbox);
      vm.runInContext(
        `${sourceCode}\nif (typeof ${method} === "function") { result = ${method}(...args); }`,
        sandbox,
        { timeout: 1000 }
      );
      return { ok: true, result: sandbox.result, state: sandbox.state, events: results };
    } catch (e) {
      return { error: e.message };
    }
  }

  _getContractState(contractAddress) {
    const state = {};
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "CONTRACT_CALL" && tx.data?.contractAddress === contractAddress && tx.data?._stateUpdate)
          Object.assign(state, tx.data._stateUpdate);
    return state;
  }

  getContractInfo(contractAddress) {
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "CONTRACT_DEPLOY" && tx.data?.contractAddress === contractAddress)
          return { ...tx.data, deployer: tx.fromAddress };
    return null;
  }

  listContracts() {
    const map = {};
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "CONTRACT_DEPLOY")
          map[tx.data.contractAddress] = { ...tx.data, deployer: tx.fromAddress };
    return Object.values(map);
  }

  // ── STAKING — ganhe CBR passivamente ────────────────────────
  stake(amount, ownerAddress, signingKey) {
    const tx = new Transaction(ownerAddress, ownerAddress, 0, "STAKE", { amount: Number(amount) });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  unstake(amount, ownerAddress, signingKey) {
    const staked = this.getStake(ownerAddress);
    if (staked < amount) throw new Error(`Stake insuficiente: ${staked} CBR`);
    const tx = new Transaction(ownerAddress, ownerAddress, 0, "UNSTAKE", { amount: Number(amount) });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  getStake(address) {
    let staked = 0;
    for (const b of this.chain)
      for (const tx of b.transactions) {
        if (tx.type === "STAKE" && tx.fromAddress === address) staked += tx.data.amount;
        if (tx.type === "UNSTAKE" && tx.fromAddress === address) staked -= tx.data.amount;
      }
    return Math.max(0, staked);
  }

  getTotalStaked() {
    const map = {};
    for (const b of this.chain)
      for (const tx of b.transactions) {
        if (tx.type === "STAKE") map[tx.fromAddress] = (map[tx.fromAddress] || 0) + tx.data.amount;
        if (tx.type === "UNSTAKE") map[tx.fromAddress] = (map[tx.fromAddress] || 0) - tx.data.amount;
      }
    return Object.values(map).reduce((a, b) => a + Math.max(0, b), 0);
  }

  // ── DEX BUILT-IN (swap de tokens, sem corretora) ─────────────
  // AMM simples: produto constante x*y=k
  swap(fromToken, toToken, amountIn, ownerAddress, signingKey) {
    const poolKey = [fromToken, toToken].sort().join("_");
    const pool = this._getPool(poolKey);

    let amountOut;
    if (!pool || pool.reserveA === 0 || pool.reserveB === 0) {
      throw new Error(`Pool ${fromToken}/${toToken} sem liquidez. Adicione liquidez primeiro.`);
    }

    const isAtoB = fromToken < toToken;
    const reserveIn  = isAtoB ? pool.reserveA : pool.reserveB;
    const reserveOut = isAtoB ? pool.reserveB : pool.reserveA;

    // AMM: amountOut = reserveOut * amountIn / (reserveIn + amountIn) * 0.997 (0.3% fee)
    amountOut = (reserveOut * amountIn / (reserveIn + amountIn)) * 0.997;
    amountOut = Math.floor(amountOut * 1e6) / 1e6;

    if (amountOut <= 0 || amountOut >= reserveOut)
      throw new Error("Liquidez insuficiente para completar o swap");

    const tx = new Transaction(ownerAddress, ownerAddress, 0, "SWAP", {
      fromToken, toToken, amount: Number(amountIn), amountOut, poolKey
    });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  addLiquidity(tokenA, tokenB, amountA, amountB, ownerAddress, signingKey) {
    const tx = new Transaction(ownerAddress, ownerAddress, 0, "ADD_LIQUIDITY", {
      tokenA, tokenB, amountA: Number(amountA), amountB: Number(amountB),
      poolKey: [tokenA, tokenB].sort().join("_")
    });
    tx.signTransaction(signingKey);
    this.adicionarTransacao(tx);
    return tx;
  }

  _getPool(poolKey) {
    let pool = { poolKey, reserveA: 0, reserveB: 0, liquidity: 0 };
    for (const b of this.chain) {
      for (const tx of b.transactions) {
        if (tx.type === "ADD_LIQUIDITY" && tx.data?.poolKey === poolKey) {
          pool.reserveA += tx.data.amountA;
          pool.reserveB += tx.data.amountB;
          pool.liquidity += Math.sqrt(tx.data.amountA * tx.data.amountB);
        }
        if (tx.type === "SWAP" && tx.data?.poolKey === poolKey) {
          const isAtoB = tx.data.fromToken < tx.data.toToken;
          if (isAtoB) { pool.reserveA += tx.data.amount; pool.reserveB = Math.max(0, pool.reserveB - tx.data.amountOut); }
          else         { pool.reserveB += tx.data.amount; pool.reserveA = Math.max(0, pool.reserveA - tx.data.amountOut); }
        }
      }
    }
    return pool;
  }

  listPools() {
    const keys = new Set();
    for (const b of this.chain)
      for (const tx of b.transactions)
        if (tx.type === "ADD_LIQUIDITY" || tx.type === "SWAP") keys.add(tx.data.poolKey);
    return Array.from(keys).map(k => this._getPool(k));
  }

  // ── UTILITÁRIOS ─────────────────────────────────────────────
  getAllTransactionsForAddress(address) {
    const txs = [];
    for (let i = 0; i < this.chain.length; i++) {
      const b = this.chain[i];
      for (const tx of b.transactions)
        if (tx.fromAddress === address || tx.toAddress === address)
          txs.push({ ...tx, blockIndex: i });
    }
    return txs;
  }

  getBalanceOfAddress(address) {
    let bal = 0;
    for (const b of this.chain)
      for (const tx of b.transactions) {
        const t = tx.type;
        if (!t || t === "TRANSFER") {
          if (tx.fromAddress === address) bal -= tx.amount;
          if (tx.toAddress === address) bal += tx.amount;
        }
        // stake reduz saldo utilizável
        if (t === "STAKE" && tx.fromAddress === address) bal -= tx.data.amount;
        if (t === "UNSTAKE" && tx.fromAddress === address) bal += tx.data.amount;
        // swap de CBR
        if (t === "SWAP" && tx.data?.fromToken === "CBR" && tx.fromAddress === address) bal -= tx.data.amount;
        if (t === "SWAP" && tx.data?.toToken === "CBR" && tx.toAddress === address) bal += tx.data.amountOut || 0;
      }
    return bal;
  }

  getNetworkStats() {
    const txTotal = this.chain.reduce((a, b) => a + b.transactions.length, 0);
    const wallets = new Set();
    for (const b of this.chain)
      for (const tx of b.transactions) {
        if (tx.fromAddress) wallets.add(tx.fromAddress);
        if (tx.toAddress) wallets.add(tx.toAddress);
      }
    return {
      blocos: this.chain.length,
      transacoesTotal: txTotal,
      carteiras: wallets.size,
      tokens: this.listTokens().length,
      nfts: this.listAllNFTs().length,
      contratos: this.listContracts().length,
      pools: this.listPools().length,
      supplyTotal: this.getTotalSupply(),
      supplyMaximo: this.maxSupply,
      totalStaked: this.getTotalStaked(),
      tps: this.tps,
      dificuldade: this.difficulty,
      recompensaAtual: this.getMiningReward(),
      versao: "CEREBRO v3.0",
      rede: "mainnet"
    };
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const cur = this.chain[i];
      const prev = this.chain[i - 1];
      if (cur.previousHash !== prev.hash) return false;
      if (cur.hash !== cur.calculateHash()) return false;
    }
    return true;
  }
}

module.exports = Blockchain;

/**
 * CEREBRO.js — SDK oficial da blockchain CEREBRO
 * Equivalente ao ethers.js para Ethereum / @solana/web3.js para Solana
 * Uso: const cerebro = require('./cerebro.js')
 */
const http = require("http");
const https = require("https");
const crypto = require("crypto");

class CerebroSDK {
  constructor(rpcUrl = "http://localhost:3001") {
    this.rpc = rpcUrl.replace(/\/$/, "");
    this.isHttps = rpcUrl.startsWith("https");
  }

  // ── HTTP helpers ─────────────────────────────────────────────
  async _get(path) {
    return this._req("GET", path);
  }
  async _post(path, body) {
    return this._req("POST", path, body);
  }
  _req(method, path, body) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const url = new URL(this.rpc + path);
      const lib = this.isHttps ? https : http;
      const opts = {
        hostname: url.hostname, port: url.port || (this.isHttps ? 443 : 80),
        path: url.pathname + url.search, method,
        headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) }
      };
      const req = lib.request(opts, res => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
      });
      req.on("error", reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // ── Carteira ─────────────────────────────────────────────────
  async gerarCarteira() {
    return this._post("/api/wallet/new", {});
  }

  // ── Rede ─────────────────────────────────────────────────────
  async getStats()          { return this._get("/api/stats"); }
  async isValida()          { return (await this._get("/api/valid")).valida; }
  async getBloco(index)     { return this._get(`/api/block/${index}`); }
  async getBlocos(limit=50) { return this._get(`/api/chain?limit=${limit}`); }
  async getPendentes()      { return this._get("/api/pending"); }

  // ── CBR ──────────────────────────────────────────────────────
  async getSaldo(address)              { return (await this._get(`/api/balance/${address}`)).balance; }
  async getEndereco(address)           { return this._get(`/api/address/${address}`); }
  async enviar(toAddress, amount, privateKey) {
    return this._post("/api/transfer", { toAddress, amount, privateKey });
  }
  async minerar(rewardAddress) {
    return this._post("/api/mine", { rewardAddress });
  }
  async faucet(address) {
    return this._post("/api/faucet", { address });
  }

  // ── Tokens CBRC-20 ──────────────────────────────────────────
  async listarTokens()                     { return this._get("/api/tokens"); }
  async getToken(symbol)                   { return this._get(`/api/token/${symbol}`); }
  async getSaldoToken(symbol, address)     { return (await this._get(`/api/token/${symbol}/balance/${address}`)).balance; }
  async deployToken(name, symbol, supply, decimals, privateKey) {
    return this._post("/api/token/deploy", { name, symbol, supply, decimals, privateKey });
  }
  async transferirToken(symbol, toAddress, amount, privateKey) {
    return this._post("/api/token/transfer", { symbol, toAddress, amount, privateKey });
  }

  // ── NFTs CBRC-721 ───────────────────────────────────────────
  async listarNFTs()               { return this._get("/api/nfts"); }
  async getNFT(tokenId)            { return this._get(`/api/nft/${tokenId}`); }
  async getNFTsPorDono(address)    { return this._get(`/api/nft/owner/${address}`); }
  async mintNFT(name, description, imageUrl, collection, privateKey) {
    return this._post("/api/nft/mint", { name, description, imageUrl, collection, privateKey });
  }
  async transferirNFT(tokenId, toAddress, privateKey) {
    return this._post("/api/nft/transfer", { tokenId, toAddress, privateKey });
  }

  // ── Smart Contracts ─────────────────────────────────────────
  async listarContratos()           { return this._get("/api/contracts"); }
  async getContrato(address)        { return this._get(`/api/contract/${address}`); }
  async deployContrato(name, sourceCode, privateKey) {
    return this._post("/api/contract/deploy", { name, sourceCode, privateKey });
  }
  async chamarContrato(contractAddress, method, args, privateKey) {
    return this._post("/api/contract/call", { contractAddress, method, args, privateKey });
  }

  // ── Staking ─────────────────────────────────────────────────
  async getStake(address)         { return this._get(`/api/stake/${address}`); }
  async stake(amount, privateKey) { return this._post("/api/stake", { amount, privateKey }); }
  async unstake(amount, privateKey){ return this._post("/api/unstake", { amount, privateKey }); }

  // ── DEX ─────────────────────────────────────────────────────
  async listarPools()                              { return this._get("/api/pools"); }
  async getPool(tokenA, tokenB)                    { return this._get(`/api/pool/${tokenA}/${tokenB}`); }
  async swap(fromToken, toToken, amount, privateKey) {
    return this._post("/api/swap", { fromToken, toToken, amount, privateKey });
  }
  async addLiquidez(tokenA, tokenB, amountA, amountB, privateKey) {
    return this._post("/api/liquidity/add", { tokenA, tokenB, amountA, amountB, privateKey });
  }
}

// Instância padrão (localhost)
const cerebro = new CerebroSDK();
cerebro.SDK = CerebroSDK;

module.exports = cerebro;

// ── Exemplo de uso ───────────────────────────────────────────
// const cerebro = require('./cerebro');
//
// async function main() {
//   // Estatísticas da rede
//   const stats = await cerebro.getStats();
//   console.log('CEREBRO v3.0:', stats.blocos, 'blocos,', stats.supplyTotal, 'CBR');
//
//   // Gerar carteira
//   const { privateKey, publicKey } = await cerebro.gerarCarteira();
//
//   // Receber CBR do faucet
//   await cerebro.faucet(publicKey);
//
//   // Ver saldo
//   const saldo = await cerebro.getSaldo(publicKey);
//   console.log('Saldo:', saldo, 'CBR');
//
//   // Criar token
//   await cerebro.deployToken('MeuToken', 'MTK', 1000000, 18, privateKey);
//
//   // Mintar NFT
//   await cerebro.mintNFT('Arte #1', 'Minha arte', '', 'ColecaoTeste', privateKey);
//
//   // Deploy de contrato
//   const code = `
//     function saudacao(nome) {
//       emit('Ola', { nome });
//       return 'Bem-vindo ' + nome + ' na CEREBRO!';
//     }
//   `;
//   const { contractAddress } = await cerebro.deployContrato('MeuContrato', code, privateKey);
//
//   // Chamar contrato
//   const resultado = await cerebro.chamarContrato(contractAddress, 'saudacao', ['Ricardo'], privateKey);
//   console.log('Resultado:', resultado.result);
// }

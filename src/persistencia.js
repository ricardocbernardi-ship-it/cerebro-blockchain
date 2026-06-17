const fs = require("fs");
const path = require("path");
const Blockchain = require("./Blockchain");
const Block = require("./Block");
const Transaction = require("./Transaction");

const ARQUIVO = path.join(__dirname, "..", "dados", "blockchain.json");

function salvar(blockchain) {
  const dir = path.dirname(ARQUIVO);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(blockchain, null, 2));
}

function reconstruirTx(t) {
  const tx = new Transaction(t.fromAddress, t.toAddress, t.amount, t.type || "TRANSFER", t.data || null);
  tx.timestamp = t.timestamp;
  tx.signature = t.signature;
  return tx;
}

function carregar() {
  if (!fs.existsSync(ARQUIVO)) {
    const nova = new Blockchain();
    salvar(nova);
    return nova;
  }

  const raw = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  const blockchain = new Blockchain();

  if (raw.difficulty)       blockchain.difficulty = raw.difficulty;
  if (raw.baseReward)       blockchain.baseReward = raw.baseReward;
  if (raw.halvingInterval)  blockchain.halvingInterval = raw.halvingInterval;
  if (raw.maxSupply)        blockchain.maxSupply = raw.maxSupply;
  if (raw.instantMode !== undefined) blockchain.instantMode = raw.instantMode;

  blockchain.pendingTransactions = (raw.pendingTransactions || []).map(reconstruirTx);
  blockchain.chain = raw.chain.map((b) => {
    const block = new Block(b.timestamp, (b.transactions || []).map(reconstruirTx), b.previousHash);
    block.nonce = b.nonce;
    block.hash = b.hash;
    return block;
  });

  return blockchain;
}

module.exports = { salvar, carregar, ARQUIVO };

// Como persistencia.js, mas parametrizado por pasta — cada nó da rede tem seu próprio estado.
const fs = require("fs");
const path = require("path");
const Blockchain = require("./Blockchain");
const Block = require("./Block");
const Transaction = require("./Transaction");

function arquivoPara(dataDir) {
  return path.join(dataDir, "blockchain.json");
}

function salvar(blockchain, dataDir) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(arquivoPara(dataDir), JSON.stringify(blockchain, null, 2));
}

function reconstruirTx(t) {
  const tx = new Transaction(t.fromAddress, t.toAddress, t.amount, t.type || "TRANSFER", t.data || null);
  tx.timestamp = t.timestamp;
  tx.signature = t.signature;
  return tx;
}

function carregar(dataDir) {
  const arquivo = arquivoPara(dataDir);
  if (!fs.existsSync(arquivo)) {
    const nova = new Blockchain();
    salvar(nova, dataDir);
    return nova;
  }

  const raw = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const blockchain = new Blockchain();

  blockchain.difficulty = raw.difficulty;
  blockchain.baseReward = raw.baseReward;
  blockchain.halvingInterval = raw.halvingInterval;
  blockchain.maxSupply = raw.maxSupply;
  blockchain.pendingTransactions = (raw.pendingTransactions || []).map(reconstruirTx);

  blockchain.chain = raw.chain.map((b) => {
    const block = new Block(b.timestamp, (b.transactions || []).map(reconstruirTx), b.previousHash);
    block.nonce = b.nonce;
    block.hash = b.hash;
    return block;
  });

  return blockchain;
}

module.exports = { salvar, carregar };

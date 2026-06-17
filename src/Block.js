const crypto = require("crypto");

class Block {
  constructor(timestamp, transactions, previousHash = "") {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto.createHash("sha256")
      .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce)
      .digest("hex");
  }

  // Proof of Work: igual ao Bitcoin, testa nonces até achar hash com N zeros à esquerda
  mineBlock(difficulty) {
    const alvo = "0".repeat(difficulty);
    const inicio = Date.now();
    while (this.hash.substring(0, difficulty) !== alvo) {
      this.nonce++;
      if (this.nonce > Number.MAX_SAFE_INTEGER)
        throw new Error("Nonce overflow: dificuldade muito alta, impossível minerar este bloco");
      this.hash = this.calculateHash();
    }
    const tempo = ((Date.now() - inicio) / 1000).toFixed(2);
    console.log(`  ⛏️  Bloco minerado em ${tempo}s (nonce: ${this.nonce.toLocaleString("pt-BR")})`);
    console.log(`  Hash: ${this.hash}`);
  }

  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) return false;
    }
    return true;
  }
}

module.exports = Block;

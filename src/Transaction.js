const crypto = require("crypto");
const { ec } = require("./crypto");

class Transaction {
  constructor(fromAddress, toAddress, amount, type = "TRANSFER", data = null) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
    this.type = type; // TRANSFER | TOKEN_DEPLOY | TOKEN_TRANSFER | MINING_REWARD
    this.data = data; // payload para operações de token
  }

  calculateHash() {
    const base = this.fromAddress + this.toAddress + this.amount + this.timestamp;
    const extra = (this.type && this.type !== "TRANSFER") || this.data
      ? this.type + JSON.stringify(this.data)
      : "";
    return crypto.createHash("sha256").update(base + extra).digest("hex");
  }

  signTransaction(signingKey) {
    if (signingKey.getPublic("hex") !== this.fromAddress) {
      throw new Error("Você só pode assinar transações da sua própria carteira!");
    }
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, "base64");
    this.signature = sig.toDER("hex");
  }

  isValid() {
    if (this.fromAddress === null) return true; // recompensa de mineração
    if (!this.signature || this.signature.length === 0) {
      throw new Error("Transação sem assinatura!");
    }
    const publicKey = ec.keyFromPublic(this.fromAddress, "hex");
    return publicKey.verify(this.calculateHash(), this.signature);
  }
}

module.exports = Transaction;

// CEREBRO Faucet — envia 10 CBR para qualquer endereço (uso educacional)
const Blockchain = require("../src/Blockchain");
const Transaction = require("../src/Transaction");
const { salvar, carregar } = require("../src/persistencia");
const { ec } = require("../src/crypto");

const FAUCET_AMOUNT = 10;
const FAUCET_PRIVATE_KEY = process.env.FAUCET_KEY || "faucet00000000000000000000000001";

const destinoAddr = process.argv[2];
if (!destinoAddr) {
  console.error("Uso: node scripts/faucet.js <endereço-destino>");
  process.exit(1);
}

const blockchain = carregar();
const keyPair = ec.keyFromPrivate(FAUCET_PRIVATE_KEY.padEnd(64, "0").slice(0, 64), "hex");
const fromAddress = keyPair.getPublic("hex");

const saldo = blockchain.getBalanceOfAddress(fromAddress);
if (saldo < FAUCET_AMOUNT) {
  console.log(`⚠️  Faucet sem saldo suficiente (${saldo} CBR). Mine primeiro: node scripts/2-minerar-bloco.js`);
  process.exit(1);
}

const tx = new Transaction(fromAddress, destinoAddr, FAUCET_AMOUNT);
tx.signTransaction(keyPair);
blockchain.adicionarTransacao(tx);
blockchain.minerarTransacoesPendentes(fromAddress);
salvar(blockchain);

console.log(`✅ Faucet enviou ${FAUCET_AMOUNT} CBR para ${destinoAddr}`);
console.log(`   Saldo atual do destino: ${blockchain.getBalanceOfAddress(destinoAddr)} CBR`);

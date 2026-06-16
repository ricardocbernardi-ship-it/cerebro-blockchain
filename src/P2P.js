// Camada de rede P2P — nós conversam entre si, sincronizam blocos e transações.
// Regra de consenso: cadeia mais longa válida vence (igual Bitcoin/Nakamoto consensus).
const WebSocket = require("ws");
const Block = require("./Block");
const Transaction = require("./Transaction");

const TIPO = {
  QUERY_LATEST: "QUERY_LATEST",
  QUERY_ALL: "QUERY_ALL",
  RESPONSE_BLOCKCHAIN: "RESPONSE_BLOCKCHAIN",
  NEW_TRANSACTION: "NEW_TRANSACTION",
};

let sockets = [];

function reviveBlock(b) {
  const txs = (b.transactions || []).map(reviveTx);
  const block = new Block(b.timestamp, txs, b.previousHash);
  block.nonce = b.nonce;
  block.hash = b.hash;
  return block;
}
function reviveTx(t) {
  const tx = new Transaction(t.fromAddress, t.toAddress, t.amount, t.type || "TRANSFER", t.data || null);
  tx.timestamp = t.timestamp;
  tx.signature = t.signature;
  return tx;
}

function initP2PServer(port, blockchain, salvar) {
  const server = new WebSocket.Server({ port });
  server.on("connection", (ws) => initConnection(ws, blockchain, salvar));
  console.log(`  🌐 Servidor P2P escutando na porta ${port}`);
  return server;
}

function connectToPeer(peerUrl, blockchain, salvar) {
  const ws = new WebSocket(peerUrl);
  ws.on("open", () => initConnection(ws, blockchain, salvar));
  ws.on("error", () => console.log(`  ⚠️  Não foi possível conectar a ${peerUrl}`));
}

function initConnection(ws, blockchain, salvar) {
  sockets.push(ws);
  console.log(`  🔗 Peer conectado (${sockets.length} no total)`);

  ws.on("message", (data) => handleMessage(ws, data, blockchain, salvar));
  ws.on("close", () => {
    sockets = sockets.filter((s) => s !== ws);
    console.log(`  ❌ Peer desconectado (${sockets.length} restantes)`);
  });
  ws.on("error", () => { sockets = sockets.filter((s) => s !== ws); });

  send(ws, { type: TIPO.QUERY_LATEST });
}

function handleMessage(ws, data, blockchain, salvar) {
  let message;
  try { message = JSON.parse(data); } catch { return; }

  switch (message.type) {
    case TIPO.QUERY_LATEST:
      send(ws, { type: TIPO.RESPONSE_BLOCKCHAIN, data: [blockchain.getLatestBlock()] });
      break;
    case TIPO.QUERY_ALL:
      send(ws, { type: TIPO.RESPONSE_BLOCKCHAIN, data: blockchain.chain });
      break;
    case TIPO.RESPONSE_BLOCKCHAIN:
      handleBlockchainResponse(message.data, ws, blockchain, salvar);
      break;
    case TIPO.NEW_TRANSACTION:
      handleNewTransaction(message.data, blockchain, salvar);
      break;
  }
}

function handleBlockchainResponse(data, ws, blockchain, salvar) {
  if (!data || data.length === 0) return;
  const recebidos = data.map(reviveBlock);
  const ultimoRecebido = recebidos[recebidos.length - 1];
  const ultimoAtual = blockchain.getLatestBlock();

  if (ultimoRecebido.hash === ultimoAtual.hash) return; // já sincronizado

  if (recebidos.length === 1 && ultimoRecebido.previousHash === ultimoAtual.hash) {
    blockchain.chain.push(ultimoRecebido);
    salvar(blockchain);
    console.log("  ✅ Novo bloco recebido da rede e adicionado! Total:", blockchain.chain.length);
    broadcast({ type: TIPO.RESPONSE_BLOCKCHAIN, data: [blockchain.getLatestBlock()] });
  } else if (recebidos.length === 1) {
    send(ws, { type: TIPO.QUERY_ALL }); // pode estar atrasado — pede a cadeia completa
  } else {
    substituirCadeiaSeMelhor(recebidos, blockchain, salvar);
  }
}

function substituirCadeiaSeMelhor(recebidos, blockchain, salvar) {
  const atual = blockchain.chain;
  blockchain.chain = recebidos;
  const valido = blockchain.isChainValid();
  blockchain.chain = atual;

  if (valido && recebidos.length > atual.length) {
    console.log("  🔄 Cadeia recebida é mais longa e válida — substituindo a nossa.");
    blockchain.chain = recebidos;
    salvar(blockchain);
    broadcast({ type: TIPO.RESPONSE_BLOCKCHAIN, data: [blockchain.getLatestBlock()] });
  } else {
    console.log("  ℹ️  Cadeia recebida não supera a nossa — mantendo a atual.");
  }
}

function handleNewTransaction(txData, blockchain, salvar) {
  try {
    const tx = reviveTx(txData);
    const jaTem = blockchain.pendingTransactions.some((t) => t.signature === tx.signature);
    if (jaTem) return;
    blockchain.adicionarTransacao(tx);
    salvar(blockchain);
    console.log("  📥 Nova transação recebida da rede e adicionada à fila.");
    broadcast({ type: TIPO.NEW_TRANSACTION, data: txData });
  } catch (e) {
    console.log("  ⚠️  Transação recebida da rede foi rejeitada:", e.message);
  }
}

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}
function broadcast(message) { sockets.forEach((s) => send(s, message)); }

function broadcastNovoBloco(blockchain) {
  broadcast({ type: TIPO.RESPONSE_BLOCKCHAIN, data: [blockchain.getLatestBlock()] });
}
function broadcastNovaTransacao(tx) {
  broadcast({ type: TIPO.NEW_TRANSACTION, data: tx });
}
function getSockets() { return sockets; }

module.exports = { initP2PServer, connectToPeer, broadcastNovoBloco, broadcastNovaTransacao, getSockets };

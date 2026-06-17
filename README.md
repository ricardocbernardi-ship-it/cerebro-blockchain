# 🧠 CEREBRO Blockchain

**A blockchain mais acessível do mundo.** Smart Contracts em JavaScript. NFTs nativos. DEX AMM. Staking. Tudo grátis.

[![GitHub](https://img.shields.io/badge/GitHub-cerebro--blockchain-a259ff?style=flat&logo=github)](https://github.com/ricardocbernardi-ship-it/cerebro-blockchain)
[![Site](https://img.shields.io/badge/Site-GitHub%20Pages-00e676?style=flat)](https://ricardocbernardi-ship-it.github.io/cerebro-blockchain/)
[![Versão](https://img.shields.io/badge/versão-3.0.0-a259ff?style=flat)](https://github.com/ricardocbernardi-ship-it/cerebro-blockchain)

---

## ✨ O que é o CEREBRO?

CEREBRO é uma blockchain proof-of-work construída do zero em Node.js, com:

| Feature | Ethereum | Solana | **CEREBRO** |
|---------|----------|--------|-------------|
| Linguagem de contratos | Solidity | Rust | **JavaScript ✓** |
| Taxa de gas | $5–$100 | $0.0003 | **Grátis ✓** |
| DEX nativo | ✗ | ✗ | **✓** |
| NFT nativo | ✗ | Metaplex | **✓** |
| Staking nativo | ✗ | ✗ | **✓** |
| Supply máximo | ∞ | ∞ | **21M CBR** |

---

## 🚀 Começar em 3 comandos

```bash
git clone https://github.com/ricardocbernardi-ship-it/cerebro-blockchain
cd cerebro-blockchain
npm install && node no-completo.js
```

Abra: `http://localhost:3001/explorer.html`

---

## 🔧 SDK JavaScript

```js
const cerebro = require('./cerebro.js');

// Ver estatísticas da rede
const stats = await cerebro.getStats();
console.log(stats.blocos, 'blocos', stats.supplyTotal, 'CBR');

// Gerar carteira
const { privateKey, publicKey } = await cerebro.gerarCarteira();

// Receber CBR grátis
await cerebro.faucet(publicKey);

// Criar token CBRC-20
await cerebro.deployToken('MeuToken', 'MTK', 1000000, 18, privateKey);

// Mintar NFT CBRC-721
await cerebro.mintNFT('Arte #1', 'Minha arte', '', 'MinhaColecao', privateKey);

// Deploy de smart contract em JavaScript
const code = `
  function votar(candidato) {
    state.votos = state.votos || {};
    state.votos[candidato] = (state.votos[candidato] || 0) + 1;
    emit('Voto', { candidato });
    return state.votos;
  }
`;
const { contractAddress } = await cerebro.deployContrato('Votacao', code, privateKey);

// Trocar tokens no DEX
await cerebro.swap('CBR', 'MTK', 100, privateKey);

// Fazer stake
await cerebro.stake(500, privateKey);
```

---

## 📡 API REST (30+ endpoints)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stats` | Estatísticas da rede |
| GET | `/api/balance/:addr` | Saldo CBR |
| POST | `/api/transfer` | Enviar CBR |
| POST | `/api/mine` | Minerar bloco |
| POST | `/api/faucet` | Receber CBR grátis |
| POST | `/api/token/deploy` | Criar token CBRC-20 |
| POST | `/api/nft/mint` | Mintar NFT CBRC-721 |
| POST | `/api/contract/deploy` | Deploy de contrato |
| POST | `/api/contract/call` | Chamar contrato |
| POST | `/api/swap` | Swap no DEX |
| POST | `/api/stake` | Fazer staking |
| GET | `/api/nfts` | Listar todos os NFTs |
| GET | `/api/contracts` | Listar contratos |
| GET | `/api/pools` | Listar pools DEX |

---

## 🌐 Interfaces Web Incluídas

- **`/explorer.html`** — Explorer: blocos, transações, NFTs, contratos, DEX em tempo real
- **`/wallet.html`** — Carteira completa: envia CBR, tokens, NFTs, swap, staking
- **`/marketplace.html`** — Marketplace de NFTs CBRC-721
- **`/whitepaper.html`** — Whitepaper técnico v3.0
- **`/templates.html`** — 8 smart contracts prontos (DAO, loteria, escrow, multisig...)

---

## ⚙️ Variáveis de Ambiente

```env
PORT=3001          # Porta da API (padrão: 3001)
P2P_PORT=6001      # Porta P2P (padrão: 6001)
DISABLE_P2P=true   # Desativar P2P (para Render.com)
PEERS=             # Peers iniciais separados por vírgula
```

---

## 💡 Templates de Smart Contracts

Prontos para usar em `http://localhost:3001/templates.html`:

- 🔐 **Vault** — Cofre com timelock
- 🗳️ **DAO** — Votação descentralizada
- 🎰 **Lottery** — Loteria on-chain
- 🤝 **Escrow** — Pagamento condicional
- 🔑 **Multisig** — Carteira multi-assinatura
- 📜 **DocRegistry** — Registro de documentos
- ⭐ **PointsSystem** — Programa de fidelidade
- ⏱️ **ChainTimer** — Agendamentos on-chain

---

## 📊 Economia do CBR

- **Supply máximo:** 21.000.000 CBR (igual ao Bitcoin)
- **Recompensa inicial:** 50 CBR/bloco
- **Halving:** a cada 210.000 blocos
- **Consenso:** Proof of Work SHA-256
- **Criptografia:** secp256k1 (mesmo do Bitcoin/Ethereum)

---

## 🚀 Deploy Gratuito (Render.com)

O arquivo `render.yaml` já está configurado. Acesse [render.com](https://render.com), conecte o GitHub e faça deploy com 1 clique. URL permanente: `cerebro-blockchain.onrender.com`

---

## 📄 Licença

MIT — Livre para usar, modificar e distribuir.

**Criado por:** Ricardo C. Bernardi  
**Site:** https://ricardocbernardi-ship-it.github.io/cerebro-blockchain/  
**GitHub:** https://github.com/ricardocbernardi-ship-it/cerebro-blockchain

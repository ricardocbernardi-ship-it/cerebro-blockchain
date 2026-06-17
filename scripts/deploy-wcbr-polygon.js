/**
 * CEREBRO — Deploy do wCBR (Wrapped CBR) na Polygon
 * Cria o token CBR na rede Polygon para ter liquidez em exchanges
 *
 * Uso: node scripts/deploy-wcbr-polygon.js
 * Precisa: MATIC na carteira para pagar gas (~0.01 MATIC)
 */

// ─── CONFIGURAÇÃO ────────────────────────────────────────────
const WALLET  = "0x47cB0B49a833DE86c74b646536c8ee6a4555B38b"; // Nova carteira
const RPC_URL = "https://polygon-rpc.com"; // RPC público Polygon
// NUNCA coloque a private key aqui — ler do arquivo seguro
const KEY_FILE = "C:\\Users\\usuario\\Downloads\\seguranca-crypto\\NOVA-CARTEIRA.env";

// ─── CONTRATO ERC-20 wCBR ────────────────────────────────────
// ABI mínimo ERC-20
const ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// Bytecode do contrato ERC-20 simples (OpenZeppelin compilado)
// Para usar: compile o contrato abaixo com Remix IDE (remix.ethereum.org)
// e copie o bytecode gerado

const CONTRATO_SOLIDITY = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WrappedCBR is ERC20, Ownable {
    constructor() ERC20("Wrapped CEREBRO", "wCBR") Ownable(msg.sender) {
        // 21 milhões de wCBR = supply máximo do CEREBRO
        _mint(msg.sender, 21_000_000 * 10**decimals());
    }

    // Queimar quando fazer bridge de volta para CEREBRO
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
`;

// ─── INSTRUÇÕES DE DEPLOY ─────────────────────────────────────
console.log("╔══════════════════════════════════════════════════╗");
console.log("║   CEREBRO — Deploy wCBR na Polygon              ║");
console.log("╚══════════════════════════════════════════════════╝\n");

console.log("PASSO 1 — Abrir Remix IDE:");
console.log("  https://remix.ethereum.org\n");

console.log("PASSO 2 — Criar arquivo WrappedCBR.sol e colar o código acima\n");

console.log("PASSO 3 — Compilar:");
console.log("  Aba 'Solidity Compiler' → Compiler 0.8.20 → Compile\n");

console.log("PASSO 4 — Conectar MetaMask na Polygon:");
console.log("  Aba 'Deploy' → Environment: 'Injected Provider - MetaMask'");
console.log("  Rede: Polygon Mainnet (Chain ID: 137)\n");

console.log("PASSO 5 — Deploy:");
console.log("  Clicar 'Deploy' → Confirmar no MetaMask (~0.01 MATIC de gas)\n");

console.log("PASSO 6 — Copiar o endereço do contrato e guardar!\n");

console.log("PASSO 7 — Verificar no Polygonscan:");
console.log("  https://polygonscan.com\n");

console.log("PASSO 8 — Adicionar liquidez no QuickSwap:");
console.log("  https://quickswap.exchange/#/add");
console.log("  Par: wCBR / MATIC");
console.log("  Você define o preço inicial!\n");

console.log("═══════════════════════════════════════════════════");
console.log("CONTRATO SOLIDITY:");
console.log("═══════════════════════════════════════════════════");
console.log(CONTRATO_SOLIDITY);

console.log("\n═══════════════════════════════════════════════════");
console.log("DEPOIS DO DEPLOY — enviar para CoinGecko:");
console.log("  https://www.coingecko.com/en/coins/new");
console.log("  Preencher com o endereço do contrato na Polygon");
console.log("═══════════════════════════════════════════════════");

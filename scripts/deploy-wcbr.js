/**
 * Deploy wCBR (Wrapped CEREBRO) na Polygon Mainnet
 * Compila e deploya o contrato ERC-20 automaticamente
 */
const { ethers } = require("ethers");
const solc = require("solc");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────
const RPC     = "https://polygon-bor-rpc.publicnode.com";
const KEYFILE = "C:\\Users\\usuario\\Downloads\\seguranca-crypto\\NOVA-CARTEIRA.env";
const WALLET  = "0x47cB0B49a833DE86c74b646536c8ee6a4555B38b";

// ── Contrato Solidity — Mínimo para reduzir gas ──────────────
const SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract WrappedCBR {
    string public constant name = "Wrapped CEREBRO";
    string public constant symbol = "wCBR";
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor() {
        totalSupply = 21000000 * 10**18;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    function transfer(address to, uint256 v) public returns (bool) {
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        emit Transfer(msg.sender, to, v);
        return true;
    }
    function approve(address s, uint256 v) public returns (bool) {
        allowance[msg.sender][s] = v;
        emit Approval(msg.sender, s, v);
        return true;
    }
    function transferFrom(address from, address to, uint256 v) public returns (bool) {
        allowance[from][msg.sender] -= v;
        balanceOf[from] -= v;
        balanceOf[to] += v;
        emit Transfer(from, to, v);
        return true;
    }
}
`;

function compilar() {
  console.log("🔧 Compilando contrato Solidity...");
  const input = {
    language: "Solidity",
    sources: { "WrappedCBR.sol": { content: SOURCE } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const erros = output.errors.filter(e => e.severity === "error");
    if (erros.length) { console.error("Erros:", erros); process.exit(1); }
  }
  const contrato = output.contracts["WrappedCBR.sol"]["WrappedCBR"];
  console.log("✅ Compilado com sucesso!");
  return { abi: contrato.abi, bytecode: contrato.evm.bytecode.object };
}

function lerChave() {
  const conteudo = fs.readFileSync(KEYFILE, "utf8");
  const match = conteudo.match(/PRIVATE_KEY=(.+)/);
  if (!match) throw new Error("PRIVATE_KEY não encontrada no arquivo");
  return match[1].trim();
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   CEREBRO — Deploy wCBR na Polygon Mainnet      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Compilar
  const { abi, bytecode } = compilar();

  // 2. Conectar
  console.log("🔗 Conectando à Polygon...");
  const provider = new ethers.JsonRpcProvider(RPC);
  const network  = await provider.getNetwork();
  console.log(`✅ Rede: ${network.name} (Chain ID: ${network.chainId})`);

  // 3. Carteira
  const privateKey = lerChave();
  const signer = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(WALLET);
  const matic   = parseFloat(ethers.formatEther(balance));
  console.log(`💰 Saldo: ${matic.toFixed(4)} MATIC`);

  if (matic < 0.005) {
    console.error("❌ MATIC insuficiente. Precisa de ao menos 0.005 MATIC.");
    process.exit(1);
  }

  // 4. Gas — usa preço baixo para esperar janela mais barata
  const feeData  = await provider.getFeeData();
  const netGas   = feeData.gasPrice || ethers.parseUnits("100", "gwei");
  // Usa 80 Gwei máximo para caber no saldo — tx fica pendente até rede baixar
  const gasPrice = netGas < ethers.parseUnits("80", "gwei") ? netGas : ethers.parseUnits("80", "gwei");
  const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, "gwei")).toFixed(1);
  console.log(`⛽ Gas price definido: ${gasPriceGwei} Gwei`);

  const gasLimit = 800_000n;
  const custEst  = parseFloat(ethers.formatEther(gasPrice * gasLimit));
  console.log(`💸 Custo máximo: ~${custEst.toFixed(4)} MATIC (saldo: ${matic.toFixed(4)})`);

  // 4. Deploy
  console.log("\n🚀 Deployando wCBR (type-0 legacy, sem EIP-1559)...");
  const factory  = new ethers.ContractFactory(abi, bytecode, signer);
  const contrato = await factory.deploy({ gasLimit: 800_000, gasPrice, type: 0 });
  console.log(`📡 TX enviada: ${contrato.deploymentTransaction().hash}`);
  console.log("⏳ Aguardando confirmação...");

  await contrato.waitForDeployment();
  const endereco = await contrato.getAddress();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   ✅ wCBR DEPLOYADO COM SUCESSO!                 ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Endereço: ${endereco}`);
  console.log(`  Rede: Polygon Mainnet`);
  console.log(`  Supply: 21,000,000 wCBR`);
  console.log(`  Polygonscan: https://polygonscan.com/token/${endereco}`);
  console.log("\n  PRÓXIMOS PASSOS:");
  console.log("  1. Adicionar wCBR no MetaMask");
  console.log("     Token: " + endereco);
  console.log("  2. Criar pool no QuickSwap:");
  console.log("     https://quickswap.exchange/#/add");
  console.log("  3. Cadastrar no CoinGecko:");
  console.log("     https://www.coingecko.com/en/coins/new");
  console.log(`\n  Salvar endereço: ${endereco}\n`);

  // Salvar resultado
  const resultado = {
    contrato: "WrappedCBR",
    simbolo: "wCBR",
    rede: "Polygon Mainnet",
    chainId: 137,
    endereco,
    txHash: contrato.deploymentTransaction().hash,
    supply: "21000000",
    decimals: 18,
    deployer: WALLET,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "dados", "wcbr-polygon.json"),
    JSON.stringify(resultado, null, 2)
  );
  console.log("  Dados salvos em dados/wcbr-polygon.json");
}

main().catch(err => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});

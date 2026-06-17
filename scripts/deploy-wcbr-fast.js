/**
 * Deploy wCBR RÁPIDO — cancela tx pendente e deploya com gas atual
 */
const { ethers } = require("ethers");
const solc = require("solc");
const fs = require("fs");
const path = require("path");

const RPC     = "https://polygon-bor-rpc.publicnode.com";
const KEYFILE = "C:\\Users\\usuario\\Downloads\\seguranca-crypto\\NOVA-CARTEIRA.env";
const WALLET  = "0x47cB0B49a833DE86c74b646536c8ee6a4555B38b";

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
  const input = { language:"Solidity", sources:{"W.sol":{content:SOURCE}}, settings:{outputSelection:{"*":{"*":["abi","evm.bytecode"]}}} };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const c = out.contracts["W.sol"]["WrappedCBR"];
  return { abi: c.abi, bytecode: c.evm.bytecode.object };
}

function lerChave() {
  const m = fs.readFileSync(KEYFILE,"utf8").match(/PRIVATE_KEY=(.+)/);
  return m[1].trim();
}

async function main() {
  console.log("\n🧠 CEREBRO — Deploy wCBR Polygon (FAST)\n");

  const { abi, bytecode } = compilar();
  console.log("✅ Contrato compilado");

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(lerChave(), provider);

  const saldo = parseFloat(ethers.formatEther(await provider.getBalance(WALLET)));
  console.log(`💰 Saldo: ${saldo.toFixed(2)} POL`);

  // Gas price atual + 30% de margem para confirmar rápido
  const feeData    = await provider.getFeeData();
  const gasPrice   = feeData.gasPrice * 130n / 100n;
  const gasPriceGw = parseFloat(ethers.formatUnits(gasPrice,"gwei")).toFixed(0);
  const gasLimit   = 800_000n;
  const custo      = parseFloat(ethers.formatEther(gasPrice * gasLimit));
  console.log(`⛽ Gas: ${gasPriceGw} Gwei | Custo: ~${custo.toFixed(3)} POL`);

  // Nonce atual (inclui tx pendente)
  const nonce = await provider.getTransactionCount(WALLET, "latest");
  console.log(`🔢 Nonce: ${nonce}`);

  console.log("\n🚀 Enviando deploy...");
  const factory  = new ethers.ContractFactory(abi, bytecode, signer);
  const contrato = await factory.deploy({ gasLimit, gasPrice, type:0, nonce });

  const txHash = contrato.deploymentTransaction().hash;
  console.log(`📡 TX: ${txHash}`);
  console.log("⏳ Aguardando confirmação na Polygon...");

  await contrato.waitForDeployment();
  const endereco = await contrato.getAddress();

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  ✅ wCBR DEPLOYADO NA POLYGON!       ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  Endereço: ${endereco}`);
  console.log(`  TX Hash:  ${txHash}`);
  console.log(`  Polygonscan: https://polygonscan.com/token/${endereco}`);

  const dir = path.join(__dirname,"..","dados");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"wcbr-polygon.json"), JSON.stringify({
    contrato:"WrappedCBR", simbolo:"wCBR", rede:"Polygon Mainnet",
    chainId:137, endereco, txHash, supply:"21000000", decimals:18,
    deployer:WALLET, timestamp:new Date().toISOString()
  },null,2));

  console.log("\n  PRÓXIMO PASSO:");
  console.log("  Criar pool wCBR/POL no QuickSwap:");
  console.log("  https://quickswap.exchange/#/add");
  console.log(`  Token A: ${endereco}`);
  console.log("  Token B: POL (nativo)\n");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });

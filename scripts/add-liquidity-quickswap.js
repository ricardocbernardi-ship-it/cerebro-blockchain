/**
 * CEREBRO — Adicionar Liquidez wCBR/POL no QuickSwap (Polygon)
 * Cria o pool e define o preço inicial do wCBR
 *
 * ⚠️  DEFINA OS VALORES ANTES DE RODAR:
 *     WCBR_AMOUNT = quantidade de wCBR a depositar
 *     POL_AMOUNT  = quantidade de POL a depositar
 *
 *     Isso define o PREÇO INICIAL: 1 wCBR = (POL_AMOUNT / WCBR_AMOUNT) POL
 */
const { ethers } = require("ethers");
const fs = require("fs");

const RPC    = "https://polygon-bor-rpc.publicnode.com";
const KEYFILE= "C:\\Users\\usuario\\Downloads\\seguranca-crypto\\NOVA-CARTEIRA.env";

// ── CONTRATO wCBR DEPLOYADO ─────────────────────────────────
const WCBR   = "0x208B65B781245AB72419FD6b159c65818ca69C08";

// ── QUICKSWAP V2 ROUTER (Polygon Mainnet) ───────────────────
const ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

// ── CONFIGURE AQUI OS VALORES ───────────────────────────────
// Exemplo: 10 POL + 1.000.000 wCBR = 1 wCBR = 0.00001 POL
const POL_AMOUNT  = "10";        // POL a depositar
const WCBR_AMOUNT = "1000000";   // wCBR a depositar (de 21.000.000 disponíveis)
// Preço resultante: 1 wCBR = (10/1.000.000) = 0,00001 POL

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

function lerChave() {
  const m = fs.readFileSync(KEYFILE,"utf8").match(/PRIVATE_KEY=(.+)/);
  return m[1].trim();
}

async function main() {
  const polAmt  = ethers.parseEther(POL_AMOUNT);
  const wcbrAmt = ethers.parseUnits(WCBR_AMOUNT, 18);

  console.log("\n🧠 CEREBRO — Liquidity wCBR/POL no QuickSwap\n");
  console.log(`  wCBR a depositar: ${WCBR_AMOUNT}`);
  console.log(`  POL a depositar:  ${POL_AMOUNT}`);
  console.log(`  Preço inicial:    1 wCBR = ${(parseFloat(POL_AMOUNT)/parseFloat(WCBR_AMOUNT)).toFixed(8)} POL\n`);

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(lerChave(), provider);
  const wallet   = await signer.getAddress();

  const feeData  = await provider.getFeeData();
  const gasPrice = feeData.gasPrice * 130n / 100n;
  const opts     = { gasPrice, type: 0 };

  // 1. Verificar saldo wCBR
  const wcbrContract = new ethers.Contract(WCBR, ERC20_ABI, signer);
  const saldoWcbr    = await wcbrContract.balanceOf(wallet);
  console.log(`  Saldo wCBR: ${ethers.formatUnits(saldoWcbr, 18)}`);
  if (saldoWcbr < wcbrAmt) { console.error("❌ wCBR insuficiente"); process.exit(1); }

  // 2. Aprovar Router a gastar wCBR
  console.log("⏳ Aprovando Router a gastar wCBR...");
  const allowance = await wcbrContract.allowance(wallet, ROUTER);
  if (allowance < wcbrAmt) {
    const tx = await wcbrContract.approve(ROUTER, wcbrAmt, opts);
    await tx.wait();
    console.log("✅ Aprovado!");
  } else {
    console.log("✅ Já aprovado!");
  }

  // 3. Adicionar liquidez
  console.log("⏳ Adicionando liquidez no QuickSwap...");
  const router   = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now()/1000) + 600; // 10 min

  const tx = await router.addLiquidityETH(
    WCBR,
    wcbrAmt,
    wcbrAmt * 90n / 100n, // 10% slippage mín
    polAmt  * 90n / 100n,
    wallet,
    deadline,
    { ...opts, value: polAmt, gasLimit: 3_000_000 }
  );

  console.log(`📡 TX: ${tx.hash}`);
  const receipt = await tx.wait();

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  ✅ POOL wCBR/POL CRIADO NO QUICKSWAP!    ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log(`  TX: ${receipt.hash}`);
  console.log(`  Pool criado! wCBR tem preço agora.`);
  console.log(`  DexTools: https://www.dextools.io/app/polygon/pair-explorer`);
  console.log(`  GeckoTerminal: https://www.geckoterminal.com/polygon_pos/pools`);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });

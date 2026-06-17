const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/polygon");
  const wallet = "0x47cB0B49a833DE86c74b646536c8ee6a4555B38b";
  const balance = await provider.getBalance(wallet);
  const matic = ethers.formatEther(balance);
  console.log("Carteira:", wallet);
  console.log("MATIC:", matic);
  console.log("Suficiente para deploy (precisa ~0.01):", parseFloat(matic) >= 0.01 ? "SIM ✓" : "NAO — precisa comprar MATIC");
}

main().catch(console.error);

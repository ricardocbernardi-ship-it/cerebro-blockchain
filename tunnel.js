const localtunnel = require("localtunnel");

(async () => {
  while (true) {
    try {
      const tunnel = await localtunnel({ port: 3001, subdomain: "cerebro-blockchain" });
      console.log("CEREBRO Tunnel URL:", tunnel.url);
      console.log("Explorer:", tunnel.url + "/explorer.html");
      console.log("Wallet:  ", tunnel.url + "/wallet.html");
      tunnel.on("close", () => console.log("Tunnel fechado, reconectando..."));
      await new Promise((res) => tunnel.on("close", res));
    } catch (e) {
      console.error("Erro no tunnel:", e.message, "— tentando em 10s...");
      await new Promise((res) => setTimeout(res, 10000));
    }
  }
})();

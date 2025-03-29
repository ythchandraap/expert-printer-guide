function getLocalIPAddress() {
  const os = require("os");
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        if (!net.address.endsWith(".1")) {
          return net.address;
        }
      }
    }
  }
  return "127.0.0.1";
}

module.exports = { getLocalIPAddress };

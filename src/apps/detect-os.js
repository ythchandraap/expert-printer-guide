function detectOSInElectron() {
  const platform = process.platform;

  switch (platform) {
    case "win32":
      return "Windows";
    case "darwin":
      return "macOS";
    case "linux":
      return "Linux";
    case "freebsd":
      return "FreeBSD";
    case "openbsd":
      return "OpenBSD";
    case "sunos":
      return "SunOS";
    case "aix":
      return "AIX";
    default:
      return "Unknown OS";
  }
}

module.exports = { detectOSInElectron };

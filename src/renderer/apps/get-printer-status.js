function getPrinterStatus(operating, statusCode) {
  const system = operating ?? os;

  if (system === "Windows") {
    if ([2, 4, 8, 16, 32, 64, 128].includes(statusCode)) return "Error";
    if (statusCode === 0) return "Success";
    if (statusCode === 3) return "Not Connected";
    return "Unknown";
  }

  if (system === "macOS") {
    if (statusCode === 0) return "Success";
    if ([4, 5].includes(statusCode)) return "Error";
    if (statusCode === 3) return "Not Connected";
    return "Unknown";
  }

  if (system === "Linux") {
    if (statusCode === 3) return "Idle";
    if (statusCode === 4) return "Success";
    if (statusCode === 5) return "Error";
    return "Unknown";
  }

  return "Unknown"; // For unsupported operating systems
}

module.exports = { getPrinterStatus };

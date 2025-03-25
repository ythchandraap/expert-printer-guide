function detectOS() {
  const userAgent = window.navigator.userAgent;

  if (userAgent.includes("Win")) {
    return "Windows";
  } else if (userAgent.includes("Mac")) {
    return "macOS";
  } else if (userAgent.includes("Linux")) {
    return "Linux";
  } else if (userAgent.includes("Android")) {
    return "Android";
  } else if (userAgent.includes("like Mac")) {
    return "iOS";
  } else {
    return "Unknown OS";
  }
}

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

const os = detectOS();
function getPrinterStatusClassification(statusCode) {
  // Classify the status codes into broader categories
  if ([2, 4, 8, 16, 32, 64, 128].includes(statusCode)) {
    return "Error"; // Covers codes like Error, Paper Jam, Out of Paper, etc.
  } else if (statusCode === 0) {
    return "Success"; // Printer is Ready/Idle
  } else if ([3, 5].includes(statusCode)) {
    return "Idle"; // Could represent some form of idle behavior
  } else if (statusCode === 3 || statusCode === 128) {
    return "Not Connected"; // Covers cases where the printer is offline
  } else {
    return "Unknown"; // Any undefined or unhandled status
  }
}

function getPrinterStatusDescription(operating, statusCode) {
  let description = "Unknown Status";
  const system = operating ?? os;

  if (system === "Windows") {
    const windowsStatuses = {
      0: "Ready/Idle",
      1: "Paused",
      2: "Error",
      4: "Pending Deletion",
      8: "Paper Jam",
      16: "Paper Out",
      32: "Manual Feed Required",
      64: "Paper Problem",
      128: "Offline",
    };
    description = windowsStatuses[statusCode] || "Unknown Status";
  } else if (system === "macOS") {
    const macStatuses = {
      0: "No Error",
      3: "Offline/Not Connected",
      4: "Out of Paper",
      5: "Paper Jam",
    };
    description = macStatuses[statusCode] || "Unknown Status";
  } else if (system === "Linux") {
    const linuxStatuses = {
      3: "Idle",
      4: "Printing",
      5: "Stopped/Error",
    };
    description = linuxStatuses[statusCode] || "Unknown Status";
  } else {
    description = "Printer status detection not supported for this OS.";
  }

  return description;
}
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

// Example usage:
const operatingSystem = "macOS";
const printerCode = 3;
const status = getPrinterStatus(operatingSystem, printerCode);
console.log(`Printer Status: ${status}`);

// Example usage:

const printerStatusCode = 8; // Replace with your actual status code
const statusDescription = getPrinterStatusDescription(os, printerStatusCode);
const classification = getPrinterStatusClassification(printerStatusCode);

console.log("Printer Status:", statusDescription);
console.log("Classification:", classification);

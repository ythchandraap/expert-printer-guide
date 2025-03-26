const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { writeFile, existsSync, mkdirSync, readFileSync } = require("fs");

const { print } = require("pdf-to-printer");
const { getPrinterStatus } = require("./renderer/apps/get-printer-status");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8, // 100 MB
});

let mainWindow;
let printWindow;
let realPrintWindow;
let printName = "";

io.on("connection", (socket) => {
  // Kirim IP saat client meminta
  setInterval(() => {
    socket.emit("localIP", getLocalIPAddress());
  }, 2500);

  socket.on("getPrinter", async (data, callback) => {
    try {
      if (!mainWindow) {
        callback?.({
          statusCode: 500,
          list: [],
          message: "Main window not found",
        });
      }

      const printers = await mainWindow.webContents.getPrintersAsync();

      if (typeof callback === "function") {
        callback({
          statusCode: 200,
          list: printers ?? [],
          message: "Here is your data",
        });
      } else {
        console.warn("Callback is missing or not a function.");
      }
    } catch (error) {
      console.warn("Error fetching printers:", error);
      callback?.({
        statusCode: 500,
        list: [],
        message: "Internal Server Error",
        error: error.message,
      });
    }
  });

  socket.on("checkPrinter", async (data, callback) => {
    if (!mainWindow) return;

    try {
      if (!data) {
        return callback?.({
          statusCode: 400,
          message: "No Printer Name Provided",
        });
      }

      let jsonObject;

      try {
        jsonStringfy = JSON?.stringify(data);
        jsonObject = JSON?.parse(jsonStringfy);
      } catch (err) {
        return callback?.({
          statusCode: 400,
          message: "Invalid JSON format",
          error: err,
        });
      }

      if (!jsonObject?.printer) {
        return callback?.({
          statusCode: 400,
          message: "Printer name is missing in request",
        });
      }

      const printerName = jsonObject.printer;
      const printers = await mainWindow.webContents.getPrintersAsync();
      const getSpecificPrinter = printers.find(
        (item) => item.name === printerName
      );

      if (!getSpecificPrinter) {
        return callback?.({
          statusCode: 404,
          message: `Printer '${printerName}' not found`,
          data: {},
        });
      }

      const OS = detectOSInElectron();
      const { status, ...rest } = getSpecificPrinter;
      const statusString = getPrinterStatus(OS, status);

      return callback?.({
        statusCode: 200,
        message: "Printer found",
        data: { status, statusString, ...rest },
      });
    } catch (error) {
      console.error("Error checking printer:", error);
      return callback?.({
        statusCode: 500,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  });

  socket.on(
    "printData",
    async ({ fileName, fileData, printerName }, callback) => {
      try {
        const buffer = Buffer.from(fileData);
        const uploadDir = getFilePath();
        const filePath = path.join(uploadDir, fileName);
        printName = printerName;

        // Simpan file
        writeFile(filePath, buffer, async (err) => {
          if (err) {
            console.error("❌ Failed to save file:", err);
            return callback?.({ statusCode: 500, message: "File save failed" });
          }

          console.log("✅ File saved successfully:", filePath);

          if (!existsSync(filePath)) {
            console.error("❌ File not found:", filePath);
            return callback?.({ statusCode: 500, message: "File not found" });
          }

          try {
            printWindow = new BrowserWindow({
              width: 800,
              height: 600,
              show: false,
              // process.env.MODE == "DEVELOPMENT" ? true : true,
              webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                nodeIntegration: false,
                contextIsolation: true,
              },
            });

            const htmlPath = path.resolve(
              __dirname,
              "./renderer/assets/pdf-viewer.html"
            );

            const fileUrl = `file://${path.join(
              htmlPath
            )}?file=${encodeURIComponent(filePath)}`;

            console.log("🔗 Loading file:", fileUrl);

            await printWindow.loadURL(fileUrl);
          } catch (printError) {
            console.error("❌ Printing error:", printError);
            return callback?.({
              statusCode: 500,
              message: "Print failed",
              error: printError.message,
            });
          }
        });
      } catch (error) {
        console.error("❌ Error in printData:", error);
        return callback?.({
          statusCode: 500,
          message: "Internal Server Error",
          error: error.message,
        });
      }
    }
  );
});

if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));
  // mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();
  httpServer.listen(18032, () => {
    console.warn("Socket.io server running on port 18032");
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle("print-from-viewer", async () => {
    try {
      if (!printWindow) {
        console.error("❌ No open PDF viewer to print from.");
        return;
      }

      const availablePrinters =
        await printWindow.webContents.getPrintersAsync();
      if (availablePrinters.length === 0) {
        console.error("❌ No printers available.");
        return;
      }

      const printer =
        availablePrinters.find((p) => p.name === printName) ||
        availablePrinters[0];

      console.log("🖨️ Using printer:", printer?.name ?? "No printer found");

      if (!printer) {
        console.error("❌ Printer not found.");
        return;
      }

      // Print the PDF from the opened viewer
      await printEachCanvas(printWindow, printer.name);

      console.log("✅ Print job completed!");
    } catch (error) {
      console.error("❌ Error in print process:", error);
    }
  });

  ipcMain.handle("get-ip", () => getLocalIPAddress());

  ipcMain.on("ping", (event) => {
    event.reply("pong");
  });

  ipcMain.handle("list-printer", async (event) => {
    if (mainWindow) {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers;
    }
  });
  ipcMain.handle("operating-system", async (event) => {
    if (mainWindow) {
      return detectOSInElectron();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Function

function getLocalIPAddress() {
  const os = require("os");
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
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

function getFilePath() {
  const os = require("os");
  const newBuild = path.join(os.homedir(), "Documents");
  const newBuildApps = path.join(os.homedir(), "Documents", "printer");

  switch (process.platform) {
    case "win32":
      if (!existsSync(newBuild)) {
        mkdirSync(newBuild);
      }
      if (!existsSync(newBuildApps)) {
        mkdirSync(newBuildApps);
      }
      return path.join(newBuildApps); // Windows
    case "darwin":
      if (!existsSync(newBuild)) {
        mkdirSync(newBuild);
      }

      if (!existsSync(newBuildApps)) {
        mkdirSync(newBuildApps);
      }
      return path.join(newBuildApps); // macOS
    case "linux":
      if (!existsSync(newBuild)) {
        mkdirSync(newBuild);
      }
      if (!existsSync(newBuildApps)) {
        mkdirSync(newBuildApps);
      }
      return path.join(newBuildApps); // Linux
    default:
      throw new Error("Unsupported OS");
  }
}

async function printCanvasForLabelPrinter(printWindow, printerName) {
  const printContainer = printWindow.webContents;
  console.log(`🖨️ Printing on paper printer: ${printerName}`);

  // Extract canvas data from the print window
  const pageCanvases = await printContainer.executeJavaScript(`
        [...document.querySelectorAll("canvas")].map(canvas => ({
            data: canvas.toDataURL("image/png", 1.0), // Use highest quality
            width: canvas.width,
            height: canvas.height
        }))
    `);

  // Constants for unit conversion
  const INCH = 25.4; // 1 inch = 25.4 mm
  const MICRON_TO_MM = 1000;
  const originalDPI = 850; // Original high-resolution DPI
  const targetDPI = 203; // Set printing DPI to 300 for better quality

  // Clear the print window and set up styles
  await printContainer.executeJavaScript(`
        document.body.innerHTML = "";
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.display = "block";

        const style = document.createElement("style");
        style.innerHTML = \`
            @media print {
                canvas {
                    page-break-after: always;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                canvas:last-child {
                    page-break-after: auto !important;
                }
            }
        \`;
        document.head.appendChild(style);
    `);

  let originalWidthMM = 0;
  let originalHeightMM = 0;
  for (const { data, width, height } of pageCanvases) {
    // Convert to mm
    originalWidthMM = (width * INCH) / originalDPI;
    originalHeightMM = (height * INCH) / originalDPI;

    // Adjust pixel size for high DPI printing
    const highResWidth = ((originalWidthMM * targetDPI) / INCH) * 0.9;
    const highResHeight = ((originalHeightMM * targetDPI) / INCH) * 0.9;

    console.log(`Canvas - Original Size: ${width}px x ${height}px`);
    console.log(
      `Canvas - Scaled for Print: ${highResWidth}px x ${highResHeight}px`
    );
    console.log(
      `Canvas - Physical Size: ${originalWidthMM - 2}mm x ${
        originalHeightMM - 2
      }mm`
    );

    // Render high-resolution canvas
    await printContainer.executeJavaScript(`
        new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Set high resolution for printing
            canvas.width = ${highResWidth};
            canvas.height = ${highResHeight};
            canvas.style.width = "${originalWidthMM - 2}mm";
            canvas.style.height = "${originalHeightMM - 2}mm";
            canvas.style.display = "block";
            canvas.style.margin = "0";
            canvas.style.padding = "0";

            // Enable high-quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            const img = new Image();
            img.src = "${data}";
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                document.body.appendChild(canvas);
                resolve();
            };
            img.onerror = reject;
        });
    `);
  }

  // Print the content with high-resolution settings
  await printContainer.print({
    silent: true,
    printBackground: true,
    deviceName: printerName,
    pageSize: {
      width: (originalWidthMM - 2) * MICRON_TO_MM,
      height: (originalHeightMM - 2) * MICRON_TO_MM,
    },
    margins: {
      marginType: "none", // Ensure no extra margins
    },
    dpi: targetDPI, // Use 300 DPI for sharper print quality
  });

  console.log("✅ High-quality print completed.");
}

async function printCanvasForPaperPrinter(printWindow, printerName) {
  const printContainer = printWindow.webContents;
  console.log(`🖨️ Printing on paper printer: ${printerName}`);

  // Extract canvas data from the print window
  const pageCanvases = await printContainer.executeJavaScript(`
        [...document.querySelectorAll("canvas")].map(canvas => ({
            data: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height
        }))
    `);

  // Constants for unit conversion
  const INCH = 25.4;
  const MICRON_TO_MM = 1000;
  const originalDPI = 850;
  const dpiValue = 203; // Higher DPI for paper printers

  // Clear the print window and set up styles
  await printContainer.executeJavaScript(`
        document.body.innerHTML = "";
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.display = "block";

        const style = document.createElement("style");
        style.innerHTML = \`
            @media print {
                canvas {
                    page-break-after: always;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                canvas:last-child {
                    page-break-after: auto !important;
                }
            }
        \`;
        document.head.appendChild(style);
    `);

  let originalWidth = 0;
  let originalHeight = 0;
  for (const { data, width, height } of pageCanvases) {
    originalWidth = (width * INCH) / originalDPI;
    originalHeight = (height * INCH) / originalDPI;

    // Render each canvas directly in the print window
    await printContainer.executeJavaScript(`
            new Promise((resolve, reject) => {
                const canvas = document.createElement("canvas");
                canvas.width = ${width};
                canvas.height = ${height};
                canvas.style.width = "${originalWidth}mm";
                canvas.style.height = "${originalHeight}mm";
                canvas.style.display = "block";
                canvas.style.margin = "0";
                canvas.style.padding = "0";

                const ctx = canvas.getContext("2d");
                const img = new Image();
                img.src = "${data}";
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, ${width}, ${height});
                    document.body.appendChild(canvas);
                    resolve();
                };
                img.onerror = reject;
            });
        `);
  }

  // Print the content with the calculated page size
  await printContainer.print({
    silent: true, // Allow print dialog for user preferences
    printBackground: true,
    deviceName: printerName,
    pageSize: {
      width: originalWidth * MICRON_TO_MM,
      height: originalHeight * MICRON_TO_MM,
    },
    margins: {
      marginType: "none", // Ensure no extra margins
    },
    dpi: 850,
  });

  console.log("✅ All pages printed.");
}

async function printEachCanvas(printWindow, printerName) {
  const printContainer = printWindow.webContents;
  const printers = await printContainer.getPrintersAsync();
  const selectedPrinter = printers.find((p) => p.name === printerName);

  if (!selectedPrinter) {
    console.error(`❌ Printer "${printerName}" not found.`);
    return;
  }

  const labelPrinterKeywords = ["Zebra", "Label", "TSC", "DYMO", "Brother QL"];
  const isLabelPrinter =
    labelPrinterKeywords.some((keyword) =>
      printerName.toLowerCase().includes(keyword.toLowerCase())
    ) || selectedPrinter?.paperSize?.width < 1000;

  if (isLabelPrinter) {
    console.log("🖨️ Detected as Label Printer");
    await printCanvasForLabelPrinter(printWindow, printerName);
  } else {
    console.log("🖨️ Detected as Paper Printer");
    await printCanvasForPaperPrinter(printWindow, printerName);
  }
}

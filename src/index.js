const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
  Tray,
} = require("electron");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const {
  writeFile,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} = require("fs");

let mainWindow;
let printWindow;
let alternativePrintWindow;
let requestFrom = null;
let printName = "";
let copies = 1;

let tray;

const httpServer = createServer((req, res) => {
  const { method, url, headers, ...rest } = req;
  try {
    res.setHeader("Content-Type", "application/json");
    if (method === "POST" && url === "/connect/print") {
      const contentType = headers["content-type"];
      let printDevice = headers["print-device"];
      copies = parseInt(headers["copies"]) ?? 1;

      if (!contentType || !contentType.includes("multipart/form-data")) {
        res.writeHead(400);
        return res.end(
          JSON.stringify({ error: "Expected multipart/form-data" })
        );
      }

      const boundary = "--" + contentType.split("boundary=")[1];

      const chunks = [];
      req.on("data", (chunk) => {
        chunks.push(chunk); // Binary-safe
      });

      req.on("end", async () => {
        requestFrom = "api";
        printName = printDevice;
        const printers = await mainWindow?.webContents?.getPrintersAsync();
        const getSpecificPrinter = printers?.find(
          (item) => item?.name === printName
        );

        if (!getSpecificPrinter) {
          const checkDefault = printers?.find(
            (item) => item?.isDefault == true
          );
          if (!checkDefault) {
            printDevice = printers?.[0].name;
          } else {
            printDevice = checkDefault?.name;
          }
        }

        const buffer = Buffer.concat(chunks); // Full raw body as buffer

        // Find file part
        const parts = buffer.toString().split(boundary);
        const filePart = parts.find((part) => part.includes("filename="));
        if (!filePart) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: "No file uploaded" }));
        }

        // Extract filename
        const filenameMatch = filePart.match(/filename="(.+?)"/);
        const fileName = filenameMatch ? filenameMatch[1] : "file.pdf";
        // Get raw binary data (cut off headers)
        const start = buffer.indexOf("\r\n\r\n") + 4;
        const end = buffer.lastIndexOf(`\r\n${boundary}`) - 2; // before trailing \r\n
        const fileData = buffer.slice(start, end);

        // Save the file

        const uploadDir = getFilePath();

        const filePath = path.join(uploadDir, fileName);

        // Simpan file

        writeFile(filePath, fileData, async (err) => {
          if (err) {
            console.error("❌ Failed to save file:", err);
            return res.end(
              JSON.stringify({ message: "File save failed", data: {} })
            );
          }

          if (!existsSync(filePath)) {
            console.error("❌ File not found:", filePath);
            res.writeHead(500);
            return res.end(
              JSON.stringify({ message: "File not found", data: {} })
            );
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

            await printWindow.loadURL(fileUrl);
            res.writeHead(200);
            res.end(
              JSON.stringify({
                message:
                  "Print on process, if not appear. Please re-check your printer",
              })
            );
          } catch (printError) {
            requestFrom = null;
            console.error("❌ Printing error:", printError);
            res.writeHead(500);
            res.end(
              JSON.stringify({
                message: "Print failed",
                error: printError.message,
              })
            );
          }
        });
      });
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
  } catch (error) {
    console.log(error);
    res.writeHead(500);
    res.end(
      JSON.stringify({
        message: "Print failed",
        error: printError.message,
      })
    );
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8, // 100 MB
});

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

      const printers = await mainWindow?.webContents?.getPrintersAsync();

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
      const printers = await mainWindow?.webContents?.getPrintersAsync();
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

        requestFrom = "socket";

        // Simpan file
        writeFile(filePath, buffer, async (err) => {
          if (err) {
            console.error("❌ Failed to save file:", err);
            if (requestFrom == "api") {
              res.writeHead(500);
              return res.end(
                JSON.stringify({ statusCode: 500, message: "File save failed" })
              );
            } else {
              return callback?.({
                statusCode: 500,
                message: "File save failed",
              });
            }
          }

          if (!existsSync(filePath)) {
            console.error("❌ File not found:", filePath);
            if (requestFrom == "api") {
              res.writeHead(500);
              return res.end(
                JSON.stringify({ statusCode: 500, message: "File not found" })
              );
            } else {
              return callback?.({ statusCode: 500, message: "File not found" });
            }
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
            await printWindow.loadURL(fileUrl);
          } catch (printError) {
            console.error("❌ Printing error:", printError);

            if (requestFrom == "api") {
              res.writeHead(500);
              return res.end(
                JSON.stringify({
                  statusCode: 500,
                  message: "Print failed",
                  error: printError.message,
                })
              );
            } else {
              return callback?.({
                statusCode: 500,
                message: "Internal Server Error",
                error: error.message,
              });
            }
          }
        });
      } catch (error) {
        console.error("❌ Error in printData:", error);

        requestFrom = null;
        if (requestFrom == "api") {
          res.writeHead(500);
          return res.end(
            JSON.stringify({
              statusCode: 500,
              message: "Internal Server Error",
              error: error.message,
            })
          );
        } else {
          return callback?.({
            statusCode: 500,
            message: "Internal Server Error",
            error: error.message,
          });
        }
      }
    }
  );
});

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

  tray = new Tray(path.join(__dirname, "./images/tray.png")); // Your tray icon
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show App", click: () => mainWindow.show() },
    {
      label: "Quit",
      click: () => {
        httpServer.close();
        tray.destroy();
        app.quit();
        mainWindow?.close();
        printWindow?.close();
        mainWindow = null;
        printWindow = null;
      },
    },
  ]);

  tray.setToolTip("fxPrint");
  tray.setContextMenu(contextMenu);

  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow?.hide();
  });
};

if (require("electron-squirrel-startup")) {
  tray.destroy();
  app.quit();
}
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
        await printWindow?.webContents?.getPrintersAsync();
      if (availablePrinters.length === 0) {
        console.error("❌ No printers available.");
        return;
      }

      const printer =
        availablePrinters.find((p) => p.name === printName) ||
        availablePrinters[0];

      if (!printer) {
        console.error("❌ Printer not found.");
        return;
      }

      // Print the PDF from the opened viewer
      await printEachCanvas(printWindow, printer.name);
    } catch (error) {
      console.error("❌ Error in print process:", error);
    }
  });

  ipcMain.handle("get-ip", () => getLocalIPAddress());

  ipcMain.handle("list-printer", async (event) => {
    if (mainWindow) {
      const printers = await mainWindow?.webContents?.getPrintersAsync();
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
app.on("before-quit", () => (willQuitApp = true));

// Function

async function printCanvasForLabelPrinter(printWindow, printerName) {
  const printContainer = printWindow?.webContents;

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
    const highResWidth = ((originalWidthMM * targetDPI) / INCH) * 10;
    const highResHeight = ((originalHeightMM * targetDPI) / INCH) * 10;

    // Render high-resolution canvas
    await printContainer.executeJavaScript(`
        new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx.textRendering = 'optimizeLegibility';

            // Set high resolution for printing
            canvas.width = ${highResWidth};
            canvas.height = ${highResHeight};
            canvas.style.width = "${originalWidthMM - 2}mm";
            canvas.style.height = "${originalHeightMM - 2}mm";
            canvas.style.display = "block";
            canvas.style.margin = "0";
            canvas.style.padding = "0";

            // Enable high-quality rendering
            // ctx.imageSmoothingEnabled = true;
            // ctx.imageSmoothingQuality = "high";

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
  requestFrom = null;
  await printContainer.print({
    silent: true,
    printBackground: false,
    deviceName: printerName,
    copies: copies,
    pageSize: {
      width: (originalWidthMM - 2) * MICRON_TO_MM,
      height: (originalHeightMM - 2) * MICRON_TO_MM,
    },
    margins: {
      marginType: "none", // Ensure no extra margins
    },
    dpi: targetDPI, // Use 300 DPI for sharper print quality
  });
  copies = 1;
}

async function printCanvasForPaperPrinter(printWindow, printerName) {
  const printContainer = printWindow?.webContents;

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

  let originalWidthMM = 0;
  let originalHeightMM = 0;
  for (const { data, width, height } of pageCanvases) {
    // Convert to mm
    originalWidthMM = (width * INCH) / originalDPI;
    originalHeightMM = (height * INCH) / originalDPI;

    // Adjust pixel size for high DPI printing
    const highResWidth = (originalWidthMM / INCH) * 10;
    const highResHeight = (originalHeightMM / INCH) * 10;

    // Render high-resolution canvas
    await printContainer.executeJavaScript(`
        new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            ctx.textRendering = 'optimizeLegibility';

            // Set high resolution for printing
            canvas.width = ${highResWidth};
            canvas.height = ${highResHeight};
            canvas.style.width = "${originalWidthMM - 2}mm";
            canvas.style.height = "${originalHeightMM - 2}mm";
            canvas.style.display = "block";
            canvas.style.margin = "0";
            canvas.style.padding = "0";

            // Enable high-quality rendering
            // ctx.imageSmoothingEnabled = true;
            // ctx.imageSmoothingQuality = "high";

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
  // Print the content with the calculated page size
  requestFrom = null;
  await printContainer.print({
    silent: true, // Allow print dialog for user preferences
    printBackground: false,
    deviceName: printerName,
    copies: copies,
    pageSize: {
      width: originalWidthMM * MICRON_TO_MM,
      height: originalHeightMM * MICRON_TO_MM,
    },
    margins: {
      marginType: "none", // Ensure no extra margins
    },
    dpi: originalDPI,
  });

  copies = 1;
}

async function printEachCanvas(printWindow, printerName) {
  const printContainer = printWindow?.webContents;
  const printers = await printContainer.getPrintersAsync();
  const selectedPrinter = printers.find((p) => p.name === printerName);

  if (!selectedPrinter) {
    console.error(`❌ Printer "${printerName}" not found.`);
    return;
  }

  const labelPrinterKeywords = ["Zebra", "Label", "TSC", "DYMO", "Brother QL"];
  const isLabelPrinter =
    labelPrinterKeywords.some((keyword) => {
      return printerName.toLowerCase().includes(keyword.toLowerCase());
    }) || selectedPrinter?.paperSize?.width < 1000;

  if (isLabelPrinter) {
    console.log("🖨️ Detected as Label Printer");
    await printCanvasForLabelPrinter(printWindow, printerName);
  } else {
    console.log("🖨️ Detected as Paper Printer");
    await printCanvasForPaperPrinter(printWindow, printerName);
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

function getFilePath() {
  const os = require("os");
  const path = require("path");
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

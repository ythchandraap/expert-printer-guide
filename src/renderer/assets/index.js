let socket = null;

function createSocketConnection(url) {
  if (socket) {
    socket.disconnect(); // Close the old socket
  }

  socket = io(url, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    maxHttpBufferSize: 1e8, // 100 MB
  });
  console.log(socket);

  socket.on("connect", () => {
    console.log("✅ Connected to server:", url);
  });

  socket.on("disconnect", (err) => {
    console.log(err);
    console.log("⚠️ Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Connection Error:", err.message);
  });

  return socket;
}

let url = "localhost";
function returnUrl(param) {
  console.log("http://" + param + ":18032");
  return "http://" + param + ":18032";
}

socket = createSocketConnection(returnUrl(url));

let printer = "";
document.querySelector("#buttonPing")?.addEventListener("click", async () => {
  const file = document?.getElementById("fileInput")?.files?.[0];
  if (!file) {
    return;
  }
  uploadFile({ file, printName: printer, socket_connection: socket });
});

document.querySelector("#connect-ip")?.addEventListener("click", async () => {
  const value = document?.getElementById("input-ip")?.value;

  socket = createSocketConnection(returnUrl(value));

  console.log("🔗 New Socket URL:", returnUrl(value));
});

function toggleSearch() {
  const wrapper = document?.querySelector(".wrapper-search");

  let timeout;
  if (wrapper?.classList.contains("in")) {
    wrapper.classList.add("out");

    timeout = setTimeout(() => {
      wrapper.classList.remove("in");
      wrapper.style.display = "none"; // Corrected from 'hidden' to 'none'
    }, 500);
  } else if (wrapper?.classList.contains("out")) {
    clearTimeout(timeout);

    wrapper.style.display = "flex";
    wrapper.classList.remove("out");
    wrapper.classList.add("in");
  } else {
    wrapper.style.display = "flex";
    wrapper.classList.add("in");
  }
}

// Select the element with the correct ID
document.querySelector("#close-ip")?.addEventListener("click", toggleSearch);
document.querySelector("#search-ip")?.addEventListener("click", toggleSearch);

const IP_DISPLAY = document?.querySelector("#ip-display");
const LIST_PRINTER = document?.querySelector("#list-printer");

function setActive() {
  printer = this.getAttribute("value");
}

let printerList = [];
let targetOS = "Unknown OS";

const initialData = (socket_connection) => {
  window.electronAPI.getIPAddress().then((ip) => {
    IP_DISPLAY.textContent = ip;
  });
  window.electronAPI.OS().then((item) => {
    targetOS = item;
  });
  socket.emit("getPrinter", { request: "printerList" }, (response) => {
    const printerList = response?.list ?? [];
    LIST_PRINTER.innerHTML = ""; // Clear existing list
    printerList.forEach((item) => {
      const status = getPrinterStatus(targetOS, item.status);
      // Create a list item for each printer
      const listItem = document.createElement("li");
      listItem.setAttribute("value", item?.name);
      listItem.classList.add("item-printer");
      listItem.addEventListener("click", setActive);
      listItem.style.display = "flex";
      listItem.style.alignItems = "center";
      listItem.style.justifyContent = "space-between";
      listItem.setAttribute("role", "button");
      // Create a text container
      const textContent = document.createElement("div");
      textContent.style.overflow = "hidden";
      textContent.style.textOverflow = "ellipsis";
      textContent.style.whiteSpace = "nowrap";
      textContent.textContent = item?.displayName;
      // Create a status indicator
      const indicator = document.createElement("div");
      indicator.style.width = "1rem";
      indicator.style.height = "1rem";
      indicator.style.borderRadius = "50%"; // Optional: make it circular
      indicator.style.backgroundColor =
        status === "Idle" || status === "Success" ? "#c3f0ca" : "#ff6e6c";
      // Append elements to the list item
      listItem.appendChild(textContent);
      listItem.appendChild(indicator);
      // Add the list item to the printer list in the DOM
      LIST_PRINTER.appendChild(listItem);
    });
  });
};

function uploadFile({ file, printName, socket_connection }) {
  const reader = new FileReader();

  // Read the file as ArrayBuffer
  reader.onload = () => {
    const fileName = file.name;
    const fileData = new Uint8Array(reader.result);

    console.log(printName);
    // Emit the file data to the server
    socket_connection.emit("printData", {
      fileName,
      fileData,
      printerName: printName,
    });
  };

  reader.onerror = (err) => {
    console.error("Error reading file:", err);
  };

  // // Start reading the file
  reader.readAsArrayBuffer(file);
}

addEventListener("DOMContentLoaded", () => {
  initialData(socket);
  setInterval(() => {
    initialData(socket);
  }, 2500);
});

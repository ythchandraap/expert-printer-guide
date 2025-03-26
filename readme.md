# Silent Printer with Electron & Socket.IO

A **silent printer service** built with **Electron and Socket.IO** to print documents seamlessly without user interaction. It enables network-based printing using WebSockets, making it ideal for POS systems, pharmacy labels, and automated printing tasks.

## 🚀 Features

- 📄 **Silent Printing**: No print dialog, prints directly to a selected printer.
- ⚡ **Real-time Communication**: Uses **Socket.IO** for instant data transfer.
- 🖨️ **Printer Management**: List available printers and check printer status.
- 📂 **Supports Multiple Formats**: Print **PDF, PNG, JPEG, and raw data**.
- 🌐 **Network Accessibility**: Remote devices can send print jobs over the network.
- 🛠️ **Electron-based Backend**: Runs as a background service.

---

## 📌 Installation

### 1️⃣ Clone the Repository

```sh
git clone https://github.com/yourusername/silent-printer-electron.git
cd silent-printer-electron
```

### 2️⃣ Install Dependencies

```sh
npm install
```

### 3️⃣ Start the Application

```sh
npm start
```

---

## 🔧 Configuration

### **Set Default Printer**

Modify the `config.json` file:

```json
{
  "defaultPrinter": "Your-Printer-Name"
}
```

### **Change Port (Optional)**

Edit the `server.js` file:

```js
const PORT = 18032; // Change to your preferred port
```

---

## 🛠 API Endpoints (Socket.IO Events)

### **Get Available Printers**

```js
socket.emit("getPrinter", {}, (response) => {
  console.log(response.list);
});
```

### **Check Printer Status**

```js
socket.emit("checkPrinter", { printer: "Printer_Name" }, (response) => {
  console.log(response);
});
```

### **Send Print Job**

```js
socket.emit("printData", {
  fileName: "test.pdf",
  fileData: Uint8Array, // File converted to Uint8Array
  printerName: "Your-Printer-Name",
});
```

---

## 🎯 Usage

- **For Local Use**: Run the service on your machine and connect via WebSocket.
- **For Network Printing**: Deploy on a server and use the exposed WebSocket API.
- **For POS Systems**: Use silent printing for receipts, invoices, or labels.

---

## 📌 Troubleshooting

- **Issue**: Printer not found?
  - **Solution**: Ensure the printer is connected and listed in `getPrinters`.
- **Issue**: Print job stuck?
  - **Solution**: Restart the Electron app and check logs.

---

## 📜 License

This project is licensed under the MIT License.

---

## 👨‍💻 Contributing

Feel free to open issues and submit pull requests.

🔗 **GitHub Repository**: [Silent Printer Electron](https://github.com/yourusername/silent-printer-electron)

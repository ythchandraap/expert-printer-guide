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

module.exports = { getFilePath };

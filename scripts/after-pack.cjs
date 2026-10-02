const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

// Make local macOS bundles runnable without selecting a certificate from Keychain.
module.exports = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = join(
    context.appOutDir,
    context.packager.appInfo.productFilename + ".app",
  );
  execFileSync(
    "/usr/bin/codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
    { stdio: "inherit" },
  );
};

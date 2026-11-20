Hooop for Windows
==================

Hooop.exe       The studio editor. Double-click to open it.
zigzag-cli.exe   Command-line tool.
zigzag-mcp.exe   MCP bridge for stdio-launching clients.
LICENSE          Apache-2.0.
NOTICE           Credits for code Hooop ports.
THIRD-PARTY-NOTICES.md
                 Notices for the open source libraries Hooop is built from.

First run
---------
Windows SmartScreen warns on apps without a Microsoft-trusted signature the
first time they run. Click "More info" and then "Run anyway" to let Hooop
through.

Bluetooth to the Brother Skitch (PP1) uses Windows Runtime Bluetooth LE and
needs Windows 10 version 1709 or later.

Put it on the PATH
------------------
Copy or move this folder somewhere permanent (for example C:\Program Files\
Hooop) and add that folder to your PATH if you want the zigzag-cli command in
any terminal.

MCP for Claude Desktop
----------------------
Point claude_desktop_config.json at the full path to zigzag-mcp.exe:

  {
    "mcpServers": {
      "zigzag": { "command": "C:\\Program Files\\Hooop\\zigzag-mcp.exe" }
    }
  }

Verifying the download
----------------------
SHA256SUMS-windows.txt on the release page lists the checksum of this zip.
Run:  certutil -hashfile Hooop-<version>-x86_64-windows.zip SHA256

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

// This method is called when your extension is activated
function activate(context) {
  console.log('Congratulations, your extension "removelogs" is now active!');

  // Register the command to remove console logs
  const disposable = vscode.commands.registerCommand(
    "removelogs.removeConsoleLogsFromAllFiles",
    async function () {
      // Get all files in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showInformationMessage("No workspace folder found.");
        return;
      }

      const folderPath = workspaceFolders[0].uri.fsPath;
      const files = await getAllFilesInDirectory(folderPath);

      // Process each file
      let filesProcessed = 0;
      for (const filePath of files) {
        const document = await vscode.workspace.openTextDocument(filePath);
        const documentText = document.getText();

        // Process the content to remove console.log or replace with console.error in catch blocks
        const cleanedText = processConsoleLogsInCatchBlocks(documentText);

        // If the text has changed, update the file
        if (cleanedText !== documentText) {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );
          edit.replace(document.uri, fullRange, cleanedText);
          await vscode.workspace.applyEdit(edit);

          // Save the file automatically after editing
          await document.save();
          filesProcessed++;
        }
      }

      vscode.window.showInformationMessage(
        `Removed console.log from ${filesProcessed} files.`
      );
    }
  );

  context.subscriptions.push(disposable);
}

// Function to process console logs and catch blocks
function processConsoleLogsInCatchBlocks(code) {
  // Replace console.log inside catch blocks with console.error
  const catchBlockWithConsoleLogRegex =
    /(catch\s*\([^\)]*\)\s*{[^}]*?)\bconsole\.log\(([^)]*)\);?/g;

  // Replace console.log with console.error inside catch blocks
  let updatedCode = code.replace(
    catchBlockWithConsoleLogRegex,
    (match, catchBlock, logContent) => {
      return `${catchBlock}\n console.error(${logContent});`;
    }
  );

  // Remove console.log statements outside of catch blocks, but not if they are inside comments
  const consoleLogRegex = /(?<!\/\/.*)\bconsole\.log\([^)]*\);?/g;

  updatedCode = updatedCode.replace(consoleLogRegex, (match) => {
    return ""; // Remove non-commented console.log statements
  });

  return updatedCode;
}

// Function to get all files in a directory and its subdirectories, excluding node_modules
async function getAllFilesInDirectory(dir) {
  let files = [];
  const items = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));

  for (const [name, type] of items) {
    const fullPath = path.join(dir, name);

    // Skip node_modules directory and its contents
    if (fullPath.includes("node_modules")) {
      continue;
    }

    if (type === vscode.FileType.Directory) {
      files = files.concat(await getAllFilesInDirectory(fullPath));
    } else if (type === vscode.FileType.File) {
      // Only add .js and .vue files to the list
      if (fullPath.endsWith(".js") || fullPath.endsWith(".vue")) {
        files.push(vscode.Uri.file(fullPath));
      }
    }
  }
  return files;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

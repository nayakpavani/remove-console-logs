const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

function activate(context) {
  console.log('Congratulations, your extension "removelogs" is now active!');

  const disposable = vscode.commands.registerCommand(
    "removelogs.removeConsoleLogsFromAllFiles",
    async function () {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showInformationMessage("No workspace folder found.");
        return;
      }

      const folderPath = workspaceFolders[0].uri.fsPath;
      const allFiles = await getAllFilesInDirectory(folderPath);

      if (allFiles.length === 0) {
        vscode.window.showInformationMessage(
          "No .js, .vue, or .jsx files found."
        );
        return;
      }

      // Create a mapping of "filename relative/path" to full path
      const fileMap = allFiles.reduce((acc, fileUri) => {
        const fullPath = fileUri.fsPath;
        const relativePath = vscode.workspace.asRelativePath(fullPath);
        const fileName = path.basename(fullPath);
        const formattedPath = `${fileName} ${path.dirname(relativePath)}`; // Example: Home.vue src/views/components
        acc[formattedPath] = fullPath;
        return acc;
      }, {});

      const fileLabels = Object.keys(fileMap);

      // Show confirmation dialog
      const userChoice = await vscode.window.showQuickPick(
        [
          "Remove Logs from All Files",
          "Specify Files  to Include",
          "Specify Files to Exclude",
          "Cancel",
        ],
        {
          placeHolder: "Choose how you want to remove logs.",
        }
      );

      if (!userChoice || userChoice === "Cancel") {
        vscode.window.showInformationMessage("Operation canceled.");
        return;
      }

      let filesToProcess = Object.values(fileMap); // All files by default

      if (userChoice === "Specify Files  to Include") {
        // Let the user pick files to process
        const selectedFiles = await vscode.window.showQuickPick(fileLabels, {
          placeHolder:
            "Select files to process (Use Shift/Ctrl for multiple selection)",
          canPickMany: true,
        });

        if (!selectedFiles || selectedFiles.length === 0) {
          vscode.window.showInformationMessage(
            "No files selected. Operation canceled."
          );
          return;
        }

        filesToProcess = selectedFiles.map((label) => fileMap[label]);
      } else if (userChoice === "Specify Files to Exclude") {
        // Let the user pick files to exclude
        const excludedFiles = await vscode.window.showQuickPick(fileLabels, {
          placeHolder:
            "Select files to exclude (Use Shift/Ctrl for multiple selection)",
          canPickMany: true,
        });

        if (excludedFiles && excludedFiles.length > 0) {
          const excludedPaths = excludedFiles.map((label) => fileMap[label]);
          filesToProcess = filesToProcess.filter(
            (file) => !excludedPaths.includes(file)
          );
        }
      }

      let logsRemovedCount = 0;
      let errorsReplacedCount = 0;
      let filesProcessed = 0;

      for (const filePath of filesToProcess) {
        const document = await vscode.workspace.openTextDocument(filePath);
        const documentText = document.getText();

        const { cleanedText, logsRemoved, errorsReplaced } =
          processConsoleLogsInCatchBlocks(documentText);

        if (cleanedText !== documentText) {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );
          edit.replace(document.uri, fullRange, cleanedText);
          await vscode.workspace.applyEdit(edit);
          await document.save();

          logsRemovedCount += logsRemoved;
          errorsReplacedCount += errorsReplaced;
          filesProcessed++;
        }
      }

      vscode.window.showInformationMessage(
        `Logs removed: ${logsRemovedCount}, Errors replaced: ${errorsReplacedCount} in ${filesProcessed} files.`
      );
    }
  );

  context.subscriptions.push(disposable);
}

function processConsoleLogsInCatchBlocks(code) {
  let logsRemoved = 0;
  let errorsReplaced = 0;

  // Replace console.log(error) with console.error(error)
  const consoleLogErrorRegex = /\bconsole\.log\s*\(\s*(error|err|e)\s*\);?/g;
  let updatedCode = code.replace(consoleLogErrorRegex, (match, errorVar) => {
    errorsReplaced++;
    return `console.error(${errorVar});`;
  });

  // Remove all other console.log statements (excluding comments)
  const generalConsoleLogRegex = /(?<!\/\/.*)\bconsole\.log\s*\([^)]*\);?/g;
  updatedCode = updatedCode.replace(generalConsoleLogRegex, () => {
    logsRemoved++;
    return "";
  });

  return { cleanedText: updatedCode, logsRemoved, errorsReplaced };
}

async function getAllFilesInDirectory(dir) {
  let files = [];
  const items = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));

  for (const [name, type] of items) {
    const fullPath = path.join(dir, name);

    if (fullPath.includes("node_modules")) continue;

    if (type === vscode.FileType.Directory) {
      files = files.concat(await getAllFilesInDirectory(fullPath));
    } else if (type === vscode.FileType.File) {
      if (
        fullPath.endsWith(".js") ||
        fullPath.endsWith(".vue") ||
        fullPath.endsWith(".jsx")
      ) {
        files.push(vscode.Uri.file(fullPath));
      }
    }
  }
  return files;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cliRoot = path.join(root, "node_modules", "@capacitor", "cli");
const sourceIcon = path.join(root, "www", "assets", "agres-gray-green-plants-icon.png");
const sourceForeground = path.join(root, "www", "assets", "agres-gray-green-plants-icon-foreground.png");

if (!fs.existsSync(sourceIcon) || !fs.existsSync(sourceForeground)) {
  console.log("Icone da Agres nao encontrado para preparar o template do Capacitor.");
  process.exit(0);
}

if (!fs.existsSync(cliRoot)) {
  console.log("Template do Capacitor ainda nao encontrado. O icone sera aplicado apos o sync.");
  process.exit(0);
}

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;

let updated = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (entry.name === "ic_launcher.png" || entry.name === "ic_launcher_round.png") {
      fs.copyFileSync(sourceIcon, entryPath);
      updated += 1;
      continue;
    }

    if (entry.name === "ic_launcher_foreground.png") {
      fs.copyFileSync(sourceForeground, entryPath);
      updated += 1;
      continue;
    }

    if (entry.name === "ic_launcher.xml" || entry.name === "ic_launcher_round.xml") {
      fs.writeFileSync(entryPath, adaptiveIconXml);
      updated += 1;
    }
  }
}

walk(cliRoot);

console.log(updated > 0
  ? `Template Android do Capacitor preparado com icone da Agres (${updated} arquivos).`
  : "Nenhum arquivo de icone encontrado no template do Capacitor. O icone sera aplicado apos o sync."
);

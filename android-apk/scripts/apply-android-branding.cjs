const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const androidRoot = path.join(root, "android");
const sourceIcon = path.join(root, "www", "assets", "agres-gray-green-plants-icon.png");
const sourceForeground = path.join(root, "www", "assets", "agres-gray-green-plants-icon-foreground.png");
const resRoot = path.join(androidRoot, "app", "src", "main", "res");
const drawableRoot = path.join(resRoot, "drawable");
const adaptiveIconRoot = path.join(resRoot, "mipmap-anydpi-v26");
const valuesRoot = path.join(resRoot, "values");
const stringsPath = path.join(valuesRoot, "strings.xml");
const colorsPath = path.join(valuesRoot, "colors.xml");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");

const mipmapDirs = [
  "mipmap-mdpi",
  "mipmap-hdpi",
  "mipmap-xhdpi",
  "mipmap-xxhdpi",
  "mipmap-xxxhdpi"
];

if (!fs.existsSync(sourceIcon)) {
  throw new Error(`Icone nao encontrado: ${sourceIcon}`);
}

if (!fs.existsSync(sourceForeground)) {
  throw new Error(`Icone foreground nao encontrado: ${sourceForeground}`);
}

for (const dir of fs.readdirSync(resRoot, { withFileTypes: true })) {
  if (!dir.isDirectory() || !dir.name.startsWith("drawable")) continue;

  const dirPath = path.join(resRoot, dir.name);
  for (const file of fs.readdirSync(dirPath)) {
    if (/^ic_launcher_foreground\./.test(file)) {
      fs.unlinkSync(path.join(dirPath, file));
    }
  }
}

fs.mkdirSync(drawableRoot, { recursive: true });
fs.copyFileSync(sourceForeground, path.join(drawableRoot, "ic_launcher_foreground.png"));
fs.copyFileSync(sourceForeground, path.join(drawableRoot, "agres_launcher_foreground.png"));

for (const dir of mipmapDirs) {
  const targetDir = path.join(resRoot, dir);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of [
    "ic_launcher.png",
    "ic_launcher_round.png"
  ]) {
    fs.copyFileSync(sourceIcon, path.join(targetDir, file));
  }

  fs.copyFileSync(sourceForeground, path.join(targetDir, "ic_launcher_foreground.png"));
  fs.copyFileSync(sourceIcon, path.join(targetDir, "agres_launcher.png"));
  fs.copyFileSync(sourceIcon, path.join(targetDir, "agres_launcher_round.png"));
  fs.copyFileSync(sourceForeground, path.join(targetDir, "agres_launcher_foreground.png"));
}

fs.mkdirSync(valuesRoot, { recursive: true });
fs.mkdirSync(adaptiveIconRoot, { recursive: true });

if (fs.existsSync(stringsPath)) {
  const strings = fs.readFileSync(stringsPath, "utf8")
    .replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">Ajuste Entre-Passadas</string>')
    .replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">Ajuste Entre-Passadas</string>');
  fs.writeFileSync(stringsPath, strings);
}

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  if (!/<application\b/.test(manifest)) {
    throw new Error("AndroidManifest.xml sem tag <application>.");
  }

  manifest = manifest.replace(
    /<application\b([^>]*)>/,
    (match, attrs) => {
      let nextAttrs = attrs
        .replace(/\sandroid:icon="[^"]*"/, "")
        .replace(/\sandroid:roundIcon="[^"]*"/, "");
      return `<application${nextAttrs} android:icon="@mipmap/agres_launcher" android:roundIcon="@mipmap/agres_launcher_round">`;
    }
  );

  if (!manifest.includes('android:icon="@mipmap/agres_launcher"')) {
    throw new Error("Falha ao aplicar android:icon da Agres.");
  }

  fs.writeFileSync(manifestPath, manifest);
} else {
  throw new Error(`AndroidManifest.xml nao encontrado: ${manifestPath}`);
}

const backgroundColor = "#F4F5F6";
if (fs.existsSync(colorsPath)) {
  const colors = fs.readFileSync(colorsPath, "utf8");
  const next = colors.includes('name="ic_launcher_background"')
    ? colors.replace(/<color name="ic_launcher_background">.*?<\/color>/, `<color name="ic_launcher_background">${backgroundColor}</color>`)
    : colors.replace("</resources>", `    <color name="ic_launcher_background">${backgroundColor}</color>\n</resources>`);
  fs.writeFileSync(colorsPath, next);
} else {
  fs.writeFileSync(colorsPath, `<resources>\n    <color name="ic_launcher_background">${backgroundColor}</color>\n</resources>\n`);
}

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;

fs.writeFileSync(path.join(adaptiveIconRoot, "ic_launcher.xml"), adaptiveIconXml);
fs.writeFileSync(path.join(adaptiveIconRoot, "ic_launcher_round.xml"), adaptiveIconXml);

const agresAdaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/agres_launcher_foreground"/>
</adaptive-icon>
`;

fs.writeFileSync(path.join(adaptiveIconRoot, "agres_launcher.xml"), agresAdaptiveIconXml);
fs.writeFileSync(path.join(adaptiveIconRoot, "agres_launcher_round.xml"), agresAdaptiveIconXml);

console.log("Icone e nome do app Android aplicados em @mipmap/agres_launcher.");

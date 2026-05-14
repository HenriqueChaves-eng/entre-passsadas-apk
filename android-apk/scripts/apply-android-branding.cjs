const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const androidRoot = path.join(root, "android");
const sourceIcon = path.join(root, "www", "assets", "logo_agres.png");
const resRoot = path.join(androidRoot, "app", "src", "main", "res");
const valuesRoot = path.join(resRoot, "values");
const stringsPath = path.join(valuesRoot, "strings.xml");
const colorsPath = path.join(valuesRoot, "colors.xml");

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

for (const dir of mipmapDirs) {
  const targetDir = path.join(resRoot, dir);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of [
    "ic_launcher.png",
    "ic_launcher_round.png",
    "ic_launcher_foreground.png"
  ]) {
    fs.copyFileSync(sourceIcon, path.join(targetDir, file));
  }
}

fs.mkdirSync(valuesRoot, { recursive: true });

if (fs.existsSync(stringsPath)) {
  const strings = fs.readFileSync(stringsPath, "utf8")
    .replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">Ajuste Entre-Passadas</string>')
    .replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">Ajuste Entre-Passadas</string>');
  fs.writeFileSync(stringsPath, strings);
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

console.log("Icone e nome do app Android aplicados.");

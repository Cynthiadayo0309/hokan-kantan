import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const version = packageJson.version;
const releaseDir = join(rootDir, "release");

if (!existsSync(releaseDir)) {
  mkdirSync(releaseDir, { recursive: true });
}

const installers = existsSync(releaseDir)
  ? readdirSync(releaseDir)
      .filter((name) => name.toLowerCase().endsWith(".exe"))
      .filter((name) => name.includes(version))
      .sort()
  : [];

if (installers.length === 0) {
  console.error(`release/ に version ${version} の .exe インストーラーが見つかりません。先に npm.cmd run dist を実行してください。`);
  process.exitCode = 1;
} else {
  const hashLines = installers.map((name) => {
    const fileBuffer = readFileSync(join(releaseDir, name));
    const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
    return `${sha256}  ${name}`;
  });

  writeFileSync(join(releaseDir, `sha256sums-${version}.txt`), `${hashLines.join("\n")}\n`, "utf8");

  const checklist = `# 訪看かんたん計算 配布確認メモ v${version}

## 配布ファイル

${hashLines.map((line) => {
  const [sha256, fileName] = line.split("  ");
  return `- ファイル名: \`${fileName}\`\n- SHA256: \`${sha256}\``;
}).join("\n\n")}

## 公開前チェック

- [ ] ファイル名、バージョン、SHA256 が配布案内と一致している
- [ ] Microsoft Defender でスキャンし、問題がないことを確認した
- [ ] 必要に応じて VirusTotal 等で確認した
- [ ] 配布案内に「発行元」「バージョン」「SHA256確認方法」を記載した
- [ ] 警告を無効化する案内ではなく、配布元とファイル名を確認してから実行する案内にした
- [ ] 署名済みの場合は、ファイルのプロパティでデジタル署名を確認した

## 利用者向け案内文

訪看かんたん計算のインストーラーをダウンロードしたら、ファイル名とバージョンが案内と同じであることを確認してから実行してください。

配布直後や未署名のインストーラーでは、Chrome や Windows により「一般的にダウンロードされていません」「開く前に信頼できることを確認してください」と表示される場合があります。
これは、ファイルのダウンロード実績や発行元の信頼情報がまだ少ない場合に表示される警告です。

案内された配布元以外から入手したファイルは実行しないでください。
`;

  writeFileSync(join(releaseDir, `distribution-checklist-${version}.md`), checklist, "utf8");
  console.log(`release/sha256sums-${version}.txt を作成しました。`);
  console.log(`release/distribution-checklist-${version}.md を作成しました。`);
}

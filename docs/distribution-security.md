# インストーラー配布と警告対策

この文書は、`訪看かんたん計算_Setup_<version>.exe` を利用者へ配布するときの確認手順です。

## なぜ警告が出るか

Chrome や Windows は、次のようなインストーラーに警告を表示することがあります。

- ダウンロード実績が少ない
- 未署名、または署名証明書の評判がまだ少ない
- `.exe` 形式で配布されている
- Google Drive など、アプリ専用ではない共有リンクから配布されている

この警告は、必ずしもウイルス検出を意味しません。ただし、利用者に警告を無視させる案内は避け、配布元・ファイル名・バージョン・SHA256を確認してもらう案内にします。

参考:

- Google Chrome: https://support.google.com/chrome/answer/6261569
- Microsoft Defender SmartScreen: https://learn.microsoft.com/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/
- electron-builder Windows code signing: https://www.electron.build/code-signing-win.html

## 配布ファイル作成

```bash
npm.cmd run dist
```

`release/` に次のファイルが作成されます。

- `訪看かんたん計算_Setup_<version>.exe`
- `sha256sums-<version>.txt`
- `distribution-checklist-<version>.md`

`sha256sums-<version>.txt` には、配布するインストーラーのSHA256が出力されます。Google Driveや配布ページには、インストーラー本体だけでなく、ファイル名・バージョン・SHA256を必ず記載します。

## 公開前チェック

1. `release/distribution-checklist-<version>.md` を開く。
2. ファイル名、バージョン、SHA256が配布案内と一致していることを確認する。
3. Microsoft Defenderでインストーラーをスキャンする。
4. 必要に応じて VirusTotal 等でも確認する。
5. 署名済みの場合は、インストーラーのプロパティでデジタル署名を確認する。
6. 配布案内に、案内された配布元以外から入手したファイルは実行しないよう記載する。

## 利用者向け案内の書き方

利用者には、次の内容を簡潔に案内します。

```text
訪看かんたん計算のインストーラーをダウンロードしたら、ファイル名とバージョンが案内と同じであることを確認してから実行してください。

配布直後や未署名のインストーラーでは、Chrome や Windows により「一般的にダウンロードされていません」「開く前に信頼できることを確認してください」と表示される場合があります。
これは、ファイルのダウンロード実績や発行元の信頼情報がまだ少ない場合に表示される警告です。

案内された配布元以外から入手したファイルは実行しないでください。
```

警告を無効化する方法や、セキュリティ機能を切る方法は案内しません。

## コード署名

警告を減らす根本対策は、Windowsコード署名です。`package.json` の electron-builder 設定では、署名を行えるよう `signAndEditExecutable` を有効にしています。

証明書を導入したら、electron-builderのWindowsコード署名手順に従い、次のような環境変数を設定してビルドします。

```powershell
$env:CSC_LINK="C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD="証明書のパスワード"
npm.cmd run dist
```

証明書や秘密鍵はリポジトリへコミットしません。

OV証明書では、署名後もしばらくSmartScreen警告が残る場合があります。同じ発行者証明書で継続的に配布し、評判を蓄積します。より早く警告を減らしたい場合は、EV証明書または Azure Trusted Signing を検討します。

## 誤検知やブロックが続く場合

Microsoft Defender や SmartScreen で誤検知が疑われる場合は、Microsoft の提出ページからファイルを提出してレビューを依頼します。

https://www.microsoft.com/wdsi/filesubmission

利用者が施設・法人内PCを使っている場合は、情シス担当者に相談し、Microsoft Intune や Defender 管理ポリシーによる許可配布を検討します。

# Raycast Extensions

自作Raycast拡張のソースをまとめています。各ディレクトリが独立した拡張です。

| ディレクトリ     | コマンド             | 用途                                         |
| ---------------- | -------------------- | -------------------------------------------- |
| `raytodo`        | raytodo / rayteam    | 日々のTODO・期間別の計画を専用ファイルで管理 |
| `gh-assigned`    | Search Pull Requests | 自分のPR・レビュー依頼・担当PRを検索         |
| `ray-dsl-viewer` | DSL Viewer           | Markdown・Mermaidをプレビュー                |

## 公開範囲と業務用ツール

公開対象は `.gitignore` の「Public extensions」にある3本だけです。新しいディレクトリやルートファイルは、許可リストへ追加しない限りGitに入りません。

業務用ツールは `local/<tool-name>/` に置きます。公開用pnpm workspaceには追加せず、依存関係もそのツールの中で管理してください。

```sh
cd local/<tool-name>
pnpm --ignore-workspace install
pnpm dev
```

`local/` はGit・共通テスト・共通lint/formatの対象外です。ツール自身の `pnpm-lock.yaml` も公開されません。ルートの `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、READMEには業務用の依存情報や社内情報を書かないでください。

公開ツールを追加する場合は、内容を確認してから `.gitignore` の許可リストへ追加します。`package.json` と `pnpm-workspace.yaml` のworkspace一覧にも追加してください。

### 誤公開チェック

```sh
pnpm check:public
```

Gitで追跡中のファイルも確認するため、`git add -f` で追加された対象外ファイルも検出します。ローカルのGit hooksを有効にすると、commit前とpush前にも自動で止めます。push前は先端コミットだけでなく、送信するコミット履歴も調べます。

新しいcloneでは一度だけ設定してください。既存の独自hooksがある場合は、上書きせず統合してください。

```sh
git config --local core.hooksPath .githooks
```

これは誤操作を防ぐための仕組みです。`--no-verify` や許可リストの変更で回避できるため、強制的なアクセス制御ではありません。公開済みのファイルは `.gitignore` だけでは追跡やGitHub履歴から消えません。現在の3本はすでに公開済みです。

## ローカルに登録

macOS、Raycast、Node.js 22.22.2以上が必要です。npm、またはpnpm 11.18.0を使えます。
使いたい拡張だけを指定してインストール・登録します。`raytodo` にはrayteamも含まれます。

```sh
ghq get https://github.com/sorafujitani/raycast-extention.git
cd "$(ghq root)/github.com/sorafujitani/raycast-extention"
```

npmの場合:

```sh
npm install --workspace=raytodo --include-workspace-root
npm run dev --workspace=raytodo
```

pnpmの場合:

```sh
pnpm --filter raytodo install --frozen-lockfile
pnpm --filter raytodo dev
```

`raytodo` は `gh-assigned` または `ray-dsl-viewer` に置き換えられます。installは選んだ拡張と共通開発ツールの依存を入れます。他の拡張は入りません。devは選んだ拡張だけをRaycastへ登録します。ビルド完了後はCtrl+Cで停止しても利用できます。

保存ファイルを作るのは、`raytodo` を選んだ場合だけです。他の拡張を選んでも次のファイルは作りません。再実行しても既存データは上書きしません。

- `~/.raytodo/todo.md`：日々のタスク
- `~/.rayteam/plans.json`：期間別の計画

`--ignore-scripts` を指定した場合は、初回起動時に作成します。手動作成は `npm run postinstall --workspace=raytodo` または `pnpm --filter raytodo run postinstall` で実行できます。

一覧画面のCtrl+Shift+Tで互いに切り替えられます。操作の詳細は [利用ガイド](raytodo/README.md) を参照してください。

## 開発用の全体チェック

全拡張を開発・検証するときだけ、ルートで `npm install` または `pnpm install --frozen-lockfile` を実行します。対象指定のないinstallは全拡張の依存を入れます。

テストと共通の静的チェックにはVite+を使います。開発依存として入るため、グローバルの `vp` は不要です。次のコマンドはルートで実行します。

```sh
pnpm check         # 公開範囲チェック＋vp check＋各拡張のtsc
pnpm test          # vp test（Vitest）で全テスト
pnpm fmt           # vp fmtで整形
pnpm lint:raycast  # Raycastのmanifest・icon・専用lint検証
pnpm build         # Raycast CLIで3拡張をdist/へビルド
```

npmでは `npm run check`、`npm test`、`npm run build` などを使えます。個別実行は `npm run test --workspace=raytodo` または `pnpm --filter raytodo test` です。グローバルの `vp` がある場合は `vp test` / `vp check` も使えます。`vp build` はViteのビルドなので使わず、Raycast用の `pnpm build` または `vp run build` を使ってください。

同じ作業ディレクトリではnpmかpnpmのどちらかに統一してください。Gitで管理するロックファイルはルートの `pnpm-lock.yaml` です。npmが作る `package-lock.json` はローカル専用で、Git対象外です。

npmは `.npmrc` の設定により、各拡張内にも依存パッケージを配置します。Raycast CLIが各拡張のTypeScriptコンパイラを探すため、この設定が必要です。拡張本体はRaycastが管理するNode.jsで動きます。

GH Assignedは認証済みのGitHub CLIと `gh-assigned` が必要です。Ray DSL ViewerのMermaid描画は図の内容を外部サービスへ送信します。機密情報を含む図には使用しないでください。

TODOの実データ・認証情報・依存パッケージ・ビルド成果物はこのリポジトリに含めません。今後の拡張編集はこのリポジトリ内で行います。

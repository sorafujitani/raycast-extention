# Raycast Extensions

自作Raycast拡張のソースをまとめています。各ディレクトリが独立した拡張です。

| ディレクトリ     | コマンド             | 用途                                         |
| ---------------- | -------------------- | -------------------------------------------- |
| `memoli-todo`    | raytodo / rayteam    | 日々のTODO・期間別の計画を専用ファイルで管理 |
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

公開ツールを追加する場合は、内容を確認してから `.gitignore` の許可リストと `pnpm-workspace.yaml` の両方に追加します。

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

macOS、Raycast、Node.js 22.22.2以上、pnpm 11.18.0が必要です。
依存管理はpnpm workspaces、テストと共通の静的チェックはVite+を使います。Vite+は開発依存として入るため、グローバルの `vp` は不要です。

```sh
ghq get https://github.com/sorafujitani/raycast-extention.git
cd "$(ghq root)/github.com/sorafujitani/raycast-extention"
pnpm install --frozen-lockfile
pnpm --filter memoli-todo dev
```

`memoli-todo` を使いたい拡張名に置き換えてください。ビルド完了後はCtrl+Cで停止しても利用できます。

raytodo / rayteamの保存先は `~/.raytodo/todo.md` と `~/.rayteam/plans.json` です。インストール時または初回起動時に自動作成します。Memoliは不要です。一覧画面のCtrl+Shift+Tで互いに切り替えられます。旧データの引き継ぎは [利用ガイド](memoli-todo/README.md) を参照してください。

## 共通コマンド

リポジトリのルートで実行します。

```sh
pnpm check         # 公開範囲チェック＋vp check＋各拡張のtsc
pnpm test          # vp test（Vitest）で全テスト
pnpm fmt           # vp fmtで整形
pnpm lint:raycast  # Raycastのmanifest・icon・専用lint検証
pnpm build         # Raycast CLIで3拡張をdist/へビルド
```

個別実行は `pnpm --filter memoli-todo test` などを使います。グローバルの `vp` がある場合は `vp test` / `vp check` も使えます。`vp build` はViteのビルドなので使わず、Raycast用の `pnpm build` または `vp run build` を使ってください。

公開ツールのロックファイルはルートの `pnpm-lock.yaml` に統一しています。`npm install` や拡張ごとのロックファイルは使いません。拡張本体は引き続きRaycastが管理するNode.jsで動きます。

GH Assignedは認証済みのGitHub CLIと `gh-assigned` が必要です。Ray DSL ViewerのMermaid描画は図の内容を外部サービスへ送信します。機密情報を含む図には使用しないでください。

TODOの実データ・認証情報・依存パッケージ・ビルド成果物はこのリポジトリに含めません。今後の拡張編集はこのリポジトリ内で行います。

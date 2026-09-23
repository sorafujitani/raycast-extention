# Raycast Extensions

使いたい拡張だけをインストールできる、自作Raycast拡張集です。

## ローカルに登録

macOS、Raycast、Node.js 22.22.2以上が必要です。ソースを取得し、リポジトリのルートで実行します。

```sh
git clone https://github.com/sorafujitani/raycast-extention.git
cd raycast-extention
```

| 拡張                                       | 用途                                               |
| ------------------------------------------ | -------------------------------------------------- |
| [raytodo](raytodo/README.md)               | 日々のTODO・期間別の計画（rayteam同梱）            |
| [gh-assigned](gh-assigned/README.md)       | 自分のPR・レビュー依頼・担当PRを検索               |
| [ray-dsl-viewer](ray-dsl-viewer/README.md) | Markdown・Mermaidをプレビュー（Mermaidは外部送信） |

以下の `raytodo` を使いたい拡張名に置き換えます。

### npm

```sh
npm install --workspace=raytodo --include-workspace-root
npm run dev --workspace=raytodo
```

### pnpm 11.18.0

```sh
pnpm --filter raytodo install --frozen-lockfile
pnpm --filter raytodo dev
```

選んだ拡張と共通開発ツールだけが入ります。devでRaycastへ登録した後は、Ctrl+Cで停止しても使えます。使い方・保存先は各拡張のREADMEを参照してください。

同じ作業ディレクトリではnpmかpnpmのどちらかに統一してください。Gitで管理するロックファイルは `pnpm-lock.yaml` です。npmの `package-lock.json` はGit対象外です。

## 開発用の全体チェック

全拡張を開発・検証するときだけ、対象指定なしでインストールします。

```sh
pnpm install --frozen-lockfile
pnpm check         # 公開範囲・format・lint・型チェック
pnpm test          # 全テスト
pnpm fmt           # 整形
pnpm lint:raycast   # Raycast専用チェック
pnpm build         # 全拡張をdist/へビルド
```

npmなら `npm install` の後、`npm run check` / `npm test` / `npm run build` などを使えます。個別テストは `npm run test --workspace=raytodo` または `pnpm --filter raytodo test` です。

共通ツールのVite+は依存に含まれるため、グローバルの `vp` は不要です。`vp build` はVite用なので使わず、上記のbuildを実行してください。`.npmrc` はRaycast CLIが必要とするコンパイラを各拡張内へ配置するための設定です。

## 公開範囲と業務用ツール

公開対象は `.gitignore` の許可リストにあるファイルだけです。拡張を追加するときは、内容を確認し、許可リストと `package.json`・`pnpm-workspace.yaml` のworkspace一覧を更新してください。

業務用ツールは `local/<tool-name>/` に置き、公開workspaceへ追加しません。依存もその中で管理します。

```sh
cd local/<tool-name>
pnpm --ignore-workspace install
pnpm dev
```

`local/` はGitと共通チェックの対象外です。業務用の依存情報・社内情報をルートの設定やREADMEへ書かないでください。個人データ・認証情報・依存パッケージ・ビルド成果物も公開対象外です。

`pnpm check:public` は追跡中の対象外ファイルも検出します。commit・push前にも確認するには、既存hooksがないことを確かめて次を設定します。既存hooksがある場合は統合してください。

```sh
git config --local core.hooksPath .githooks
```

push時は送信するコミット履歴も検査します。ただし、hooksの無効化や許可リストの変更で回避できるため、強制的なアクセス制御ではありません。既に公開したファイルは `.gitignore` を変えてもGitHubの履歴から消えません。

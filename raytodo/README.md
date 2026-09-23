# raytodo & rayteam

Raycastで日々のタスクと期間別の計画を管理します。

## インストール・登録

macOS、Raycast、Node.js 22.22.2以上が必要です。[ソースを取得](../README.md#ローカルに登録)し、リポジトリのルートで実行します。

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

この拡張と共通開発ツールだけが入ります。他の自作拡張は入りません。ビルド完了後はCtrl+Cで停止しても使えます。

## 使い方

Raycastで次のコマンドを検索して起動します。

- **raytodo**：日々のタスクを状態・優先度で管理
- **rayteam**：Week / Month / Year / Futureで計画を管理

| 操作                           | キー         |
| ------------------------------ | ------------ |
| raytodoとrayteamを切り替え     | Ctrl+Shift+S |
| タスクを追加                   | ⌘N           |
| 編集                           | ⌘E           |
| 作成・編集を保存               | ⌘Enter       |
| 完了・未完了を切り替え（一覧） | Enter        |
| 状態・期間で絞り込み           | ⌘P           |
| 上・下へ移動                   | ⇧↑ / ⇧↓      |
| 削除（確認あり）               | Ctrl+X       |
| 再読み込み                     | ⌘R           |
| 保存ファイルを開く             | ⌘O           |

状態・優先度の変更、並べ替えの条件、保存形式は[利用ガイド](docs/usage.md)を参照してください。

## 保存先

- raytodo：`~/.raytodo/todo.md`
- rayteam：`~/.rayteam/plans.json`

インストール時に自動作成します。初回起動時にも不足するファイルを作成し、既存データは上書きしません。拡張を削除してもデータは残ります。

保存前の内容は `.raycast.bak` に1世代残します。読み込み失敗や外部変更を検出した場合は上書きしません。外部エディタとの同時保存は避けてください。

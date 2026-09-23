# Ray DSL Viewer

RaycastでMarkdown・Mermaidをプレビューします。

## インストール

macOS、Raycast、Node.js 22.22.2以上が必要です。[リポジトリのルート](../README.md#ローカルに登録)で実行します。

### npm

```sh
npm install --workspace=ray-dsl-viewer --include-workspace-root
npm run dev --workspace=ray-dsl-viewer
```

### pnpm 11.18.0

```sh
pnpm --filter ray-dsl-viewer install --frozen-lockfile
pnpm --filter ray-dsl-viewer dev
```

この拡張と共通開発ツールだけが入ります。他の拡張やraytodoの保存ファイルは追加しません。ビルド完了後はCtrl+Cで停止しても使えます。

## 使い方

Raycastで **DSL Viewer** を起動します。⌘⇧Vでクリップボードから読み込み、⌘Enterでプレビューします。

**Mermaidの内容は描画のため外部サービスへ送信します。機密情報を含む図には使用しないでください。**

開発時の検証は[共通チェック](../README.md#開発用の全体チェック)を参照してください。

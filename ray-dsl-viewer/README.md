# Ray DSL Viewer

Raycastの **DSL Viewer** でMarkdown・Mermaidを入力してプレビューします。⌘⇧Vでクリップボードから読み込み、⌘Enterでプレビューします。

**Mermaidの内容は描画のため外部サービスに送信されます。機密情報を含む図には使用しないでください。**

```sh
# リポジトリのルートで実行
pnpm install --frozen-lockfile
pnpm --filter ray-dsl-viewer dev
```

検証:

```sh
pnpm --filter ray-dsl-viewer typecheck
pnpm --filter ray-dsl-viewer lint:raycast
pnpm --filter ray-dsl-viewer build
```

このソースは、ローカルにインストールされていた拡張の埋め込みソースマップから復元したものです。元の開発用ディレクトリとロックファイルが見つからなかったため、設定とロックファイルを再作成しています。

# Ray DSL Viewer

Raycastの **DSL Viewer** でMarkdown・Mermaidを入力してプレビューします。⌘⇧Vでクリップボードから読み込み、⌘Enterでプレビューします。

**Mermaidの内容は描画のため外部サービスに送信されます。機密情報を含む図には使用しないでください。**

```sh
npm ci
npm run dev
```

検証:

```sh
npx tsc --noEmit
npm run build
```

このソースは、ローカルにインストールされていた拡張の埋め込みソースマップから復元したものです。元の開発用ディレクトリとロックファイルが見つからなかったため、設定とロックファイルを再作成しています。

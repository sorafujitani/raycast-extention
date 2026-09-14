# Raycast Extensions

自作Raycast拡張のソースをまとめています。各ディレクトリが独立した拡張です。

| ディレクトリ | コマンド | 用途 |
| --- | --- | --- |
| `memoli-todo` | Memoli Todo | `~/.memoli/memo/todo.md` のTODOとメモを管理 |
| `gh-assigned` | Search Pull Requests | 自分のPR・レビュー依頼・担当PRを検索 |
| `ray-dsl-viewer` | DSL Viewer | Markdown・Mermaidをプレビュー |

## ローカルに登録

macOS、Raycast、Node.js 22.22.2以上が必要です。

```sh
ghq get https://github.com/sorafujitani/raycast-extention.git
cd "$(ghq root)/github.com/sorafujitani/raycast-extention/memoli-todo"
npm ci
npm run dev
```

最後のディレクトリ名を使いたい拡張に置き換えてください。ビルド完了後はCtrl+Cで停止しても利用できます。詳しい操作と検証コマンドは各拡張のREADMEを参照してください。

GH Assignedは認証済みのGitHub CLIと `gh-assigned` が必要です。Ray DSL ViewerのMermaid描画は図の内容を外部サービスへ送信します。機密情報を含む図には使用しないでください。

TODOの実データ・認証情報・依存パッケージ・ビルド成果物はこのリポジトリに含めません。今後の拡張編集はこのリポジトリ内で行います。

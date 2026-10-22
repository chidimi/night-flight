# 夜間飛行

Three.jsによるブラウザ用の飛行試作。紙色と墨色の空、アナログ計器、合成したプロペラ音。音楽はありません。

https://night-flight.chidimi.workers.dev/

## 起動

Node.js 22.12以降を使用します。

```sh
npm install
npm run dev
```

表示されたローカルURLをブラウザで開き、「飛びはじめる」を押します。キーボードとスマートフォンのタッチ操作に対応しています。

- 左右キー：バンク
- 上キー：機首下げ、下キー：機首上げ
- W / S：出力増減
- Esc：一時停止と再開。タブを離れたときも一時停止します。

スマートフォンでは左下の操縦桿を左右へ動かしてバンク、上へ押して機首下げ、下へ引いて機首上げします。動かす幅で舵の量を調整でき、指を離すと入力が中立に戻ります。右下の＋／−を押している間は出力を増減でき、操縦桿と同時に使えます。右上のⅡで一時停止。画面回転時はタッチ入力を解除します。計器の読みやすい横向きを推奨します。

開始時は高度1200m、約101ノット、出力65%の巡航状態です。手を離しても瞬時には水平に戻りません。姿勢計を読み、反対方向に操縦して翼を戻します。出力を下げると降下し、海面への接触で終了します。出力ゼロでは無音で滑空します。

燃料は出力に関係なく飛行時間180秒で尽きます。一時停止中は消費しません。燃料計は残量を示し、燃料が尽きると推進力とプロペラ音を失って滑空します。出力操作で再始動はできず、再飛行時に満タンへ戻ります。機体は体験を確かめるための簡易モデルで、実機の飛行特性を再現するものではありません。海面・星・遠い灯りと位置に応じた雲の遮蔽を備え、山や着陸は未実装です。

```sh
npm test
npm run build
```

ビルド後の `dist/` は静的配信できます。外部API、アカウント、外部CDNは不要です。設計の背景と未決事項は [DESIGN.md](DESIGN.md) に記録しています。

## 開発時の確認

実装とテストはTypeScriptです。`strict` と配列・プロパティ参照のチェックを有効にし、ESLintは型情報を使って未処理のPromiseや危険な型の使用を検出します。PrettierでTypeScript、CSS、HTML、設定ファイルの書式を統一します。

```sh
npm run format       # ファイルを整形
npm run check        # 型チェック、lint、整形チェック、テスト
npm run build        # 型チェックして配布用ファイルを作成
```

個別の確認は `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test` で実行できます。

| ファイル                | 責務                                             |
| ----------------------- | ------------------------------------------------ |
| `src/main.ts`           | UI、キーボード入力、進行状態、固定時間刻みの更新 |
| `src/touch-controls.ts` | タッチ操縦桿、出力操作、指を離したときの入力解除 |
| `src/flight.ts`         | 飛行状態の型、操縦・燃料・移動の計算             |
| `src/cockpit.ts`        | 計器盤と針の描画                                 |
| `src/world.ts`          | Three.jsの空、星、海面、描画処理                 |
| `src/shaders.ts`        | 二色ディザのシェーダー                           |
| `src/audio.ts`          | 飛行状態に応じたプロペラ音                       |
| `tests/flight.test.ts`  | 巡航、操縦、燃料切れ、終了の回帰テスト           |

## E2Eテスト

PlaywrightのChromiumで、実際の開始ボタン・キー入力・一時停止・燃料切れ後の滑空・海面接触・再飛行を確認します。仮想時計を使い、実際の3分間の待機を省きます。計器の数値は画面読み上げ用のmeter要素から取得し、ゲーム内部の状態を書き換えません。スマホの縦横画面では、実際のタッチイベントで操縦と出力の同時操作、枠外へのドラッグ、指を離す・中断する・一時停止する・画面回転する際の入力解除も確認します。音の聴き心地や画面の見栄えはこのテストの対象外です。

```sh
npx playwright install chromium  # 初回のみ
npm run test:e2e                  # E2E
npm run test:e2e:ui               # 対話型のテスト画面
npm run check:all                # 通常チェックとE2E
```

E2E開始時に `npm run build` で `dist/` を生成し、`vite preview` で配布用ビルドをポート4173に配信します。ローカル・CIとも同じ構成を使い、終了後にサーバーを停止します。失敗時のスクリーンショットとトレースは `test-results/`、HTMLレポートは `playwright-report/` に保存されます。

## GitHub Actions

`main`へのpushと、`main`を対象とするPull RequestでCIを実行します。Actions画面から手動実行もできます。

- Node.js 26 / Ubuntu 24.04で型チェック、lint、整形チェック、単体テスト、ビルドを実行します。
- 別ジョブでChromiumと必要なOSライブラリを入れ、E2Eを実行します。
- E2Eレポートと失敗時のトレース・スクリーンショットを `playwright-results` に7日間保存します。
- 同じPRに新しいコミットをpushすると、古いCI実行をキャンセルします。
- CIでは `test.only` が残っていると失敗します。

ワークフローは `.github/workflows/ci.yml` にあります。PRでは検証のみを行います。mainでは検証成功後にCloudflareへ自動デプロイします。

mainはPR経由で更新し、型チェック等のジョブとChromium E2Eの成功を必須とします。PRのブランチは最新mainに追従している必要があります。管理者にも保護を適用し、force pushとブランチ削除を禁止します。承認者数の指定はありません。

## Cloudflareへのデプロイ

Workers Static Assetsで `dist/` を公開します。設定は `wrangler.jsonc`、Worker名は `night-flight` です。独自ドメインを設定するまではCloudflareの `workers.dev` を使用します。

mainへのpush、またはmainを対象にしたCIの手動実行で、全検証に成功したあとにデプロイします。E2Eが実際に検証した `dist/` を `tested-dist` アーティファクトとして保存し、デプロイジョブが取得します。公開直前に再ビルドしません。PRの実行にはデプロイ認証を渡しません。

初回は、GitHubリポジトリの Settings → Secrets and variables → Actions に次を登録します。

- `CLOUDFLARE_ACCOUNT_ID`：配信先アカウントのID。
- `CLOUDFLARE_API_TOKEN`：Cloudflare公式の「Edit Cloudflare Workers」テンプレートを使い、配信先アカウントに対象を絞ったAPIトークン。

トークンはチャットやソースに貼り付けず、GitHub Secretsに直接入力します。CloudflareのWorkers利用開始と `workers.dev` サブドメインの設定も済ませてください。同じアカウントに `night-flight` がある場合は、既存アプリを上書きしないよう名前を変更してください。

[Cloudflare公式のGitHub Actions認証手順](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

設定の検証だけなら、次を実行できます。公開は行いません。

```sh
npm run build
npx wrangler deploy --dry-run
```

認証情報が未登録の場合はデプロイジョブが明示的に失敗します。登録後はmainのCIを手動実行して再検証・配信できます。CIのアーティファクト保存期間は7日です。

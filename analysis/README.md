# 顧客CSV分析（店舗168）

## ファイル構成

| ファイル | 内容 | Gitコミット |
|---|---|---|
| `build_report.py` | 完全版Excel生成（データシート + 数式ベース） | ◯ |
| `build_aggregates.py` | 集計値のみ静的版Excel生成（PIIなし） | ◯ |
| `customer_analysis_store168_aggregates.xlsx` | 集計値のみのスナップショット | ◯ |
| `customer_analysis_store168.xlsx` | データシート付き完全版（顧客PII含む） | × (`.gitignore`) |
| `customers_utf8.csv` | 変換済みCSV | × (`.gitignore`) |

## 使い方
```
# 1) CSVをUTF-8化
iconv -f SHIFT_JIS -t UTF-8 customers_168_YYYYMMDD.csv > customers_utf8.csv

# 2a) 完全版（データシート付き・数式で自動更新される版）
python3 build_report.py
# → customer_analysis_store168.xlsx

# 2b) 集計値のみの静的版（共有・レビュー用）
python3 build_aggregates.py
# → customer_analysis_store168_aggregates.xlsx
```

## 完全版（build_report.py）のExcelシート構成
- `概要・データ状況` — 使い方 / できること / できないこと
- `全期間` — 全登録者ベースの集計（数式で「データ」シートを参照）
- `2022年度` 〜 `2026年度` — 登録日時の年でフィルタした集計
- `データ` — 生データ + 派生列（性別 / 登録年度 / 年齢 / 年齢帯 / チャネルフラグ）を Excel Table (`tblCustomers`) として保持

### 追加データの反映方法（完全版）
1. Excel で「データ」シートを開く
2. Table の末尾の行にカーソルを置き、次の行に新規データを貼り付け or 入力
3. Table が自動で拡張し、派生列の数式（性別 / 年齢 / 年齢帯 / フラグ列）も自動で伝播
4. 分析シートは COUNTIFS/SUMIFS で `tblCustomers` を参照しているため、開くと即座に再計算される

## 各分析シートに含まれるブロック
1. 男女比率
2. 男女別 年齢構成（登録時点の満年齢, 10〜19 / 20〜22 / 23〜26 / 27〜29 / 30〜34 / 35〜39 / 40〜49 / 50〜59 / 60〜）
3. 当店を知ったきっかけ（性別別・複数選択対応）
4. ご来店の一番の決め手（性別別）
5. 今後の理想的なご来店ペース（性別別）
6. 本日のご予算（性別別）
7. 生活スタイル（性別別）

## データで「できないこと」
- **3回以上 / 5回以上来店の顧客抽出** — このCSVには来店回数カラムがなく、"最終来店日" しかありません。予約履歴 or 施術履歴のエクスポートが別途必要です。
- **全店舗合計** — このファイルは店舗168単体分。他店舗データを「データ」に追加すれば同じ仕組みで集計可能（分析シートを複製 & 店舗IDを変更）。

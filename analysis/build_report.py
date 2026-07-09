"""顧客CSV → Excel分析レポート
店舗168 のみ。年度は登録日時ベース。年齢は登録時点。
"""
import csv
from collections import Counter, OrderedDict
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

CSV_PATH = 'customers_utf8.csv'
OUT_PATH = 'customer_analysis_store168.xlsx'
STORE_NAME = '店舗168'

AGE_BUCKETS = [
    ('10〜19', 10, 19),
    ('20〜22', 20, 22),
    ('23〜26', 23, 26),
    ('27〜29', 27, 29),
    ('30〜34', 30, 34),
    ('35〜39', 35, 39),
    ('40〜49', 40, 49),
    ('50〜59', 50, 59),
    ('60〜',   60, 200),
]

GENDER_MAP = {'0': '未設定', '1': '男性', '2': '女性'}

# 選択肢マスタ（データ内の記号コードを人間可読にマッピング）
CHANNEL_LABELS = {
    '0_le30n6ak': 'ホットペッパー',
    '1_le30ogin': 'minimo',
    '2_le30oih3': '口コミ',
    '3_le30onge': '紹介',
    '4_le30tm6n': 'その他',
}

def norm_channel(v):
    """複数選択(カンマ区切り)は先頭のみ採用、コード→ラベル変換、空白除去"""
    v = v.strip()
    if not v:
        return ''
    # 「ホットペッパー」等プレーンテキストも来る
    parts = [p.strip() for p in v.split(',') if p.strip()]
    # 単一値としてまとめる
    labeled = []
    for p in parts:
        labeled.append(CHANNEL_LABELS.get(p, p))
    return ','.join(labeled)


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def age_at(dob: datetime, ref: datetime) -> int:
    a = ref.year - dob.year
    if (ref.month, ref.day) < (dob.month, dob.day):
        a -= 1
    return a


def age_bucket(age: int) -> str:
    if age is None or age < 10:
        return None
    for label, lo, hi in AGE_BUCKETS:
        if lo <= age <= hi:
            return label
    return None


# データ読込
def load_rows():
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        raw = list(reader)

    records = []
    for r in raw:
        dob = parse_date(r[5])
        reg = parse_date(r[10])
        gender = r[6]
        rec = {
            'id': r[0],
            'gender': gender,
            'gender_label': GENDER_MAP.get(gender, '未設定'),
            'dob': dob,
            'reg': reg,
            'reg_year': reg.year if reg else None,
            'age': age_at(dob, reg) if (dob and reg) else None,
            'channel': norm_channel(r[13]),
            'decision': r[14].strip(),
            'pace': r[15].strip(),
            'budget': r[16].strip(),
            'lifestyle': r[17].strip(),
        }
        rec['age_bucket'] = age_bucket(rec['age'])
        records.append(rec)
    return records


# ============ 集計ユーティリティ ============

def pct(n, d):
    if not d:
        return 0.0
    return round(n / d * 100, 1)


def filter_records(records, year=None):
    if year is None:
        return records
    return [r for r in records if r['reg_year'] == year]


def gender_ratio(records):
    """性別比率: {男性:count, 女性:count, 未設定:count, 合計:count}"""
    c = Counter(r['gender_label'] for r in records)
    total = sum(c.values())
    return {
        '男性': c.get('男性', 0),
        '女性': c.get('女性', 0),
        '未設定': c.get('未設定', 0),
        '合計': total,
    }


def age_by_gender(records):
    """性別×年齢バケット の件数マトリクス"""
    result = {g: {b[0]: 0 for b in AGE_BUCKETS} for g in ['男性', '女性', '未設定']}
    unknown_age = {g: 0 for g in ['男性', '女性', '未設定']}
    for r in records:
        g = r['gender_label']
        if r['age_bucket']:
            result[g][r['age_bucket']] += 1
        else:
            unknown_age[g] += 1
    return result, unknown_age


def field_ratio_by_gender(records, field, multi=False):
    """性別ごとに指定フィールドの値別件数を集計。
    multi=Trueなら","区切りを分解して個別カウント（複数選択項目用）。
    戻り値: (集計dict, 有効回答者数dict) — %計算で回答者数を分母にする"""
    by_g = {g: Counter() for g in ['男性', '女性', '未設定']}
    respondents = {g: 0 for g in ['男性', '女性', '未設定']}
    for r in records:
        v = r[field]
        if not v:
            continue
        respondents[r['gender_label']] += 1
        if multi:
            for p in v.split(','):
                p = p.strip()
                if p:
                    by_g[r['gender_label']][p] += 1
        else:
            by_g[r['gender_label']][v] += 1
    return by_g, respondents


# ============ Excel 書き出し ============

HEADER_FILL = PatternFill('solid', fgColor='305496')
SECTION_FILL = PatternFill('solid', fgColor='B4C7E7')
TOTAL_FILL = PatternFill('solid', fgColor='FFF2CC')
THIN = Side(style='thin', color='BFBFBF')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def style_header(cell):
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = HEADER_FILL
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.border = BORDER


def style_section(cell):
    cell.font = Font(bold=True)
    cell.fill = SECTION_FILL
    cell.alignment = Alignment(horizontal='left', vertical='center')
    cell.border = BORDER


def style_total(cell):
    cell.fill = TOTAL_FILL
    cell.font = Font(bold=True)
    cell.border = BORDER


def style_cell(cell):
    cell.border = BORDER
    cell.alignment = Alignment(horizontal='center', vertical='center')


def write_gender_block(ws, start_row, records, title):
    """性別比率ブロック"""
    ws.cell(row=start_row, column=1, value=title)
    style_section(ws.cell(row=start_row, column=1))
    ws.merge_cells(start_row=start_row, start_column=1, end_row=start_row, end_column=4)

    headers = ['区分', '人数', '構成比(%)', '有効母数比(%)*']
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=start_row + 1, column=i, value=h)
        style_header(c)

    gr = gender_ratio(records)
    total = gr['合計']
    valid = gr['男性'] + gr['女性']
    rows = [
        ('男性', gr['男性']),
        ('女性', gr['女性']),
        ('未設定', gr['未設定']),
    ]
    r = start_row + 2
    for label, n in rows:
        ws.cell(row=r, column=1, value=label)
        ws.cell(row=r, column=2, value=n)
        ws.cell(row=r, column=3, value=pct(n, total))
        if label in ('男性', '女性'):
            ws.cell(row=r, column=4, value=pct(n, valid))
        else:
            ws.cell(row=r, column=4, value='-')
        for c in range(1, 5):
            style_cell(ws.cell(row=r, column=c))
        r += 1
    ws.cell(row=r, column=1, value='合計')
    ws.cell(row=r, column=2, value=total)
    ws.cell(row=r, column=3, value=100.0 if total else 0)
    ws.cell(row=r, column=4, value=100.0 if valid else 0)
    for c in range(1, 5):
        style_total(ws.cell(row=r, column=c))
    ws.cell(row=r + 1, column=1, value='* 有効母数比 = 男女合計を母数とした比率（未設定を除く）')
    ws.cell(row=r + 1, column=1).font = Font(italic=True, size=9, color='7F7F7F')
    return r + 2


def write_age_block(ws, start_row, records, title):
    """性別×年齢帯 マトリクス"""
    ws.cell(row=start_row, column=1, value=title)
    style_section(ws.cell(row=start_row, column=1))
    ws.merge_cells(start_row=start_row, start_column=1, end_row=start_row, end_column=8)

    headers = ['年齢帯', '男性', '男性 %', '女性', '女性 %', '未設定', '合計', '合計 %']
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=start_row + 1, column=i, value=h)
        style_header(c)

    mat, unk = age_by_gender(records)
    total_m = sum(mat['男性'].values())
    total_f = sum(mat['女性'].values())
    total_u = sum(mat['未設定'].values())
    grand_known = total_m + total_f + total_u  # 年齢判明ベース

    r = start_row + 2
    for label, _, _ in AGE_BUCKETS:
        m = mat['男性'][label]
        f = mat['女性'][label]
        u = mat['未設定'][label]
        row_total = m + f + u
        ws.cell(row=r, column=1, value=label)
        ws.cell(row=r, column=2, value=m)
        ws.cell(row=r, column=3, value=pct(m, total_m))
        ws.cell(row=r, column=4, value=f)
        ws.cell(row=r, column=5, value=pct(f, total_f))
        ws.cell(row=r, column=6, value=u)
        ws.cell(row=r, column=7, value=row_total)
        ws.cell(row=r, column=8, value=pct(row_total, grand_known))
        for c in range(1, 9):
            style_cell(ws.cell(row=r, column=c))
        r += 1

    # 生年月日不明
    ws.cell(row=r, column=1, value='生年月日不明')
    ws.cell(row=r, column=2, value=unk['男性'])
    ws.cell(row=r, column=3, value='-')
    ws.cell(row=r, column=4, value=unk['女性'])
    ws.cell(row=r, column=5, value='-')
    ws.cell(row=r, column=6, value=unk['未設定'])
    ws.cell(row=r, column=7, value=sum(unk.values()))
    ws.cell(row=r, column=8, value='-')
    for c in range(1, 9):
        style_cell(ws.cell(row=r, column=c))
    r += 1

    # 合計
    ws.cell(row=r, column=1, value='年齢判明合計')
    ws.cell(row=r, column=2, value=total_m)
    ws.cell(row=r, column=3, value=100.0 if total_m else 0)
    ws.cell(row=r, column=4, value=total_f)
    ws.cell(row=r, column=5, value=100.0 if total_f else 0)
    ws.cell(row=r, column=6, value=total_u)
    ws.cell(row=r, column=7, value=grand_known)
    ws.cell(row=r, column=8, value=100.0 if grand_known else 0)
    for c in range(1, 9):
        style_total(ws.cell(row=r, column=c))
    return r + 2


def write_field_block(ws, start_row, records, field, title, multi=False, col_labels=('男性', '女性', '未設定', '合計')):
    """自由記述系フィールド × 性別の集計。
    multi=True なら複数選択項目として分解カウント（%は回答者数を分母）。"""
    ws.cell(row=start_row, column=1, value=title)
    style_section(ws.cell(row=start_row, column=1))
    ws.merge_cells(start_row=start_row, start_column=1, end_row=start_row, end_column=1 + len(col_labels) * 2)

    by_g, respondents = field_ratio_by_gender(records, field, multi=multi)
    all_values = set()
    for g in by_g:
        all_values.update(by_g[g].keys())
    ordered = sorted(all_values, key=lambda v: -sum(by_g[g].get(v, 0) for g in by_g))

    header = ['項目']
    for g in col_labels:
        header.append(f'{g} 件数')
        header.append(f'{g} %')
    for i, h in enumerate(header, 1):
        c = ws.cell(row=start_row + 1, column=i, value=h)
        style_header(c)

    if multi:
        # %の分母は「回答者数」（複数選択でも1人1カウント）
        denominators = respondents.copy()
        denominators['合計'] = sum(respondents.values())
    else:
        denominators = {g: sum(by_g[g].values()) for g in ['男性', '女性', '未設定']}
        denominators['合計'] = sum(denominators.values())

    r = start_row + 2
    for v in ordered:
        ws.cell(row=r, column=1, value=v)
        col = 2
        m = by_g['男性'].get(v, 0)
        f = by_g['女性'].get(v, 0)
        u = by_g['未設定'].get(v, 0)
        pair = {'男性': m, '女性': f, '未設定': u, '合計': m + f + u}
        for g in col_labels:
            ws.cell(row=r, column=col, value=pair[g])
            ws.cell(row=r, column=col + 1, value=pct(pair[g], denominators[g]))
            col += 2
        for c in range(1, 1 + len(col_labels) * 2):
            style_cell(ws.cell(row=r, column=c))
        r += 1

    # 回答者数（分母）
    label = '回答者数（%分母）' if multi else '回答合計'
    ws.cell(row=r, column=1, value=label)
    col = 2
    for g in col_labels:
        ws.cell(row=r, column=col, value=denominators[g])
        ws.cell(row=r, column=col + 1, value=100.0 if denominators[g] else 0)
        col += 2
    for c in range(1, 1 + len(col_labels) * 2):
        style_total(ws.cell(row=r, column=c))
    r += 1

    note = '※ 複数選択項目。%は各性別の「回答者数」を分母（1人が複数選ぶため件数合計は100%を超える）。'
    if not multi:
        note = '※ 未回答（空欄）はカウント対象外。'
    ws.cell(row=r, column=1, value=note)
    ws.cell(row=r, column=1).font = Font(italic=True, size=9, color='7F7F7F')
    return r + 2


def make_sheet(wb, sheet_name, records, period_label):
    ws = wb.create_sheet(sheet_name)
    ws.column_dimensions['A'].width = 32
    for col in 'BCDEFGHIJ':
        ws.column_dimensions[col].width = 14

    ws.cell(row=1, column=1, value=f'{STORE_NAME}  |  期間: {period_label}  |  対象件数: {len(records):,}')
    ws.cell(row=1, column=1).font = Font(bold=True, size=14)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=10)

    r = 3
    r = write_gender_block(ws, r, records, '■ 男女比率')
    r += 1
    r = write_age_block(ws, r, records, '■ 男女別 年齢構成（登録時点の年齢）')
    r += 1
    r = write_field_block(ws, r, records, 'channel', '■ 当店を知ったきっかけ（性別別・複数選択）', multi=True)
    r += 1
    r = write_field_block(ws, r, records, 'decision', '■ ご来店の一番の決め手（性別別）')
    r += 1
    r = write_field_block(ws, r, records, 'pace', '■ 今後の理想的なご来店ペース（性別別）')
    r += 1
    r = write_field_block(ws, r, records, 'budget', '■ 本日のご予算（性別別）')
    r += 1
    r = write_field_block(ws, r, records, 'lifestyle', '■ 生活スタイル（性別別）')
    return ws


def write_overview_sheet(wb, records, years):
    ws = wb.create_sheet('概要・データ状況', 0)
    ws.column_dimensions['A'].width = 32
    ws.column_dimensions['B'].width = 20
    ws.column_dimensions['C'].width = 60

    ws.cell(row=1, column=1, value=f'{STORE_NAME}  顧客分析レポート')
    ws.cell(row=1, column=1).font = Font(bold=True, size=16)
    ws.cell(row=2, column=1, value='出力日: 2026-07-09  /  データソース: customers_168_20260709.csv')
    ws.cell(row=2, column=1).font = Font(size=10, color='7F7F7F')

    # データ状況
    ws.cell(row=4, column=1, value='■ データで「できること」')
    style_section(ws.cell(row=4, column=1))
    ws.merge_cells(start_row=4, start_column=1, end_row=4, end_column=3)

    ok_rows = [
        ('男女比率', f'{len(records):,}件全数集計可能'),
        ('男女別 年齢構成', f'生年月日ありは {sum(1 for r in records if r["dob"]):,}件（{sum(1 for r in records if r["dob"]) / len(records) * 100:.1f}%）'),
        ('登録年度別 集計', f'2022〜2026年度（登録日時ベース）'),
        ('知ったきっかけ / 決め手 / 来店ペース / 予算 / 生活スタイル', 'アンケート回答者ベースで集計'),
    ]
    r = 5
    for k, v in ok_rows:
        ws.cell(row=r, column=1, value='◯')
        ws.cell(row=r, column=1).font = Font(color='2E7D32', bold=True)
        ws.cell(row=r, column=1).alignment = Alignment(horizontal='center')
        ws.cell(row=r, column=2, value=k)
        ws.cell(row=r, column=3, value=v)
        r += 1

    r += 1
    ws.cell(row=r, column=1, value='■ データで「できないこと」（今回のCSVでは不足）')
    style_section(ws.cell(row=r, column=1))
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    r += 1
    ng_rows = [
        ('3回以上来店の男女比率・年齢構成', '来店回数のカラムがCSVに含まれていません（"最終来店日"のみ）。'),
        ('5回以上来店の男女比率・年齢構成', '同上。予約履歴 or 施術履歴のエクスポートが別途必要です。'),
        ('全店舗合計', 'この1ファイルは単一店舗（168）分のみ。他3店舗のCSVを揃えれば合算できます。'),
    ]
    for k, v in ng_rows:
        ws.cell(row=r, column=1, value='×')
        ws.cell(row=r, column=1).font = Font(color='C62828', bold=True)
        ws.cell(row=r, column=1).alignment = Alignment(horizontal='center')
        ws.cell(row=r, column=2, value=k)
        ws.cell(row=r, column=3, value=v)
        r += 1

    r += 1
    ws.cell(row=r, column=1, value='■ 集計ルール')
    style_section(ws.cell(row=r, column=1))
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    r += 1
    rules = [
        ('年度の定義', '登録日時の年（例: 2026-07-09登録 → 2026年）'),
        ('年齢の基準日', '登録日時時点の満年齢'),
        ('性別コード', '0=未設定 / 1=男性 / 2=女性'),
        ('%の分母', '各セクション記載の合計人数（未回答は原則母数外）'),
        ('知ったきっかけの複数選択', '","区切りの場合は全選択肢をカウント'),
    ]
    for k, v in rules:
        ws.cell(row=r, column=1, value=k)
        ws.cell(row=r, column=1).font = Font(bold=True)
        ws.cell(row=r, column=2, value=v)
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        r += 1

    r += 1
    ws.cell(row=r, column=1, value='■ シート一覧')
    style_section(ws.cell(row=r, column=1))
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    r += 1
    ws.cell(row=r, column=1, value='全期間').font = Font(bold=True)
    ws.cell(row=r, column=2, value=f'{len(records):,} 件')
    r += 1
    for y in years:
        cnt = sum(1 for rec in records if rec['reg_year'] == y)
        ws.cell(row=r, column=1, value=f'{y}年度').font = Font(bold=True)
        ws.cell(row=r, column=2, value=f'{cnt:,} 件')
        r += 1

    return ws


def main():
    records = load_rows()
    years = sorted({r['reg_year'] for r in records if r['reg_year']})
    print(f'Total records: {len(records)}')
    print(f'Years: {years}')

    wb = Workbook()
    # デフォルトのシートを削除
    default = wb.active
    wb.remove(default)

    write_overview_sheet(wb, records, years)

    # 全期間
    make_sheet(wb, '全期間', records, '全期間')
    # 年度別
    for y in years:
        subset = [r for r in records if r['reg_year'] == y]
        make_sheet(wb, f'{y}年度', subset, f'{y}年度')

    wb.save(OUT_PATH)
    print(f'Saved: {OUT_PATH}')


if __name__ == '__main__':
    main()

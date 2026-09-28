from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation

F="Arial"
def font(**k): return Font(name=F, size=k.pop("size",10), **k)
BLUE=font(color="0000FF"); BLACK=font(); GREEN=font(color="008000")
YEL=PatternFill("solid", fgColor="FFFF00")
INP=PatternFill("solid", fgColor="FFF9DB")
HDR=PatternFill("solid", fgColor="1F3864"); SUB=PatternFill("solid", fgColor="D9E1F2")
G1=PatternFill("solid", fgColor="E2EFDA"); G2=PatternFill("solid", fgColor="FCE4D6"); G3=PatternFill("solid", fgColor="EDE7F6")
thin=Side(style="thin", color="BFBFBF"); BOX=Border(left=thin,right=thin,top=thin,bottom=thin)
C=Alignment(horizontal="center", vertical="center", wrap_text=True)
WON='#,##0;(#,##0);-'; PCT='0.0%;(0.0%);-'

wb=Workbook()
# ---------- 설정 ----------
st=wb.active; st.title="설정"
st["A1"]="기준값 설정 (노란 칸만 수정)"; st["A1"].font=font(bold=True,size=14)
rows=[
 ("당근 판매가 할인율 (시장 최저가 대비)",0.10,PCT,"당근 판매가를 시장 최저가보다 몇 % 싸게 잡을지. 전자책 권장 20~30%는 '시중가' 기준이며, 여기서는 이미 '최저가' 기준이라 10%를 출발점으로 둔 가정값."),
 ("당근 비즈프로필 판매 수수료",0.05,PCT,"가정값. 당근 앱 비즈프로필 > 상품 판매 안내에서 실제 수수료를 확인해 수정하세요."),
 ("스마트스토어 수수료 (결제+연동 합산)",0.06,PCT,"가정값(네이버페이 주문관리 + 네이버쇼핑 매출연동 수수료 대략 합산). 판매자센터에서 실제 요율 확인 후 수정."),
 ("쿠팡 판매 수수료",0.108,PCT,"가정값(다수 카테고리 기준 대략치). 카테고리별로 다르니 쿠팡 윙에서 확인 후 수정."),
 ("건당 예상 광고비 (원)",1000,WON,"가정값. 광고 테스트 후 '광고비 ÷ 판매건수'로 갱신하세요."),
 ("판매추천 최소 마진율",0.20,PCT,"가정값. 이 마진율 이상 + 아래 최소 마진액 이상일 때 '판매추천'."),
 ("판매추천 최소 마진액 (원)",3000,WON,"가정값. 건당 이 금액 이상 남아야 판매추천."),
 ("오픈마켓 최저가 대비 가격 (원)",-100,WON,"스마트스토어/쿠팡에 올린다면 시장 최저가보다 얼마 낮게 팔지 (−100 = 100원 싸게)."),
]
for i,(lab,v,fmt,note) in enumerate(rows, start=3):
    st.cell(i,1,lab).font=BLACK
    c=st.cell(i,2,v); c.font=BLUE; c.fill=YEL; c.number_format=fmt; c.border=BOX
    st.cell(i,3,note).font=font(color="595959",size=9)
st.column_dimensions["A"].width=38; st.column_dimensions["B"].width=12; st.column_dimensions["C"].width=95
N={ "disc":"설정!$B$3","dfee":"설정!$B$4","ssfee":"설정!$B$5","cpfee":"설정!$B$6",
    "ad":"설정!$B$7","minr":"설정!$B$8","minm":"설정!$B$9","mk":"설정!$B$10"}

# ---------- 가격비교 ----------
ws=wb.create_sheet("가격비교",0)
ws["A1"]="도매 3사 × 오픈마켓 가격경쟁력 비교표"; ws["A1"].font=font(bold=True,size=14)
ws["A2"]="노란 칸=직접 입력 · 흰 칸=자동 계산 · 모든 가격은 '1개 기준, 배송비 포함' 원 단위 · 4~5행은 가상 예시(지우고 사용)"
ws["A2"].font=font(color="C00000",size=9)
groups=[("A","D","상품 정보",SUB),("E","G","스페셜오퍼",G1),("H","J","도매매",G1),("K","N","도매꾹",G1),
        ("O","Q","소싱 결과",SUB),("R","U","시장가 (스마트스토어·쿠팡)",G2),
        ("V","AA","당근 비즈프로필",G3),("AB","AC","오픈마켓 판매 시",G2),("AD","AE","판정",SUB)]
from openpyxl.utils import column_index_from_string as ci, get_column_letter as gl
for a,b,t,fill in groups:
    ws.merge_cells(f"{a}3:{b}3"); c=ws[f"{a}3"]; c.value=t; c.font=font(bold=True); c.alignment=C
    for col in range(ci(a),ci(b)+1): ws.cell(3,col).fill=fill; ws.cell(3,col).border=BOX
heads=[("No",5),("상품명",24),("모델/규격\n(동일상품 확인)",16),("카테고리",10),
 ("단가",9),("배송비",8),("합계",9),
 ("단가",9),("배송비",8),("합계",9),
 ("단가",9),("배송비",8),("합계",9),("최소구매\n수량",8),
 ("최저 원가",10),("최저\n소싱처",10),("소싱처간\n가격차",9),
 ("스마트스토어\n최저가",11),("쿠팡\n최저가",10),("시장\n최저가",10),("원가율\n(낮을수록↑)",10),
 ("당근\n권장가",10),("당근 판매가\n(직접입력)",11),("적용\n판매가",10),("당근\n수수료",9),("당근\n순마진",10),("당근\n마진율",9),
 ("스마트스토어\n마진",11),("쿠팡\n마진",10),
 ("판정",13),("메모 (출고등급·취소율·리뷰수 등)",34)]
inputs={"B","C","D","E","F","H","I","K","L","N","R","S","W","AE"}
for i,(h,w) in enumerate(heads, start=1):
    c=ws.cell(4-0,i); 
for i,(h,w) in enumerate(heads, start=1):
    c=ws.cell(4,i,h); c.font=font(bold=True,color="FFFFFF"); c.fill=HDR; c.alignment=C; c.border=BOX
    ws.column_dimensions[gl(i)].width=w
ws.row_dimensions[4].height=42
first,last=5,204
for r in range(first,last+1):
    f={
    "A":r-first+1,
    "G":f'=IF(E{r}="","",E{r}+F{r})',
    "J":f'=IF(H{r}="","",H{r}+I{r})',
    "M":f'=IF(K{r}="","",K{r}+L{r})',
    "O":f'=IF(COUNT(G{r},J{r},M{r})=0,"",MIN(G{r},J{r},M{r}))',
    "P":f'=IF(O{r}="","",IF(O{r}=G{r},"스페셜오퍼",IF(O{r}=J{r},"도매매","도매꾹")))',
    "Q":f'=IF(COUNT(G{r},J{r},M{r})<2,"",MAX(G{r},J{r},M{r})-MIN(G{r},J{r},M{r}))',
    "T":f'=IF(COUNT(R{r},S{r})=0,"",MIN(R{r},S{r}))',
    "U":f'=IF(OR(O{r}="",T{r}=""),"",O{r}/T{r})',
    "V":f'=IF(T{r}="","",ROUNDDOWN(T{r}*(1-{N["disc"]}),-2))',
    "X":f'=IF(W{r}<>"",W{r},V{r})',
    "Y":f'=IF(X{r}="","",X{r}*{N["dfee"]})',
    "Z":f'=IF(OR(X{r}="",O{r}=""),"",X{r}-Y{r}-O{r}-{N["ad"]})',
    "AA":f'=IF(OR(Z{r}="",X{r}=0),"",Z{r}/X{r})',
    "AB":f'=IF(OR(T{r}="",O{r}=""),"",(T{r}+{N["mk"]})*(1-{N["ssfee"]})-O{r})',
    "AC":f'=IF(OR(T{r}="",O{r}=""),"",(T{r}+{N["mk"]})*(1-{N["cpfee"]})-O{r})',
    "AD":f'=IF(B{r}="","",IF(OR(O{r}="",T{r}=""),"가격 입력 필요",IF(Z{r}<=0,"❌ 제외",IF(AND(P{r}="도매꾹",N{r}>1),"⚠️ 최소수량 확인",IF(AND(AA{r}>={N["minr"]},Z{r}>={N["minm"]}),"✅ 판매추천",IF(Z{r}>0,"⚠️ 마진부족","❌ 제외"))))))',
    }
    for col in range(1,len(heads)+1):
        L=gl(col); c=ws.cell(r,col)
        if L in f: c.value=f[L]
        c.border=BOX; c.font=BLUE if L in inputs else BLACK
        if L in inputs: c.fill=INP
        if L in {"E","F","G","H","I","J","K","L","M","O","Q","R","S","T","V","W","X","Y","Z","AB","AC"}: c.number_format=WON
        if L in {"U","AA"}: c.number_format=PCT
        if L in {"A","D","N","P","AD"}: c.alignment=Alignment(horizontal="center")
# 예시 (가상)
ex=[(5,dict(B="[예시] 접이식 실리콘 수납바구니",C="대형 3단",D="생활",E=6900,F=3000,H=7200,I=2500,K=5800,L=3500,N=1,R=16900,S=15800,AE="가상 예시 · 스페셜오퍼 출고 최우수/취소 0%")),
    (6,dict(B="[예시] 휴대용 미니 선풍기",C="USB충전",D="계절가전",E=4500,F=3000,H=4300,I=3000,K=3900,L=3000,N=10,R=8900,S=8500,AE="가상 예시 · 도매꾹 최소 10개 → 위탁 불가, 재확인"))]
for r,d in ex:
    for k,v in d.items(): ws[f"{k}{r}"]=v
ws.freeze_panes="C5"
ws.auto_filter.ref=f"A4:AE{last}"
rng=f"AD{first}:AD{last}"
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'LEFT(AD{first},1)="✅"'], fill=PatternFill("solid",fgColor="C6EFCE"), font=Font(name=F,color="006100",bold=True)))
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'LEFT(AD{first},1)="⚠"'], fill=PatternFill("solid",fgColor="FFEB9C"), font=Font(name=F,color="9C5700",bold=True)))
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'LEFT(AD{first},1)="❌"'], fill=PatternFill("solid",fgColor="FFC7CE"), font=Font(name=F,color="9C0006",bold=True)))
ws.conditional_formatting.add(f"N{first}:N{last}", FormulaRule(formula=[f'AND(N{first}<>"",N{first}>1)'], fill=PatternFill("solid",fgColor="FFC7CE")))
ws["N4"].comment=Comment("1보다 크면 빨간색: 위탁(1개 발주)이 안 되는 조건입니다. 도매꾹은 최소구매수량이 있는 상품이 많아요.","Claude")
ws["R4"].comment=Comment("네이버쇼핑에서 '배송비 포함' 최저가. 동일 모델·규격인지 꼭 확인.","Claude")
ws["S4"].comment=Comment("쿠팡 검색 최저가(로켓배송 포함, 배송비 포함).","Claude")
ws["U4"].comment=Comment("최저 원가 ÷ 시장 최저가. 60% 이하면 가격경쟁력이 좋은 편(가정 기준).","Claude")
ws["Z4"].comment=Comment("적용판매가 − 당근 수수료 − 최저원가 − 건당 광고비(설정 시트).","Claude")
ws["AB4"].comment=Comment("스마트스토어에 '시장 최저가 − 100원'으로 올렸을 때 남는 금액(수수료 차감).","Claude")

# ---------- 체크리스트 ----------
ck=wb.create_sheet("소싱체크리스트")
ck["A1"]="상품 선정 체크리스트 (판정 '✅' 상품만 최종 점검)"; ck["A1"].font=font(bold=True,size=14)
items=[
("가격","3사(스페셜오퍼·도매매·도매꾹) 모두 검색해 '배송비 포함' 단가를 비교했다"),
("가격","스마트스토어·쿠팡 최저가가 '같은 모델·같은 구성'인지 확인했다"),
("가격","쿠팡 로켓배송 가격이 내 원가보다 낮지 않다 (로켓 최저가는 이기기 어려움)"),
("위탁","최소구매수량 1개, 고객 직배송(위탁배송)이 가능하다"),
("위탁","송하인(보내는 사람)을 내 상호로 지정할 수 있다"),
("위탁","발주마감 시간과 평균 출고일을 확인했다"),
("품질","출고율 최우수 / 취소율 0%에 가깝다 (스페셜오퍼 등급 표시)"),
("품질","반품·불량 처리 절차가 있다"),
("품질","샘플 1개를 직접 사서 확인했다"),
("판매","상품명을 검색하면 판매처가 너무 많지 않다 (경쟁 강도)"),
("판매","부피 작고 파손 위험 낮은 상품이다"),
("판매","지금 계절·시즌에 맞는 상품이다"),
("법규","KC인증·전파인증 등 필수 인증 대상이면 인증번호가 있다 (전기·아동·생활화학 제품 주의)"),
("법규","상표·브랜드 무단사용(짝퉁) 위험이 없다"),
]
for j,h in enumerate(["구분","확인 항목","체크(O/X)"],1):
    c=ck.cell(3,j,h); c.font=font(bold=True,color="FFFFFF"); c.fill=HDR; c.border=BOX; c.alignment=C
for i,(g,t) in enumerate(items, start=4):
    ck.cell(i,1,g).font=BLACK; ck.cell(i,2,t).font=BLACK
    c=ck.cell(i,3); c.fill=INP; c.font=BLUE; c.alignment=Alignment(horizontal="center")
    for j in range(1,4): ck.cell(i,j).border=BOX
dv=DataValidation(type="list", formula1='"O,X"', allow_blank=True); ck.add_data_validation(dv); dv.add(f"C4:C{3+len(items)}")
ck.column_dimensions["A"].width=8; ck.column_dimensions["B"].width=80; ck.column_dimensions["C"].width=11

# ---------- 사용법 ----------
hw=wb.create_sheet("사용법")
guide=["사용 순서",
"1. [설정] 시트의 노란 칸(수수료·할인율·광고비·기준 마진)을 내 실제 조건으로 수정합니다. 기본값은 모두 가정값입니다.",
"2. [가격비교] 4~5행의 [예시] 가상 데이터를 지우고, 후보 상품을 한 줄에 하나씩 입력합니다.",
"3. 같은 상품을 스페셜오퍼 → 도매매 → 도매꾹 순으로 검색해 '단가'와 '배송비'를 입력합니다. 없는 곳은 비워두세요.",
"4. 도매꾹은 '최소구매수량'도 입력합니다. 1보다 크면 빨갛게 표시되며 위탁판매가 어렵습니다.",
"5. 네이버쇼핑·쿠팡에서 '배송비 포함 최저가'를 입력합니다. 반드시 같은 모델·규격끼리 비교하세요.",
"6. 판정 열에서 '✅ 판매추천' 상품만 필터로 모아 [소싱체크리스트]로 최종 점검합니다.",
"7. 당근 판매가를 따로 정하고 싶으면 '당근 판매가(직접입력)' 칸에 입력하면 그 값으로 다시 계산됩니다.",
"",
"색상 규칙: 노란 칸 = 입력 · 흰 칸 = 자동 계산(수정 금지) · 파란 글씨 = 직접 넣은 값",
"주의: 가격·수수료·배송비는 수시로 바뀝니다. 발주 전 반드시 사이트에서 다시 확인하세요."]
for i,t in enumerate(guide,1):
    c=hw.cell(i,1,t); c.font=font(bold=(i==1),size=12 if i==1 else 10)
hw.column_dimensions["A"].width=120
wb.move_sheet("사용법",-(len(wb.sheetnames)-1))
from openpyxl.workbook.properties import CalcProperties
wb.calculation=CalcProperties(fullCalcOnLoad=True)
wb.save("/home/user/magggy/sourcing/가격비교_소싱시트.xlsx")

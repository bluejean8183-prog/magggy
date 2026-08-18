/*!
 * 11번가 셀러오피스 - 화면 구조 진단 스크립트 (읽기 전용)
 *
 * 사용법: 판매상품 목록 화면에서 F12 → Console 탭에 이 파일 전체를 붙여넣고 Enter.
 * 아무것도 클릭하거나 변경하지 않고, 자동화 스크립트가 무엇을 찾아냈는지만 출력합니다.
 * 출력 결과를 그대로 복사해서 알려주시면 선택자를 정확히 맞춰 드릴 수 있습니다.
 */
(() => {
  'use strict';

  const docs = (() => {
    const out = [];
    const visit = (doc) => {
      if (!doc || out.indexOf(doc) !== -1) return;
      out.push(doc);
      doc.querySelectorAll('iframe, frame').forEach((f) => {
        try { visit(f.contentDocument); } catch (e) { /* cross-origin */ }
      });
    };
    visit(document);
    return out;
  })();

  const qsa = (sel) => docs.reduce((acc, d) => acc.concat(Array.from(d.querySelectorAll(sel))), []);

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    const win = el.ownerDocument.defaultView || window;
    const s = win.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };

  const label = (el) => {
    const t = el.tagName === 'INPUT' ? (el.value || '') : (el.innerText || el.textContent || '');
    return t.replace(/\s+/g, ' ').trim().slice(0, 40);
  };

  const path = (el) => {
    const bits = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && bits.length < 4) {
      let b = cur.tagName.toLowerCase();
      if (cur.id) { bits.unshift(b + '#' + cur.id); break; }
      if (cur.className && typeof cur.className === 'string') {
        b += '.' + cur.className.trim().split(/\s+/).slice(0, 2).join('.');
      }
      bits.unshift(b);
      cur = cur.parentElement;
    }
    return bits.join(' > ');
  };

  console.log('%c=== 11번가 셀러오피스 화면 진단 ===', 'font-size:14px;font-weight:bold');
  console.log('URL              :', location.href);
  console.log('접근 가능한 문서 :', docs.length, '개 (메인 문서 + 동일 출처 iframe)');

  const selects = qsa('select').filter(visible);
  console.log('\n%c[1] 화면에 보이는 <select> 목록 (목록 개수 선택 후보)', 'font-weight:bold');
  console.table(selects.map((s, i) => ({
    idx: i,
    name: s.name || '',
    id: s.id || '',
    현재값: s.value,
    옵션: Array.from(s.options).map((o) => `${o.value}:${(o.text || '').trim()}`).join(' | ').slice(0, 90),
    위치: path(s),
  })));

  const boxes = qsa('input[type=checkbox]').filter(visible);
  const headBoxes = qsa('thead input[type=checkbox]').filter(visible);
  console.log('\n%c[2] 체크박스', 'font-weight:bold');
  console.log('화면에 보이는 체크박스 총 개수 :', boxes.length);
  console.log('thead 안의 체크박스(전체선택 후보) :', headBoxes.length);
  console.table(headBoxes.map((c, i) => ({
    idx: i, id: c.id || '', name: c.name || '', checked: c.checked, 위치: path(c),
  })));

  const rowBoxes = qsa('tbody input[type=checkbox]').filter(visible);
  console.log('tbody 안의 체크박스(상품 행 후보) :', rowBoxes.length);

  const BTN_SEL = 'button, a, input[type=button], input[type=submit], span[role=button], [class*=btn]';
  const btns = qsa(BTN_SEL).filter(visible);
  const stopish = btns.filter((b) => /판매\s*중지|판매중지|중지/.test(label(b)));
  console.log('\n%c[3] "판매중지" 관련 버튼 후보', 'font-weight:bold');
  console.table(stopish.map((b, i) => ({
    idx: i, 태그: b.tagName, 텍스트: label(b), 위치: path(b),
  })));

  console.log('\n%c[4] 화면의 모든 버튼 텍스트 (상위 60개)', 'font-weight:bold');
  console.log(btns.map(label).filter(Boolean).slice(0, 60).join(' / '));

  const rows = qsa('tbody tr').filter(visible);
  console.log('\n%c[5] 목록 행 수', 'font-weight:bold');
  console.log('화면에 보이는 tbody tr :', rows.length, '개');

  console.log('\n%c진단 끝. 위 출력 전체를 복사해서 전달해 주세요.', 'font-weight:bold;color:#0a0');
})();

/*!
 * 11번가 셀러오피스 - 판매상품 일괄 "판매중지" 자동화 콘솔 스크립트
 *
 * 동작: [목록 500개씩 보기] → [전체 선택] → [판매중지 클릭] → [확인 팝업 처리] → [목록 갱신 대기]
 *       위 과정을 설정한 횟수(기본 10회)만큼 반복합니다.
 *
 * ────────────────────────────────────────────────────────────────
 * 사용 전 반드시 확인
 *   1) 판매상품 목록 화면에서 "판매상태 = 판매중" 으로 필터를 걸어 두세요.
 *      그래야 처리된 상품이 목록에서 빠지고 다음 500개가 올라옵니다.
 *      (필터가 없으면 이미 중지된 상품을 계속 다시 선택하게 됩니다.)
 *   2) 처음에는 dryRun: true 로 그대로 실행해서 "몇 개가 선택되는지"만 확인하세요.
 *      실제 판매중지는 아무것도 실행하지 않습니다.
 *   3) 확인이 끝나면 아래 CFG 의 dryRun 을 false 로 바꿔 다시 붙여넣으세요.
 *
 * 중단하려면 콘솔에 다음을 입력:  __ST11.stop()
 * ────────────────────────────────────────────────────────────────
 */
(async () => {
  'use strict';

  /** ===== 설정 ===== */
  const CFG = Object.assign({
    dryRun: true,        // true = 선택까지만 하고 판매중지는 누르지 않음 (안전 확인용)
    batches: 10,         // 반복 횟수 (500 × 10 = 약 5,000개)
    pageSize: 500,       // 한 페이지에 보여줄 상품 수
    stepDelayMs: 800,    // 클릭 사이 대기
    batchDelayMs: 3000,  // 배치 사이 대기 (서버 부하 완화)
    waitTimeoutMs: 40000,// 목록 갱신 대기 최대 시간
    stopLabels: ['판매중지', '판매 중지', '판매중지처리', '판매중지하기'],
    confirmLabels: ['확인', '예', 'OK', '적용', '저장'],
  }, window.__ST11_CFG || {});

  /** ===== 중단 스위치 ===== */
  const state = { aborted: false, processed: 0, batchesDone: 0 };
  window.__ST11 = {
    stop() { state.aborted = true; console.warn('[11st] 중단 요청됨. 현재 배치가 끝나면 멈춥니다.'); },
    state,
    CFG,
  };

  /** ===== 유틸 ===== */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const docs = () => {
    const out = [];
    const visit = (doc) => {
      if (!doc || out.indexOf(doc) !== -1) return;
      out.push(doc);
      doc.querySelectorAll('iframe, frame').forEach((f) => {
        try { visit(f.contentDocument); } catch (e) { /* cross-origin: skip */ }
      });
    };
    visit(document);
    return out;
  };

  const qsa = (sel) => docs().reduce((acc, d) => acc.concat(Array.from(d.querySelectorAll(sel))), []);

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    const win = el.ownerDocument.defaultView || window;
    const s = win.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };

  const textOf = (el) => {
    const t = el.tagName === 'INPUT' ? (el.value || '') : (el.innerText || el.textContent || '');
    return t.replace(/\s+/g, ' ').trim();
  };

  const log = (...a) => console.log('%c[11st]', 'color:#0a7', ...a);
  const warn = (...a) => console.warn('[11st]', ...a);

  const waitFor = async (fn, timeout = CFG.waitTimeoutMs, interval = 300) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      let v;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(interval);
    }
    return null;
  };

  const BTN_SEL = 'button, a, input[type=button], input[type=submit], span[role=button], [class*=btn]';

  /** 텍스트로 버튼 찾기 - 정확히 일치하는 것을 우선, 그 다음 포함, 가장 안쪽 요소 선택 */
  const findButton = (labels, scopeEls) => {
    const pool = (scopeEls && scopeEls.length)
      ? scopeEls.reduce((a, s) => a.concat(Array.from(s.querySelectorAll(BTN_SEL))), [])
      : qsa(BTN_SEL);
    const cands = pool.filter(visible).filter((el) => !el.disabled);
    const innermost = (list) => list.filter((el) => !list.some((o) => o !== el && el.contains(o)));

    const exact = cands.filter((el) => labels.some((l) => textOf(el) === l));
    if (exact.length) return innermost(exact)[0];
    const partial = cands.filter((el) => labels.some((l) => textOf(el).includes(l)) && textOf(el).length <= 20);
    if (partial.length) return innermost(partial)[0];
    return null;
  };

  /** ===== 목록 개수(500개씩) 셀렉트 ===== */
  const findPageSizeSelect = () => {
    const sels = qsa('select').filter(visible);
    const score = (s) => {
      const opts = Array.from(s.options);
      const nums = opts
        .map((o) => {
          const v = (o.value || '').trim();
          if (/^\d+$/.test(v)) return Number(v);
          const m = (o.text || '').match(/(\d+)\s*개/);
          return m ? Number(m[1]) : NaN;
        })
        .filter((n) => !isNaN(n));
      if (nums.length < 2) return -1;
      if (!nums.every((n) => n >= 5 && n <= 2000)) return -1;
      let sc = Math.max.apply(null, nums);
      if (opts.some((o) => /개씩|개\s*보기/.test(o.text || ''))) sc += 1000;
      return sc;
    };
    return sels
      .map((s) => ({ s, sc: score(s) }))
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .map((x) => x.s)[0] || null;
  };

  const setPageSize = async () => {
    const sel = findPageSizeSelect();
    if (!sel) { warn('목록 개수 선택 박스를 찾지 못했습니다. 수동으로 500개씩 보기를 설정해 주세요.'); return false; }

    const opts = Array.from(sel.options);
    const pick =
      opts.find((o) => (o.value || '').trim() === String(CFG.pageSize)) ||
      opts.find((o) => (o.text || '').includes(String(CFG.pageSize))) ||
      opts.slice().sort((a, b) => (parseInt(b.value, 10) || 0) - (parseInt(a.value, 10) || 0))[0];

    if (!pick) { warn('원하는 목록 개수 옵션을 찾지 못했습니다.'); return false; }
    if (sel.value === pick.value) { log('목록 개수 이미 설정됨:', textOf(pick)); return true; }

    sel.value = pick.value;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const win = sel.ownerDocument.defaultView || window;
    if (win.jQuery) { try { win.jQuery(sel).trigger('change'); } catch (e) { /* noop */ } }
    log('목록 개수 설정:', textOf(pick));
    await sleep(CFG.batchDelayMs);
    return true;
  };

  /** ===== 체크박스 ===== */
  const rowCheckboxes = () => {
    let boxes = qsa('tbody input[type=checkbox]').filter(visible).filter((c) => !c.disabled);
    if (!boxes.length) {
      const heads = qsa('thead input[type=checkbox]');
      boxes = qsa('input[type=checkbox]')
        .filter(visible)
        .filter((c) => !c.disabled && heads.indexOf(c) === -1);
    }
    return boxes;
  };

  const findSelectAll = () => {
    const head = qsa('thead input[type=checkbox]').filter(visible).filter((c) => !c.disabled)[0];
    if (head) return head;
    return qsa('input[type=checkbox][id*="all" i], input[type=checkbox][name*="all" i], input[type=checkbox][class*="all" i]')
      .filter(visible).filter((c) => !c.disabled)[0] || null;
  };

  const selectAll = async () => {
    const master = findSelectAll();
    if (master) {
      if (master.checked) { master.click(); await sleep(200); }
      master.click();
      master.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(CFG.stepDelayMs);
    }
    let boxes = rowCheckboxes();
    let checked = boxes.filter((c) => c.checked).length;

    // 전체선택이 각 행에 전파되지 않은 경우: 행별로 직접 클릭
    if (checked === 0 && boxes.length) {
      warn('전체선택이 행에 반영되지 않아 개별 클릭으로 대체합니다.');
      boxes.forEach((c) => { if (!c.checked) c.click(); });
      await sleep(CFG.stepDelayMs);
      boxes = rowCheckboxes();
      checked = boxes.filter((c) => c.checked).length;
    }
    return { total: boxes.length, checked };
  };

  /** ===== 확인 팝업 처리 ===== */
  const POPUP_SEL = '[role=dialog], [class*="popup"], [class*="layer"], [class*="modal"], [id*="popup"], [id*="layer"], [id*="modal"]';
  const clickedConfirms = new WeakSet();

  const clickPopupConfirm = () => {
    const containers = qsa(POPUP_SEL).filter(visible).filter((c) => c.getBoundingClientRect().height > 40);
    if (!containers.length) return false;
    const btn = findButton(CFG.confirmLabels, containers);
    if (!btn || clickedConfirms.has(btn)) return false;
    clickedConfirms.add(btn);
    btn.click();
    log('  확인 팝업 처리:', textOf(btn));
    return true;
  };

  /** 네이티브 confirm/alert 를 잠시 자동 승인으로 바꾸고 클릭 */
  const clickWithAutoConfirm = async (btn) => {
    const targets = docs().map((d) => d.defaultView).filter(Boolean);
    const saved = targets.map((w) => {
      const o = { w, confirm: w.confirm, alert: w.alert };
      try {
        w.confirm = () => true;
        w.alert = (m) => log('  alert 자동 확인:', String(m).slice(0, 120));
      } catch (e) { /* noop */ }
      return o;
    });
    try {
      btn.click();
      await sleep(CFG.stepDelayMs);
      for (let i = 0; i < 8; i++) {
        if (!clickPopupConfirm()) break;
        await sleep(CFG.stepDelayMs);
      }
    } finally {
      saved.forEach((o) => { try { o.w.confirm = o.confirm; o.w.alert = o.alert; } catch (e) { /* noop */ } });
    }
  };

  /** ===== 목록 상태 지문 (갱신 감지용) ===== */
  const gridSignature = () => {
    const rows = qsa('tbody tr').filter(visible);
    const first = rows[0] ? textOf(rows[0]).slice(0, 120) : '';
    const last = rows[rows.length - 1] ? textOf(rows[rows.length - 1]).slice(0, 120) : '';
    return rows.length + '|' + first + '|' + last;
  };

  /** ===== 메인 루프 ===== */
  console.log('%c=== 11번가 일괄 판매중지 ===', 'font-size:14px;font-weight:bold');
  log('설정:', JSON.stringify({ dryRun: CFG.dryRun, batches: CFG.batches, pageSize: CFG.pageSize }));
  if (CFG.dryRun) {
    console.warn('%cDRY RUN 모드입니다. 선택만 하고 실제 판매중지는 실행하지 않습니다.', 'color:#c60;font-weight:bold');
  } else {
    console.warn('%c실제 실행 모드입니다. 상품 판매상태가 변경됩니다.', 'color:#c00;font-weight:bold');
  }

  await setPageSize();

  for (let b = 1; b <= CFG.batches; b++) {
    if (state.aborted) { warn('사용자 중단으로 종료합니다.'); break; }
    log(`── 배치 ${b}/${CFG.batches} ──`);

    const ready = await waitFor(() => rowCheckboxes().length > 0, 15000);
    if (!ready) { warn('상품 행을 찾지 못했습니다. 목록이 비었거나 로딩 중일 수 있습니다. 종료합니다.'); break; }

    const { total, checked } = await selectAll();
    log(`선택된 상품: ${checked} / 화면 행 ${total}`);
    if (checked === 0) { warn('선택된 상품이 없습니다. 종료합니다.'); break; }

    if (CFG.dryRun) {
      log('DRY RUN: 여기서 "판매중지" 를 눌렀을 것입니다. 실제 실행은 dryRun:false 로 다시 실행하세요.');
      const preview = findButton(CFG.stopLabels);
      log('찾은 판매중지 버튼:', preview ? `<${preview.tagName}> "${textOf(preview)}"` : '못 찾음 (11st-inspect.js 를 먼저 실행해 주세요)');
      state.batchesDone = b;
      break;
    }

    const stopBtn = findButton(CFG.stopLabels);
    if (!stopBtn) { warn('"판매중지" 버튼을 찾지 못했습니다. 11st-inspect.js 로 버튼 이름을 확인해 주세요. 종료합니다.'); break; }

    const before = gridSignature();
    log('판매중지 클릭:', textOf(stopBtn));
    await clickWithAutoConfirm(stopBtn);

    const refreshed = await waitFor(() => gridSignature() !== before, CFG.waitTimeoutMs);
    if (!refreshed) {
      warn('목록이 갱신되지 않았습니다. 처리 실패 또는 확인 팝업이 남아 있을 수 있습니다. 안전을 위해 종료합니다.');
      break;
    }

    state.processed += checked;
    state.batchesDone = b;
    log(`배치 ${b} 완료. 누적 처리: 약 ${state.processed}개`);
    await sleep(CFG.batchDelayMs);
  }

  console.log('%c=== 종료 ===', 'font-size:14px;font-weight:bold');
  log(`완료한 배치: ${state.batchesDone} / ${CFG.batches}, 누적 처리(추정): 약 ${state.processed}개`);
  if (!CFG.dryRun) log('실제 반영 결과는 목록을 새로고침해서 판매상태로 직접 확인해 주세요.');
})();

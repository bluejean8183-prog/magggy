/**
 * 11번가 셀러오피스 일괄 판매중지 (Playwright over CDP)
 *
 * 이미 로그인해 둔 크롬에 붙어서 조작합니다. 브라우저를 새로 띄우지 않으므로
 * 로그인 세션이 그대로 유지됩니다.
 *
 * 사용:
 *   node bulk-stop.mjs --inspect              화면 구조만 진단 (아무것도 변경 안 함)
 *   node bulk-stop.mjs --dry-run              전체선택까지만, 판매중지는 누르지 않음
 *   node bulk-stop.mjs --batches=1            실제 실행, 1배치(500개)만
 *   node bulk-stop.mjs --batches=10           실제 실행, 10배치(약 5000개)
 *
 * 옵션:
 *   --cdp=http://127.0.0.1:9222   접속할 크롬 디버깅 주소
 *   --tab=2                        여러 탭 중 몇 번째를 쓸지 (진단 출력의 번호)
 *   --page-size=500                한 페이지 상품 수
 *   --delay=3000                   배치 사이 대기(ms)
 *   --no-shot                      스크린샷 저장 안 함
 */

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

/* ── 옵션 파싱 ───────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const CFG = {
  cdp: opt('cdp', 'http://127.0.0.1:9222'),
  tab: opt('tab', null),
  inspect: flag('inspect'),
  dryRun: flag('dry-run'),
  batches: Number(opt('batches', 1)),
  pageSize: Number(opt('page-size', 500)),
  delay: Number(opt('delay', 3000)),
  shots: !flag('no-shot'),
  gridTimeout: 45000,
};

const LOG_DIR = path.join(process.cwd(), 'logs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[11st]', ...a);

/* ── 페이지 안에서 실행되는 함수들 (문자열이 아닌 실제 함수로 전달) ── */

const PAGE_FNS = {
  /** 화면 진단 */
  inspect: () => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const txt = (el) => {
      const t = el.tagName === 'INPUT' ? el.value || '' : el.innerText || el.textContent || '';
      return t.replace(/\s+/g, ' ').trim();
    };
    const BTN = 'button, a, input[type=button], input[type=submit], span[role=button], [class*=btn]';
    return {
      url: location.href,
      selects: [...document.querySelectorAll('select')].filter(vis).map((s) => ({
        name: s.name, id: s.id, value: s.value,
        options: [...s.options].map((o) => `${o.value}=${(o.text || '').trim()}`),
      })),
      headCheckboxes: document.querySelectorAll('thead input[type=checkbox]').length,
      rowCheckboxes: [...document.querySelectorAll('tbody input[type=checkbox]')].filter(vis).length,
      rows: [...document.querySelectorAll('tbody tr')].filter(vis).length,
      buttons: [...document.querySelectorAll(BTN)].filter(vis).map(txt).filter(Boolean).slice(0, 80),
    };
  },

  /** 목록 개수를 target 으로 설정. 반환: 설정된 라벨 또는 null */
  setPageSize: (target) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none';
    };
    const sels = [...document.querySelectorAll('select')].filter(vis);
    const numOf = (o) => {
      const v = (o.value || '').trim();
      if (/^\d+$/.test(v)) return Number(v);
      const m = (o.text || '').match(/(\d+)\s*개/);
      return m ? Number(m[1]) : NaN;
    };
    let best = null, bestScore = 0;
    for (const s of sels) {
      const nums = [...s.options].map(numOf).filter((n) => !isNaN(n));
      if (nums.length < 2 || !nums.every((n) => n >= 5 && n <= 2000)) continue;
      let sc = Math.max(...nums);
      if ([...s.options].some((o) => /개씩|개\s*보기/.test(o.text || ''))) sc += 1000;
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    if (!best) return null;

    const opts = [...best.options];
    const pick =
      opts.find((o) => numOf(o) === target) ||
      opts.slice().sort((a, b) => (numOf(b) || 0) - (numOf(a) || 0))[0];
    if (!pick) return null;

    const label = (pick.text || pick.value || '').trim();
    if (best.value === pick.value) return { label, changed: false };
    best.value = pick.value;
    best.dispatchEvent(new Event('input', { bubbles: true }));
    best.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) { try { window.jQuery(best).trigger('change'); } catch (e) { /* noop */ } }
    return { label, changed: true };
  },

  /** 전체선택. 반환: { total, checked, method } */
  selectAll: () => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none';
    };
    const rowBoxes = () => {
      let b = [...document.querySelectorAll('tbody input[type=checkbox]')].filter(vis).filter((c) => !c.disabled);
      if (!b.length) {
        const heads = [...document.querySelectorAll('thead input[type=checkbox]')];
        b = [...document.querySelectorAll('input[type=checkbox]')]
          .filter(vis).filter((c) => !c.disabled && !heads.includes(c));
      }
      return b;
    };
    const master =
      [...document.querySelectorAll('thead input[type=checkbox]')].filter(vis).filter((c) => !c.disabled)[0] ||
      [...document.querySelectorAll('input[type=checkbox][id*="all" i], input[type=checkbox][name*="all" i]')]
        .filter(vis).filter((c) => !c.disabled)[0];

    let method = 'none';
    if (master) {
      if (master.checked) master.click();
      master.click();
      master.dispatchEvent(new Event('change', { bubbles: true }));
      method = 'master';
    }
    let boxes = rowBoxes();
    let checked = boxes.filter((c) => c.checked).length;
    if (checked === 0 && boxes.length) {
      boxes.forEach((c) => { if (!c.checked) c.click(); });
      boxes = rowBoxes();
      checked = boxes.filter((c) => c.checked).length;
      method = 'per-row';
    }
    return { total: boxes.length, checked, method };
  },

  /** 판매중지 버튼 찾기. 반환: 버튼 텍스트 또는 null. click=true 면 클릭까지 */
  stopButton: ({ labels, click }) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const txt = (el) => {
      const t = el.tagName === 'INPUT' ? el.value || '' : el.innerText || el.textContent || '';
      return t.replace(/\s+/g, ' ').trim();
    };
    const BTN = 'button, a, input[type=button], input[type=submit], span[role=button], [class*=btn]';
    const cands = [...document.querySelectorAll(BTN)].filter(vis).filter((el) => !el.disabled);
    const innermost = (list) => list.filter((el) => !list.some((o) => o !== el && el.contains(o)));

    let hit = innermost(cands.filter((el) => labels.includes(txt(el))))[0];
    if (!hit) {
      hit = innermost(cands.filter((el) => labels.some((l) => txt(el).includes(l)) && txt(el).length <= 20))[0];
    }
    if (!hit) return null;
    const label = txt(hit);
    if (click) hit.click();
    return label;
  },

  /** 팝업 안의 확인 버튼 클릭 시도 */
  popupConfirm: (labels) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const txt = (el) => {
      const t = el.tagName === 'INPUT' ? el.value || '' : el.innerText || el.textContent || '';
      return t.replace(/\s+/g, ' ').trim();
    };
    const POP = '[role=dialog], [class*="popup"], [class*="layer"], [class*="modal"], [id*="popup"], [id*="layer"], [id*="modal"]';
    const BTN = 'button, a, input[type=button], input[type=submit], span[role=button], [class*=btn]';
    const boxes = [...document.querySelectorAll(POP)].filter(vis).filter((c) => c.getBoundingClientRect().height > 40);
    for (const box of boxes) {
      const btns = [...box.querySelectorAll(BTN)].filter(vis).filter((b) => !b.disabled);
      const hit = btns.find((b) => labels.includes(txt(b)));
      if (hit) { hit.click(); return txt(hit); }
    }
    return null;
  },

  /** 목록 갱신 감지용 지문 */
  signature: () => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return (r.width || r.height) && getComputedStyle(el).display !== 'none';
    };
    const rows = [...document.querySelectorAll('tbody tr')].filter(vis);
    const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100) : '');
    return `${rows.length}|${t(rows[0])}|${t(rows[rows.length - 1])}`;
  },
};

/* ── 유틸 ────────────────────────────────────────────────── */

async function pickPage(browser) {
  const pages = browser.contexts().flatMap((c) => c.pages());
  if (!pages.length) throw new Error('열려 있는 탭이 없습니다.');

  console.log('\n열려 있는 탭:');
  for (let i = 0; i < pages.length; i++) {
    console.log(`  [${i}] ${await pages[i].title().catch(() => '?')} — ${pages[i].url()}`);
  }
  console.log('');

  if (CFG.tab !== null) return pages[Number(CFG.tab)];

  const scored = pages
    .map((p) => {
      const u = p.url();
      let s = 0;
      if (/11st\.co\.kr/i.test(u)) s += 10;
      if (/soffice|seller|sell\./i.test(u)) s += 10;
      if (/prd|product|goods|상품/i.test(u)) s += 5;
      return { p, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!scored.length) throw new Error('11번가 셀러오피스 탭을 찾지 못했습니다. --tab=번호 로 직접 지정해 주세요.');
  return scored[0].p;
}

/** 상품 목록이 들어 있는 프레임 찾기 (iframe 대응) */
async function gridFrame(page) {
  for (const f of page.frames()) {
    const n = await f
      .evaluate(() => document.querySelectorAll('tbody input[type=checkbox]').length)
      .catch(() => 0);
    if (n > 0) return f;
  }
  return page.mainFrame();
}

async function shot(page, name) {
  if (!CFG.shots) return;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  log('스크린샷:', file);
}

/* ── 메인 ────────────────────────────────────────────────── */

const STOP_LABELS = ['판매중지', '판매 중지', '판매중지처리', '판매중지하기'];
const CONFIRM_LABELS = ['확인', '예', 'OK', '적용', '저장'];

async function main() {
  log('크롬에 연결 중:', CFG.cdp);
  const browser = await chromium.connectOverCDP(CFG.cdp).catch((e) => {
    console.error(
      '\n크롬에 연결하지 못했습니다.\n' +
      'start-chrome.bat 을 먼저 실행해서 브라우저를 띄우고 11번가에 로그인했는지 확인해 주세요.\n' +
      `원인: ${e.message}\n`
    );
    process.exit(1);
  });

  const page = await pickPage(browser);
  log('대상 탭:', page.url());

  // 네이티브 confirm/alert 자동 승인
  page.on('dialog', async (d) => {
    log(`  ${d.type()} 자동 확인: ${d.message().slice(0, 120)}`);
    await d.accept().catch(() => {});
  });

  const frame = await gridFrame(page);
  if (frame !== page.mainFrame()) log('상품 목록 프레임:', frame.url());

  /* 진단 모드 */
  if (CFG.inspect) {
    const info = await frame.evaluate(PAGE_FNS.inspect);
    console.log('\n=== 화면 진단 ===');
    console.log('URL           :', info.url);
    console.log('행 수         :', info.rows);
    console.log('thead 체크박스:', info.headCheckboxes);
    console.log('행 체크박스   :', info.rowCheckboxes);
    console.log('\n-- select 목록 --');
    for (const s of info.selects) {
      console.log(`  name=${s.name} id=${s.id} value=${s.value}`);
      console.log(`    옵션: ${s.options.join(' | ')}`);
    }
    console.log('\n-- 버튼 텍스트 --');
    console.log('  ' + info.buttons.join(' / '));
    await shot(page, 'inspect');
    await browser.close();
    return;
  }

  console.log('');
  log(`설정: dryRun=${CFG.dryRun} batches=${CFG.batches} pageSize=${CFG.pageSize}`);
  if (CFG.dryRun) log('*** DRY RUN — 판매중지는 누르지 않습니다 ***');
  else log('*** 실제 실행 — 상품 판매상태가 변경됩니다 ***');
  console.log('');

  /* 목록 개수 설정 */
  const ps = await frame.evaluate(PAGE_FNS.setPageSize, CFG.pageSize);
  if (!ps) log('경고: 목록 개수 select 를 찾지 못했습니다. 현재 설정 그대로 진행합니다.');
  else {
    log(`목록 개수: ${ps.label}${ps.changed ? ' (변경함)' : ' (이미 설정됨)'}`);
    if (ps.changed) await sleep(CFG.delay);
  }

  let processed = 0;
  let done = 0;

  for (let b = 1; b <= CFG.batches; b++) {
    console.log('');
    log(`── 배치 ${b}/${CFG.batches} ──`);

    const f = await gridFrame(page);

    const sel = await f.evaluate(PAGE_FNS.selectAll);
    log(`선택: ${sel.checked}개 / 화면 행 ${sel.total}개 (방식: ${sel.method})`);
    if (sel.checked === 0) { log('선택된 상품이 없습니다. 종료합니다.'); break; }

    const btnLabel = await f.evaluate(PAGE_FNS.stopButton, { labels: STOP_LABELS, click: false });
    if (!btnLabel) {
      log('판매중지 버튼을 찾지 못했습니다. --inspect 로 버튼 이름을 확인해 주세요. 종료합니다.');
      await shot(page, `batch-${b}-no-button`);
      break;
    }
    log(`판매중지 버튼: "${btnLabel}"`);

    if (CFG.dryRun) {
      log('DRY RUN 이므로 여기서 멈춥니다. 실제 실행은 --batches=1 로 다시 실행하세요.');
      await shot(page, 'dry-run');
      break;
    }

    const before = await f.evaluate(PAGE_FNS.signature);
    await f.evaluate(PAGE_FNS.stopButton, { labels: STOP_LABELS, click: true });

    // 레이어 팝업 확인 버튼 처리 (네이티브 dialog 는 위 핸들러가 처리)
    for (let i = 0; i < 8; i++) {
      await sleep(800);
      const cf = await gridFrame(page).then((ff) => ff.evaluate(PAGE_FNS.popupConfirm, CONFIRM_LABELS)).catch(() => null);
      const cf2 = cf || await page.mainFrame().evaluate(PAGE_FNS.popupConfirm, CONFIRM_LABELS).catch(() => null);
      if (!cf2) break;
      log(`  팝업 확인: "${cf2}"`);
    }

    // 목록 갱신 대기
    const deadline = Date.now() + CFG.gridTimeout;
    let refreshed = false;
    while (Date.now() < deadline) {
      await sleep(700);
      const ff = await gridFrame(page);
      const now = await ff.evaluate(PAGE_FNS.signature).catch(() => before);
      if (now !== before) { refreshed = true; break; }
    }

    await shot(page, `batch-${b}`);

    if (!refreshed) {
      log('목록이 갱신되지 않았습니다. 처리 실패 가능성이 있어 안전하게 종료합니다.');
      break;
    }

    processed += sel.checked;
    done = b;
    log(`배치 ${b} 완료. 누적 약 ${processed}개`);
    await sleep(CFG.delay);
  }

  console.log('');
  log(`종료. 완료 배치 ${done}/${CFG.batches}, 누적 처리(추정) 약 ${processed}개`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });

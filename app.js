(function () {
  const C = window.COURSE;
  const LS_DONE = 'luatsu-ai-progress-v2';   // bài đã học
  const LS_TASK = 'luatsu-ai-tasks-v2';      // checklist đã tick
  const LS_COLL = 'luatsu-ai-collapse-v2';   // nhóm đang gập

  // Phẳng hoá danh sách trang theo thứ tự + gắn group
  const flat = [];
  C.groups.forEach(g => g.pages.forEach(p => flat.push({ ...p, group: g })));
  const trackable = flat.filter(p => p.track);

  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  let done = load(LS_DONE);
  let tasks = load(LS_TASK);
  let collapsed = load(LS_COLL);
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---- Dựng sidebar ----
  const nav = document.getElementById('nav');
  function buildNav() {
    nav.innerHTML = '';
    C.groups.forEach(g => {
      const grp = document.createElement('div');
      grp.className = 'grp' + (g.placeholder ? ' soonGrp' : '') + (collapsed[g.id] ? ' collapsed' : '');
      grp.dataset.gid = g.id;
      const nTrack = g.pages.filter(p => p.track).length;
      const countTxt = nTrack ? `${nTrack} bài` : (g.placeholder ? 'sắp có' : '');
      const head = document.createElement('div');
      head.className = 'glabel';
      head.innerHTML = `<span class="chev"></span>` +
        `<span class="gname">${g.label}</span>` + (countTxt ? `<span class="count">${countTxt}</span>` : '');
      head.addEventListener('click', () => {
        grp.classList.toggle('collapsed');
        collapsed[g.id] = grp.classList.contains('collapsed');
        save(LS_COLL, collapsed);
      });
      grp.appendChild(head);

      const pagesWrap = document.createElement('div');
      pagesWrap.className = 'pages';
      g.pages.forEach(p => {
        const a = document.createElement('a');
        a.className = 'navlink' + (p.soon ? ' soon' : '');
        a.dataset.id = p.id;
        a.innerHTML = `<span class="dot"></span><span class="t">${p.title}</span>` +
          (p.soon ? `<span class="lk">soạn</span>` : '');
        a.addEventListener('click', e => { e.preventDefault(); go(p.id); closeDrawer(); });
        pagesWrap.appendChild(a);
      });
      grp.appendChild(pagesWrap);
      nav.appendChild(grp);
    });
  }

  // ---- Hiển thị 1 trang ----
  const contentEl = document.getElementById('content');
  const topTitle = document.getElementById('topTitle');
  const topProg = document.getElementById('topProg');

  function go(id, push) {
    const idx = flat.findIndex(p => p.id === id);
    if (idx < 0) return;
    const p = flat[idx];

    const next = flat[idx + 1];
    let bar = '<div class="markbar">';
    if (p.track) {
      const on = !!done[p.id];
      bar += `<button class="markbtn ${on ? 'on' : ''}" id="markBtn">${labelText(on)}</button>`;
    } else { bar += '<span></span>'; }
    if (next) bar += `<a class="nextbtn" id="nextBtn" href="#${next.id}">` +
      `<span class="nb-lead">Bài tiếp</span><span class="nb-arrow">→</span><span class="nb-title">${escAttr(next.title)}</span></a>`;
    bar += '</div>';

    contentEl.innerHTML = `<div class="content-wrap">${p.html}${bar}</div>`;
    window.scrollTo(0, 0);
    topTitle.textContent = p.title;

    // mở nhóm chứa trang đang xem
    const gEl = nav.querySelector(`.grp[data-gid="${p.group.id}"]`);
    if (gEl && gEl.classList.contains('collapsed')) {
      gEl.classList.remove('collapsed'); collapsed[p.group.id] = false; save(LS_COLL, collapsed);
    }
    document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('active', a.dataset.id === id));

    // nút đánh dấu đã học
    const mb = document.getElementById('markBtn');
    if (mb) mb.addEventListener('click', () => {
      done[p.id] = !done[p.id]; save(LS_DONE, done);
      mb.classList.toggle('on', done[p.id]); mb.innerHTML = labelText(done[p.id]);
      refreshProgress(); updateTopProg(p);
    });
    // nút bài tiếp
    const nb = document.getElementById('nextBtn');
    if (nb) nb.addEventListener('click', e => { e.preventDefault(); go(next.id, true); });

    // checklist tick được + nhớ máy
    contentEl.querySelectorAll('li.task').forEach(li => {
      const key = p.id + ':' + li.dataset.i;
      if (tasks[key]) li.classList.add('done'); else li.classList.remove('done');
      li.addEventListener('click', () => {
        const now = !li.classList.contains('done');
        li.classList.toggle('done', now);
        tasks[key] = now; save(LS_TASK, tasks);
      });
    });

    // nút Copy cho mỗi ô câu lệnh
    contentEl.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code'); if (!code) return;
      const btn = document.createElement('button');
      btn.className = 'copybtn'; btn.type = 'button'; btn.textContent = 'Copy';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const t = code.innerText;
        try { await navigator.clipboard.writeText(t); }
        catch (_) {
          const ta = document.createElement('textarea'); ta.value = t;
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (__) {}
          ta.remove();
        }
        btn.textContent = 'Đã copy'; btn.classList.add('done');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1500);
      });
      pre.appendChild(btn);
    });

    if (push !== false) location.hash = id;
    refreshProgress(); updateTopProg(p);
  }

  function labelText(on) { return on ? 'Đã học xong bài này' : 'Đánh dấu đã học'; }
  function escAttr(s) { return s.replace(/"/g, '&quot;'); }

  // ---- Tiến độ tổng (sidebar) ----
  function refreshProgress() {
    document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('done', !!done[a.dataset.id]));
    const total = trackable.length;
    const d = trackable.filter(p => done[p.id]).length;
    const pct = total ? Math.round(d / total * 100) : 0;
    document.getElementById('bar').style.width = pct + '%';
    document.getElementById('ptxt').textContent = `Đã học ${d}/${total} bài · ${pct}%`;
  }

  // ---- Tiến trình buổi (topbar) ----
  function updateTopProg(p) {
    const g = p.group;
    const pagesInGroup = g.pages;
    const pos = pagesInGroup.findIndex(x => x.id === p.id) + 1;
    const trackInG = pagesInGroup.filter(x => x.track);
    if (trackInG.length === 0) {
      topProg.innerHTML = `<span class="tp-label">${g.label}</span>`;
      return;
    }
    const dG = trackInG.filter(x => done[x.id]).length;
    const pct = Math.round(dG / trackInG.length * 100);
    topProg.innerHTML =
      `<span class="tp-label"><b>${shortName(g.label)}</b> · Bài ${pos}/${pagesInGroup.length}</span>` +
      `<span class="tp-bar"><i style="width:${pct}%"></i></span>`;
  }
  function shortName(label) {
    const m = /^(Buổi\s*\d+)/i.exec(label);
    return m ? m[1] : label;
  }

  // ---- Drawer mobile ----
  const app = document.getElementById('app');
  function closeDrawer() { app.classList.remove('open'); }
  document.getElementById('menuBtn').addEventListener('click', () => app.classList.toggle('open'));
  document.getElementById('backdrop').addEventListener('click', closeDrawer);

  // ---- Khởi động ----
  buildNav();
  const start = location.hash.replace('#', '');
  go(flat.some(p => p.id === start) ? start : flat[0].id, false);
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id && flat.some(p => p.id === id)) go(id, false);
  });
})();

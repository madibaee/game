// Grey-box UI: 20 circles, three HUD strips, a plan builder and a settlement report (§12 stage 2).
(function () {
  'use strict';
  const E = window.Engine, C = window.CONFIG, B = window.Bots;
  const H = 0; // the human seat
  const KEY = 'greybox-v04-save';
  const AB = { timber: 'Ti', brick: 'Br', iron: 'Ir', food: 'Fo', tools: 'To', goods: 'Cg' };
  const NAME = { timber: 'Timber', brick: 'Brick', iron: 'Iron', food: 'Food', tools: 'Tools', goods: 'Consumer goods' };
  const PCOL = ['#2563eb', '#c2410c', '#7c3aed', '#0f766e'];
  const BADGE = ['●', '■', '▲', '◆'];
  const TINT = { forest: '#cddccd', clay: '#e6d3c6', mountain: '#cdd2de', farm: '#e8e3bd' };
  const DAB = { residential: 'Res', commercial: 'Com', industrial: 'Ind' };
  const ROM = ['', 'I', 'II', 'III'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let S = null, plan = E.emptyPlan(), pv = null, report = null;
  let ui = { n: 3, bid: 0, basket: null, inv: null, node: null };
  let drag = null, toastTimer = null;

  // ---------- Persistence ----------
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, plan, report })); } catch (e) { /* storage may be unavailable */ } }
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.S && d.S.nodes) return d; } catch (e) { /* ignore */ } return null; }

  // ---------- Text helpers ----------
  const goodsList = (o) => E.GOODS.filter((g) => o && o[g] > 0).map((g) => o[g] + ' ' + NAME[g].toLowerCase()).join(', ') || 'nothing';
  const pname = (pi) => (pi === H ? 'You' : S.players[pi].name);
  const badge = (pi) => '<span style="color:' + PCOL[pi] + '">' + BADGE[pi] + '</span>';
  function bName(b) { return b.type === 'raw' ? NAME[b.good] + ' works' : b.type === 'tools' ? 'Tool works' : 'Goods works'; }
  function nodeName(nd) {
    if (nd.kind === 'core') return 'the market';
    if (nd.kind === 'plot') return nd.district ? 'the ' + nd.district.type + ' district' : 'a district plot';
    return nd.building ? (nd.building.owner === H ? 'your ' : S.players[nd.building.owner].name + "'s ") + bName(nd.building).toLowerCase() : 'the empty ' + nd.terrain + ' site';
  }
  function describe(a) {
    if (a.type === 'build') { const nd = S.nodes[a.site]; return 'Build ' + (a.kind === 'raw' ? AB[C.terrain[nd.terrain]] + ' works' : a.kind === 'tools' ? 'tool works' : 'goods works') + (a.bid ? ' (bid ' + a.bid + ')' : ''); }
    if (a.type === 'upgrade') { const b = S.nodes[a.site].building; return 'Upgrade ' + AB[E.outputOf(b)] + ' works to ' + ROM[b.tier + 1]; }
    if (a.type === 'link') { const e = S.edges[a.edge]; return 'Link ' + shortName(S.nodes[e.a]) + ' to ' + shortName(S.nodes[e.b]) + (a.bid ? ' (bid ' + a.bid + ')' : ''); }
    if (a.type === 'trade') {
      const s = E.GOODS.filter((g) => a.sell[g] > 0).map((g) => a.sell[g] + AB[g]).join(' ');
      const b = E.GOODS.filter((g) => a.buy[g] > 0).map((g) => a.buy[g] + AB[g]).join(' ');
      return 'Trade' + (s ? ' sell ' + s : '') + (b ? ' buy ' + b : '') + (a.import ? ' (rail)' : '');
    }
    if (a.type === 'invest') { const pr = S.queue.find((q) => q.plot === a.plot); return 'Invest ' + E.GOODS.filter((g) => a.goods[g] > 0).map((g) => a.goods[g] + AB[g]).join(' ') + ' in ' + (pr ? DAB[pr.type] : 'project'); }
    if (a.type === 'bond') return a.op === 'take' ? 'Take a bond +' + C.bond.amount : 'Repay a bond';
    return a.type;
  }
  function shortName(nd) {
    if (nd.kind === 'core') return 'market';
    if (nd.kind === 'plot') return nd.district ? DAB[nd.district.type] : 'plot';
    return nd.building ? AB[E.outputOf(nd.building)] + ' works' : nd.terrain;
  }
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }
  const myLinkSet = () => new Set(plan.actions.filter((a) => a.type === 'link').map((a) => a.edge));
  function routeText(from, dest) {
    const r = E.findPath(S, H, from, dest, { allowFree: true, extra: myLinkSet() });
    if (!r) return 'No candidate path.';
    if (r.missing) return 'Not linked yet: ' + r.missing + ' link' + (r.missing > 1 ? 's' : '') + ' missing on the shortest path.';
    if (r.tolls) return 'Linked. Shipping crosses ' + r.tolls + ' rival link' + (r.tolls > 1 ? 's' : '') + ': ' + r.tolls * C.toll + ' coin in tolls each round you ship.';
    return 'Linked, no tolls.';
  }

  // ---------- Rendering ----------
  function render() {
    if (!S) { $('app').hidden = true; $('setup').hidden = false; renderSetup(); return; }
    $('setup').hidden = true; $('app').hidden = false;
    pv = E.preview(S, H, plan);
    renderStatus(); renderCity(); renderBoard(); renderMarket(); renderBottom();
  }

  function renderStatus() {
    const p = S.players[H];
    const used = plan.actions.length;
    const sc = E.score(S);
    const round = Math.min(S.round, C.rounds);
    $('status').innerHTML =
      '<span style="white-space:nowrap">Round <b>' + round + '</b>/' + C.rounds + '</span>' +
      '<span class="pips" title="actions left">' + '●'.repeat(Math.max(0, C.actionsPerRound - used)) + '○'.repeat(Math.min(used, C.actionsPerRound)) + '</span>' +
      '<span class="grow"></span>' +
      '<button class="chip" onclick="UI.bond()">¢<b>' + p.coins + '</b>' + (pv.coins !== p.coins ? '<small>→' + pv.coins + '</small>' : '') + (pv.bonds ? ' <small>· ' + pv.bonds + ' bond' + (pv.bonds > 1 ? 's' : '') + '</small>' : '') + '</button>' +
      '<button class="chip" onclick="UI.scores()">' + sc.map((r) => badge(r.pi) + r.total).join(' ') + '</button>' +
      '<button class="chip" onclick="UI.menu()">☰</button>';
  }

  function renderCity() {
    const vis = E.visibleProjects(S);
    let h = '';
    for (let i = 0; i < C.visibleProjects; i++) {
      const pr = vis[i];
      if (!pr) { h += '<div class="proj none">no project</div>'; continue; }
      const needs = E.GOODS.filter((g) => pr.need[g]).map((g) => AB[g] + ' ' + (pr.got[g] || 0) + '/' + pr.need[g]).join(' · ');
      h += '<button class="proj" onclick="UI.node(' + pr.plot + ')"><div class="t">' + '①②'[i] + ' ' + pr.type[0].toUpperCase() + pr.type.slice(1) + '</div><div class="n">' + needs + '</div></button>';
    }
    const left = Math.max(0, C.rounds - S.round + 1);
    h += '<div class="elect"><b>' + left + '</b>' + (left === 1 ? 'round' : 'rounds') + ' to vote<br>fund ¢' + S.fund + '</div>';
    $('city').innerHTML = h;
  }

  function tx(x, y, s, size, fill, weight) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + (fill || '#222') + '" font-weight="' + (weight || 400) + '" text-anchor="middle" dominant-baseline="central">' + s + '</text>';
  }
  function renderBoard() {
    const R = C.map.nodeR;
    const mine = myLinkSet();
    let h = '';
    S.edges.forEach((e, i) => {
      const a = S.nodes[e.a], b = S.nodes[e.b];
      const ln = 'x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"';
      if (e.owner !== null) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        h += '<line ' + ln + ' stroke="' + PCOL[e.owner] + '" stroke-width="5" stroke-linecap="round"/>' +
          '<circle cx="' + mx + '" cy="' + my + '" r="7" fill="#f1f1f1"/>' + tx(mx, my, BADGE[e.owner], 10, PCOL[e.owner]);
      } else if (mine.has(i)) h += '<line ' + ln + ' stroke="' + PCOL[H] + '" stroke-width="5" stroke-dasharray="7 5"/>';
      else h += '<line ' + ln + ' stroke="#b4b4b4" stroke-width="2" stroke-dasharray="3 5"/>';
    });
    const vis = E.visibleProjects(S);
    S.nodes.forEach((nd) => {
      const x = nd.x, y = nd.y;
      let g = '';
      if (nd.kind === 'core') {
        g = '<rect x="' + (x - R) + '" y="' + (y - R) + '" width="' + 2 * R + '" height="' + 2 * R + '" rx="9" fill="#3a3a3a"/>' + tx(x, y - 5, 'MARKET', 10, '#fff', 700) + tx(x, y + 9, 'core', 9, '#ccc');
      } else if (nd.kind === 'plot') {
        const d = nd.district;
        const vi = vis.findIndex((p) => p.plot === nd.id);
        if (d) {
          g = '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="' + (d.served ? '#f2e2ac' : '#c9c9c9') + '" stroke="#555" stroke-width="2"/>' +
            tx(x, y - 6, DAB[d.type], 12, '#222', 700) + tx(x, y + 7, ROM[d.cls], 11, '#222');
          for (let k = 0; k < C.pipsPerClass; k++) g += '<circle cx="' + (x - 8 + k * 8) + '" cy="' + (y + 19) + '" r="2.6" fill="' + (d.cls >= 3 || k < d.pips ? '#333' : 'none') + '" stroke="#333" stroke-width="1"/>';
          const holders = d.shares.map((s, pi) => (s > 0 ? '<tspan fill="' + PCOL[pi] + '">' + BADGE[pi] + '</tspan>' : '')).join('');
          if (holders) g += tx(x, y - 19, holders, 9);
        } else if (vi >= 0) {
          const pr = vis[vi];
          const need = E.GOODS.reduce((s, k) => s + (pr.need[k] || 0), 0), got = E.GOODS.reduce((s, k) => s + (pr.got[k] || 0), 0);
          g = '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="#fff" stroke="#444" stroke-width="2" stroke-dasharray="5 4"/>' +
            tx(x, y - 7, '①②'[vi] + ' ' + DAB[pr.type], 12, '#222', 700) + tx(x, y + 9, got + '/' + need, 11, '#444');
        } else {
          g = '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="#ececec" stroke="#aaa" stroke-width="1.5" stroke-dasharray="3 4"/>' + tx(x, y, 'plot', 10, '#999');
        }
        if (plan.actions.some((a) => a.type === 'invest' && a.plot === nd.id)) g += '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 4) + '" fill="none" stroke="' + PCOL[H] + '" stroke-width="2.5" stroke-dasharray="7 5"/>';
      } else {
        const b = nd.building;
        if (b) {
          const running = b.st === 'run';
          const dashed = b.st === 'new' ? '2 4' : running ? '' : '9 6';
          g = '<circle cx="' + x + '" cy="' + y + '" r="' + (R - 2.5) + '" fill="#fff" stroke="' + PCOL[b.owner] + '" stroke-width="5"' + (dashed ? ' stroke-dasharray="' + dashed + '"' : '') + '/>';
          if (b.type !== 'raw') g += tx(x, y - 15, 'shop', 8, '#555');
          g += tx(x, y - 3, AB[E.outputOf(b)], 15, '#111', 700) + tx(x, y + 12, ROM[b.tier], 11, '#111');
          if (!running) g += tx(x - 14, y - 3, b.st === 'new' ? '…' : '‖', 12, '#b91c1c', 700);
          g += '<circle cx="' + (x + 20) + '" cy="' + (y - 20) + '" r="8" fill="#f1f1f1"/>' + tx(x + 20, y - 20, BADGE[b.owner], 12, PCOL[b.owner]);
          if (plan.actions.some((a) => a.type === 'upgrade' && a.site === nd.id)) g += '<circle cx="' + (x + 20) + '" cy="' + (y + 20) + '" r="8" fill="' + PCOL[H] + '"/>' + tx(x + 20, y + 20, '↑', 12, '#fff', 700);
          if ((plan.idle || []).includes(nd.id)) g += tx(x - 14, y - 3, '‖', 12, '#b91c1c', 700);
        } else {
          g = '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="' + TINT[nd.terrain] + '" stroke="#999" stroke-width="1.5"/>' +
            tx(x, y - 5, AB[C.terrain[nd.terrain]], 14, '#444', 600) + tx(x, y + 10, nd.terrain, 8.5, '#555');
          if (plan.actions.some((a) => a.type === 'build' && a.site === nd.id)) g += '<circle cx="' + x + '" cy="' + y + '" r="' + (R - 2.5) + '" fill="none" stroke="' + PCOL[H] + '" stroke-width="5" stroke-dasharray="7 5"/>';
        }
      }
      h += '<g data-node="' + nd.id + '">' + g + '</g>';
    });
    h += '<line id="rubber" visibility="hidden" stroke="' + PCOL[H] + '" stroke-width="5" stroke-dasharray="7 5" stroke-linecap="round"/>';
    $('board').innerHTML = h;
  }

  function renderMarket() {
    const dem = E.cityDemand(S);
    const tr = plan.actions.find((a) => a.type === 'trade');
    $('market').innerHTML = E.GOODS.map((g) => {
      const n = S.stalls[g];
      let bar = '';
      for (let i = 0; i < C.stallSlots; i++) bar += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      const mineTxt = tr && tr.sell[g] ? 'sell ' + tr.sell[g] : tr && tr.buy[g] ? 'buy ' + tr.buy[g] : 'city ' + dem[g];
      return '<button class="stall' + (tr && (tr.sell[g] || tr.buy[g]) ? ' planned' : '') + '" onclick="UI.trade()"><div class="g">' + AB[g] + '</div><div class="p">' + E.price(g, n) + '</div><div class="bar">' + bar + '</div><div class="d">' + mineTxt + '</div></button>';
    }).join('');
  }

  function renderBottom() {
    let h = '<div class="store">' + E.GOODS.map((g) => '<span class="' + (pv.goods[g] ? '' : 'z') + '">' + AB[g] + ' <b>' + pv.goods[g] + '</b></span>').join('') +
      '<span class="cap' + (pv.overflow ? ' warn' : '') + '">' + pv.storage + '/' + C.storageCap + '</span></div><div class="planrow">';
    for (let i = 0; i < C.actionsPerRound; i++) {
      const x = pv.actions[i];
      if (x) h += '<button class="slot full' + (x.err ? ' bad' : '') + '" onclick="UI.removeAction(' + i + ')">' + esc(describe(x.a)) + (x.err ? '<br>' + esc(x.err) : x.tolls ? '<br>toll ' + x.tolls * C.toll : '') + ' ✕</button>';
      else h += '<button class="slot" onclick="UI.hint()">action ' + (i + 1) + '</button>';
    }
    h += '<button class="lock" ' + (pv.ok && !S.over ? '' : 'disabled') + ' onclick="UI.lock()">' + (S.over ? 'Over' : 'Lock plan') + '</button></div>';
    $('bottom').innerHTML = h;
  }

  // ---------- Sheets ----------
  function sheet(html) {
    $('sheetbody').innerHTML = '<button class="close" onclick="UI.close()">✕</button>' + html;
    $('sheet').hidden = false; $('scrim').hidden = false;
  }
  function closeSheet() { $('sheet').hidden = true; $('scrim').hidden = true; ui.node = null; }
  const act = (label, sub, onclick, disabled, cls) => '<button class="act ' + (cls || '') + '" ' + (disabled ? 'disabled' : '') + ' onclick="' + onclick + '"><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</button>';

  function addAction(a, replaceType) {
    const old = plan.actions.slice();
    let idx = replaceType ? plan.actions.findIndex(replaceType) : -1;
    if (idx >= 0) plan.actions[idx] = a; else { plan.actions.push(a); idx = plan.actions.length - 1; }
    const v = E.preview(S, H, plan);
    const bad = v.actions[idx].err || (v.actions.find((x) => x.err) || {}).err;
    if (bad) { plan.actions = old; toast(bad); return false; }
    closeSheet(); save(); render(); return true;
  }

  function linksSection(id) {
    const mine = myLinkSet();
    let h = '<h3>Links from here</h3>';
    S.edges.forEach((e, i) => {
      if (e.a !== id && e.b !== id) return;
      const other = S.nodes[e.a === id ? e.b : e.a];
      if (e.owner !== null) h += '<p class="muted">' + badge(e.owner) + ' To ' + nodeName(other) + ': built by ' + pname(e.owner) + (e.owner === H ? '' : ', toll ' + C.toll) + '</p>';
      else if (mine.has(i)) h += '<p class="muted">To ' + nodeName(other) + ': in your plan</p>';
      else h += act('Lay a link to ' + nodeName(other), C.cost.link + ' coins. You can also drag from one circle to the other.', 'UI.link(' + i + ')');
    });
    return h;
  }
  function bidRow() {
    return '<div class="row"><div class="grow">Sealed bid if a rival claims the same spot<br><span class="muted">Paid to the city fund only if you win a contest.</span></div><div class="step"><button onclick="UI.bidStep(-1)">−</button><div class="q">' + ui.bid + '</div><button onclick="UI.bidStep(1)">+</button></div></div>';
  }

  function nodeSheet(id) {
    ui.node = id;
    const nd = S.nodes[id];
    const myNodes = E.ownBuildings(S, H).map((x) => x.id);
    let h = '';
    if (nd.kind === 'core') {
      h = '<h2>City core and market</h2><p>The core buys ' + goodsList(C.coreDemand) + ' every round. Goods must reach it over links to be sold.</p>' + act('Open the trade basket', 'One basket of buy and sell orders per round', 'UI.trade()', false, 'primary');
    } else if (nd.kind === 'plot' && nd.district) {
      const d = nd.district;
      const dem = E.districtDemand(d);
      const holders = d.shares.map((s, pi) => (s ? badge(pi) + ' ' + pname(pi) + ' ' + s : '')).filter(Boolean).join(' · ');
      h = '<h2>' + d.type[0].toUpperCase() + d.type.slice(1) + ' district, class ' + ROM[d.cls] + '</h2>' +
        '<p>Buys each round: ' + goodsList(dem) + '. ' + (d.founded >= S.round ? 'Demand starts this round.' : d.served ? 'Fully served last round.' : 'Went unserved last round.') + '</p>' +
        '<p>Pips: ' + (d.cls >= 3 ? 'top class' : d.pips + ' of ' + C.pipsPerClass + ' towards class ' + ROM[d.cls + 1]) + '. Each share is worth ' + C.votes.share[d.cls - 1] + ' vote' + (d.cls > 1 ? 's' : '') + ' now and pays ' + C.dividendPerShare + ' coin in every served round.</p>' +
        (C.declineAfter && d.cls > 1 ? '<p class="muted">' + (d.miss ? 'Unserved ' + d.miss + ' round' + (d.miss > 1 ? 's' : '') + ' running. ' : '') + C.declineAfter + ' unserved rounds in a row and it falls back a class.</p>' : '') +
        '<p>Shares: ' + (holders || 'all held by the city') + '</p>';
    } else if (nd.kind === 'plot') {
      const pr = E.visibleProjects(S).find((q) => q.plot === id);
      if (!pr) h = '<h2>Reserved district plot</h2><p class="muted">A later neighbourhood project will be founded here. Players cannot build on it.</p>';
      else {
        const basePlan = { actions: plan.actions.filter((a) => !(a.type === 'invest' && a.plot === id)), idle: plan.idle };
        const base = E.preview(S, H, basePlan);
        if (!ui.inv) { const ex = plan.actions.find((a) => a.type === 'invest' && a.plot === id); ui.inv = ex ? { ...ex.goods } : {}; }
        h = '<h2>Project: ' + pr.type + ' district</h2><p>Founded when every good has arrived. Each raw unit you send earns ' + C.sharesPerUnit.raw + ' share, each processed unit ' + C.sharesPerUnit.processed + '.</p><p class="muted">' + routeText(myNodes, id) + '</p>';
        let shares = 0;
        E.GOODS.filter((g) => pr.need[g]).forEach((g) => {
          const miss = Math.max(0, E.missing(pr, g));
          const max = Math.min(miss, base.goods[g]);
          const q = Math.min(ui.inv[g] || 0, max);
          ui.inv[g] = q; shares += q * (E.isRaw(g) ? C.sharesPerUnit.raw : C.sharesPerUnit.processed);
          h += '<div class="row"><div class="grow"><b>' + NAME[g] + '</b> ' + (pr.got[g] || 0) + '/' + pr.need[g] + '<br><span class="muted">you have ' + base.goods[g] + '</span></div><div class="step"><button onclick="UI.invStep(\'' + g + '\',-1)">−</button><div class="q">' + q + '</div><button onclick="UI.invStep(\'' + g + '\',1)" ' + (q >= max ? 'disabled' : '') + '>+</button></div></div>';
        });
        const holders = pr.shares.map((s, pi) => (s ? badge(pi) + ' ' + pname(pi) + ' ' + s : '')).filter(Boolean).join(' · ');
        h += '<p class="muted">Shares so far: ' + (holders || 'none') + (pr.city ? ' · city supplied ' + pr.city : '') + '</p>' +
          act('Put this investment in the plan', shares ? 'Up to ' + shares + ' share' + (shares > 1 ? 's' : '') + ' if it is all accepted' : 'Choose some goods first', 'UI.invest(' + id + ')', !shares, 'primary');
      }
    } else if (nd.building) {
      const b = nd.building;
      const own = b.owner === H;
      const out = b.type === 'raw' ? 'Makes ' + C.rawOutput[b.tier - 1] + ' ' + b.good + ' a round.' : (() => { const rc = C.recipes[b.type]; return 'Turns ' + goodsList(rc.in) + ' into ' + rc.qty + ' ' + NAME[rc.out].toLowerCase() + ', up to ' + C.recipeRuns[b.tier - 1] + ' time' + (b.tier > 1 ? 's' : '') + ' a round, from goods held at the start of the round.'; })();
      const stTxt = { run: 'Ran last round.', new: 'Under construction; it produces from next round.', idle: 'Idled last round.', starved: 'Starved last round: no inputs.', unpaid: 'Idle last round: no coin for upkeep.' }[b.st] || '';
      h = '<h2>' + badge(b.owner) + ' ' + (own ? 'Your ' : esc(S.players[b.owner].name) + "'s ") + bName(b).toLowerCase() + ', tier ' + ROM[b.tier] + '</h2><p>' + out + ' ' + stTxt + '</p>';
      if (own) {
        const f = pv.production.find((x) => x.site === id);
        const idle = (plan.idle || []).includes(id);
        h += '<p class="muted">This round: ' + (f.status === 'run' ? 'makes ' + goodsList(f.made) + ', upkeep ' + E.upkeepOf(b) : f.status) + '. ' + routeText([id], 0) + '</p>';
        const up = C.cost.upgrade[b.tier];
        if (up) h += act('Upgrade to tier ' + ROM[b.tier + 1], up.coins + ' coins + ' + up.brick + ' brick', 'UI.upgrade(' + id + ')', plan.actions.some((a) => a.type === 'upgrade' && a.site === id));
        if (b.built < S.round) h += act(idle ? 'Run it this round' : 'Idle it this round', idle ? 'Pays upkeep and produces' : 'Saves ' + E.upkeepOf(b) + ' coin of upkeep and keeps its inputs. Costs no action.', 'UI.idle(' + id + ')');
      }
    } else {
      const g = C.terrain[nd.terrain];
      const count = E.ownBuildings(S, H).length + plan.actions.filter((a) => a.type === 'build').length;
      const cap = E.buildingCap(S);
      const planned = plan.actions.some((a) => a.type === 'build' && a.site === id);
      h = '<h2>Empty ' + nd.terrain + ' site</h2><p>' + NAME[g] + ' works here make ' + C.rawOutput.join(' / ') + ' ' + g + ' a round by tier. You have ' + count + ' of ' + cap + ' buildings.</p><p class="muted">' + routeText([id], 0) + '</p>';
      if (planned) h += '<p><b>Already in your plan.</b> Tap the action at the bottom of the screen to remove it.</p>';
      else {
        const full = count >= cap;
        h += act('Build ' + NAME[g].toLowerCase() + ' works', C.cost.raw.coins + ' coins + ' + C.cost.raw.brick + ' brick', "UI.build(" + id + ",'raw')", full);
        Object.keys(C.recipes).forEach((k) => {
          const rc = C.recipes[k];
          h += act('Build ' + (k === 'tools' ? 'tool' : 'goods') + ' works', C.cost.workshop.coins + ' coins + ' + C.cost.workshop.brick + ' brick. Turns ' + goodsList(rc.in) + ' into ' + rc.qty + ' ' + NAME[rc.out].toLowerCase(), "UI.build(" + id + ",'" + k + "')", full);
        });
        h += bidRow();
      }
    }
    sheet(h + linksSection(id));
  }

  function tradeSheet() {
    const basePlan = { actions: plan.actions.filter((a) => a.type !== 'trade'), idle: plan.idle };
    const base = E.preview(S, H, basePlan);
    if (!ui.basket) {
      ui.basket = E.zero();
      const ex = plan.actions.find((a) => a.type === 'trade');
      if (ex) E.GOODS.forEach((g) => { ui.basket[g] = (ex.buy[g] || 0) - (ex.sell[g] || 0); });
      ui.rail = !!(ex && ex.import);
    }
    const dem = E.cityDemand(S);
    let cost = 0, gain = 0;
    let h = '<h2>Trade basket</h2><p class="muted">The price shown is for the first unit. ' + (C.slidingPrice ? 'Every unit sold drops it a step and every unit bought lifts it a step, so a big order gets a worse price. ' : '') + 'Sell orders fill up to the free slots plus what the city buys; buy orders fill from the stall. Short fills are shared in proportion. Minus sells, plus buys.</p>';
    const rail = !!ui.rail && C.imports.on;
    let railLeft = rail ? C.imports.cap : 0;
    E.GOODS.forEach((g) => {
      const q = ui.basket[g], pz = E.price(g, S.stalls[g]);
      const fromStall = Math.min(Math.max(q, 0), S.stalls[g]);
      const byRail = Math.min(Math.max(q, 0) - fromStall, railLeft); railLeft -= byRail;
      if (q > 0) cost += E.buyCost(g, S.stalls[g], fromStall) + byRail * E.importPrice(g); else gain += E.sellValue(g, S.stalls[g], -q);
      h += '<div class="row"><div class="grow"><b>' + AB[g] + ' ' + NAME[g] + '</b> ¢' + pz + '<br><span class="muted">stall ' + S.stalls[g] + '/' + C.stallSlots + ' · city buys ' + dem[g] + ' · you have ' + base.goods[g] + '</span></div>' +
        '<div class="step"><button onclick="UI.basketStep(\'' + g + '\',-1)" ' + (-q >= base.goods[g] ? 'disabled' : '') + '>−</button><div class="q ' + (q < 0 ? 'sell' : q > 0 ? 'buy' : '') + '">' + (q < 0 ? 'Sell ' + -q : q > 0 ? 'Buy ' + q : '0') + '</div><button onclick="UI.basketStep(\'' + g + '\',1)" ' + (q >= S.stalls[g] + (rail ? railLeft + byRail : 0) ? 'disabled' : '') + '>+</button></div></div>';
    });
    const any = E.GOODS.some((g) => ui.basket[g] !== 0);
    const has = plan.actions.some((a) => a.type === 'trade');
    if (C.imports.on) h += act(rail ? 'Rail imports: on' : 'Rail imports: off', 'Top up a buy order the stall cannot fill: ¢' + C.imports.raw + ' a raw good, ¢' + C.imports.processed + ' a processed one, ' + C.imports.cap + ' units a round at most', 'UI.railToggle()');
    h += '<p>Buying reserves ¢' + cost + ' (you have ¢' + base.coins + ' free). Selling brings ¢' + gain + ' if all of it fills and no rival sells the same good.</p>' +
      act(has ? (any ? 'Update the basket' : 'Remove the basket from the plan') : 'Put the basket in the plan', 'Uses one action', 'UI.tradeOk()', !any && !has, 'primary');
    sheet(h);
  }

  function bondSheet() {
    const p = S.players[H];
    sheet('<h2>Municipal bonds</h2><p>You have ¢' + p.coins + ' and ' + p.bonds + ' open bond' + (p.bonds === 1 ? '' : 's') + ' of ' + C.bond.max + '.</p>' +
      '<p class="muted">A bond pays ' + C.bond.amount + ' coins at once and can be spent this round. Each open bond costs ' + C.bond.interest + ' coin of interest a round, which goes to the city fund, and ' + C.bond.votePenalty + ' votes if it is still open on election day.</p>' +
      act('Take a bond', '+' + C.bond.amount + ' coins. Uses one action', "UI.bondDo('take')") + act('Repay a bond', '−' + C.bond.amount + ' coins. Uses one action', "UI.bondDo('repay')", p.bonds < 1));
  }

  function scoreTable() {
    const sc = E.score(S);
    const row = (label, f, cls) => '<tr class="' + (cls || '') + '"><td>' + label + '</td>' + sc.map((r) => '<td>' + f(r, S.players[r.pi]) + '</td>').join('') + '</tr>';
    return '<table class="sc"><tr><th></th>' + sc.map((r) => '<th>' + badge(r.pi) + ' ' + esc(pname(r.pi)) + '</th>').join('') + '</tr>' +
      row('Shares', (r) => r.shares) + row('Buildings', (r) => r.buildings) + row('Campaign fund', (r) => r.campaign) + row('Open bonds', (r) => r.bonds) + row('Votes', (r) => r.total, 'tot') +
      row('Coins', (r, p) => p.coins) + row('Bonds', (r, p) => p.bonds) + row('Share count', (r) => r.shareCount) +
      row('Stored goods', (r, p) => E.GOODS.filter((g) => p.goods[g]).map((g) => p.goods[g] + AB[g]).join(' ') || '0') +
      row('Bot style', (r, p) => (p.bot ? B.PERSONAS[p.persona].label : 'human')) + '</table>';
  }
  function scoresSheet() {
    sheet('<h2>Votes if the election were today</h2>' + scoreTable() + '<p class="muted">Shares count ' + C.votes.share.join(' / ') + ' votes by district class, buildings ' + C.votes.building.join(' / ') + ' by tier, and every ' + C.votes.coinsPerVote + ' coins held is 1 vote. Stored goods count for nothing.</p>');
  }

  function reportSheet() {
    if (!report) { sheet('<h2>No round has been settled yet</h2>'); return; }
    let h = '<h2>Round ' + report.round + ' settlement</h2><p>You: ¢' + report.coins[0] + ' → ¢' + report.coins[1] + ', votes ' + report.votes[0] + ' → ' + report.votes[1] + '.</p>';
    let ph = '';
    report.log.forEach((l) => {
      if (l.ph !== ph) { if (ph) h += '</div>'; ph = l.ph; h += '<h3>' + ph + '</h3><div class="log">'; }
      h += '<div class="' + (l.pi === H ? 'me' : '') + '"><i style="background:' + (l.pi >= 0 ? PCOL[l.pi] : '#bbb') + '"></i>' + esc(l.t.replace(/^You's/, 'Your').replace(/^You (\w+)s /, (m, v) => 'You ' + (v === 'pay' ? 'pay' : v) + ' ')) + '</div>';
    });
    if (ph) h += '</div>';
    h += act(S.over ? 'See the election result' : 'Plan round ' + S.round, '', S.over ? 'UI.result()' : 'UI.close()', false, 'primary');
    sheet(h);
    $('sheet').scrollTop = 0;
  }

  function resultSheet() {
    const sc = E.score(S).slice().sort((a, b) => a.rank - b.rank);
    const top = sc.filter((r) => r.total === sc[0].total && r.shareCount === sc[0].shareCount && r.coins === sc[0].coins);
    const title = top.length > 1 ? 'The election is shared' : top[0].pi === H ? 'You are elected mayor' : esc(S.players[top[0].pi].name) + ' is elected mayor';
    sheet('<h2>' + title + '</h2><p>' + sc.map((r) => r.rank + '. ' + badge(r.pi) + ' ' + esc(pname(r.pi)) + ' ' + r.total).join(' &nbsp; ') + '</p>' + scoreTable() +
      '<p class="muted">Map seed ' + S.seed + ', ' + S.players.length + ' players.</p>' + act('New match', '', 'UI.newGame()', false, 'primary') + act('Look at the final board', '', 'UI.close()'));
  }

  function menuSheet() {
    sheet('<h2>Menu</h2>' + act('Last settlement report', '', 'UI.report()') + act('Votes and public state', '', 'UI.scores()') + act('How to play', '', 'UI.rules()') + act('New match', 'Abandons this one', 'UI.newGame()') +
      '<p class="muted">Grey-box prototype of “Theme and Board v0.6”. Map seed ' + S.seed + '. The match is saved in this browser after every round.</p>');
  }
  const RULES = '<ul style="padding-left:18px;margin:6px 0">' +
    '<li>' + C.rounds + ' rounds. Most votes on election day wins: shares in districts, buildings, 1 vote per ' + C.votes.coinsPerVote + ' coins, minus ' + C.bond.votePenalty + ' per open bond.</li>' +
    '<li>Each round, plan up to 3 actions, then lock. The bots plan against the same board at the same time.</li>' +
    '<li><b>Tap a circle</b> to build, upgrade, idle or invest. <b>Drag between two circles</b> to lay a link on a faint dashed path.</li>' +
    '<li><b>Tap the market strip</b> for the trade basket. The number is the price of the first unit; fuller stalls are cheaper, and every unit you sell drops the price a step. Spread your sales.</li>' +
    '<li>A works costs upkeep every round it runs: ' + C.upkeep.join(' / ') + ' coins by tier. Idle one that cannot sell.</li>' +
    '<li>A workshop uses goods you held at the start of the round, so buy its inputs a round ahead.</li>' +
    '<li>Works produce on their own. The row of goods at the bottom is what you can spend this round, after production and after your plan.</li>' +
    '<li>Goods need a path of built links to the market to be sold, and to a project’s plot to be invested. Crossing a rival’s link costs a toll.</li>' +
    '<li>Investing in the two open projects earns shares. A served district pays its shareholders every round and rises in class. A district left unserved ' + C.declineAfter + ' rounds running falls back a class, and your shares lose votes with it.</li>' +
    '<li><b>Tap the coins</b> for bonds, the vote chips for the score, and a filled action slot to remove it.</li></ul>';

  function renderSetup() {
    const sv = load();
    $('setup').innerHTML = '<h1>Grey-box prototype</h1><p class="muted">“Theme and Board v0.6”: rival industrialists build a city around 1900 and stand for mayor after 18 rounds. Plain circles and bars, real rules, you against bots.</p>' +
      (sv && !sv.S.over ? act('Continue the saved match', 'Round ' + sv.S.round + ' of ' + C.rounds + ', ' + sv.S.players.length + ' players', 'UI.resume()', false, 'primary') : '') +
      '<h3>Players, counting you</h3><div class="seg">' + [2, 3, 4].map((n) => '<button class="' + (ui.n === n ? 'on' : '') + '" onclick="UI.setN(' + n + ')">' + n + '</button>').join('') + '</div>' +
      '<h3>Map seed (optional)</h3><input id="seed" inputmode="numeric" placeholder="random">' +
      act('Start a match', C.buildingCap[ui.n] + ' buildings each at this player count', 'UI.start()', false, 'primary') + '<h3>How to play</h3>' + RULES;
  }

  // ---------- Round flow ----------
  function lockNow() {
    const before = E.score(S)[H].total, coins0 = S.players[H].coins;
    const plans = S.players.map((p, i) => (i === H ? plan : B.think(S, i)));
    const round = S.round;
    const r = E.resolve(S, plans);
    S = r.state;
    report = { round, log: r.log, coins: [coins0, S.players[H].coins], votes: [before, E.score(S)[H].total] };
    plan = { actions: [], idle: (plan.idle || []).slice() };
    ui.basket = null; ui.inv = null;
    save(); render(); reportSheet();
  }

  // ---------- Board gestures: tap opens the sheet, drag lays a link ----------
  function svgPoint(e) {
    const svg = $('board');
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function initBoard() {
    const svg = $('board');
    svg.addEventListener('pointerdown', (e) => {
      const g = e.target.closest ? e.target.closest('[data-node]') : null;
      if (!g || !S) return;
      drag = { from: +g.dataset.node, x0: e.clientX, y0: e.clientY, moved: false };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) drag.moved = true;
      if (drag.moved) {
        const p = svgPoint(e), a = S.nodes[drag.from], rb = $('rubber');
        rb.setAttribute('x1', a.x); rb.setAttribute('y1', a.y); rb.setAttribute('x2', p.x); rb.setAttribute('y2', p.y); rb.setAttribute('visibility', 'visible');
      }
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      const rb = $('rubber'); if (rb) rb.setAttribute('visibility', 'hidden');
      if (e.type === 'pointercancel') return;
      if (!d.moved) { ui.inv = null; ui.bid = 0; nodeSheet(d.from); return; }
      const p = svgPoint(e);
      const t = S.nodes.find((n) => Math.hypot(n.x - p.x, n.y - p.y) <= C.map.nodeR + 6);
      if (!t || t.id === d.from) return;
      const ei = E.edgeBetween(S, d.from, t.id);
      if (ei < 0) { toast('No candidate link between those two'); return; }
      UI.link(ei);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    $('scrim').addEventListener('click', closeSheet);
  }

  // ---------- Public handlers ----------
  const UI = {
    close: closeSheet,
    node(id) { ui.inv = null; ui.bid = 0; nodeSheet(id); },
    setN(n) { ui.n = n; renderSetup(); },
    start() {
      const v = parseInt(($('seed') || {}).value, 10);
      S = E.newGame({ nPlayers: ui.n, seed: Number.isFinite(v) && v > 0 ? v : Math.floor(Math.random() * 1e9) + 1, human: H });
      plan = E.emptyPlan(); report = null; ui.basket = null; ui.inv = null;
      save(); render(); sheet('<h2>Round 1</h2><p>You are ' + badge(H) + ' blue. Your first works and its two links to the market are already built.</p>' + RULES + act('Start planning', '', 'UI.close()', false, 'primary'));
    },
    resume() { const d = load(); if (d) { S = d.S; plan = d.plan || E.emptyPlan(); report = d.report || null; render(); if (S.over) resultSheet(); } },
    newGame() { closeSheet(); S = null; render(); },
    build(site, kind) { if (S.over) return; addAction({ type: 'build', site, kind, bid: ui.bid }); },
    upgrade(site) { if (S.over) return; addAction({ type: 'upgrade', site }); },
    link(edge) {
      if (S.over) return;
      if (S.edges[edge].owner !== null) { toast('That link is already built'); return; }
      if (myLinkSet().has(edge)) { toast('That link is already in your plan'); return; }
      addAction({ type: 'link', edge, bid: 0 });
    },
    idle(site) {
      const i = plan.idle.indexOf(site);
      if (i >= 0) plan.idle.splice(i, 1); else plan.idle.push(site);
      save(); render(); nodeSheet(site);
    },
    bidStep(d) { ui.bid = Math.max(0, ui.bid + d); nodeSheet(ui.node); },
    invStep(g, d) { ui.inv[g] = Math.max(0, (ui.inv[g] || 0) + d); nodeSheet(ui.node); },
    invest(plot) {
      if (S.over) return;
      const goods = {}; E.GOODS.forEach((g) => { if (ui.inv[g] > 0) goods[g] = ui.inv[g]; });
      if (addAction({ type: 'invest', plot, goods }, (a) => a.type === 'invest' && a.plot === plot)) ui.inv = null;
    },
    trade() { ui.basket = null; tradeSheet(); },
    basketStep(g, d) { ui.basket[g] += d; tradeSheet(); },
    railToggle() { ui.rail = !ui.rail; if (!ui.rail) E.GOODS.forEach((g) => { ui.basket[g] = Math.min(ui.basket[g], S.stalls[g]); }); tradeSheet(); },
    tradeOk() {
      if (S.over) return;
      const buy = {}, sell = {};
      E.GOODS.forEach((g) => { if (ui.basket[g] > 0) buy[g] = ui.basket[g]; if (ui.basket[g] < 0) sell[g] = -ui.basket[g]; });
      const isTrade = (a) => a.type === 'trade';
      if (!Object.keys(buy).length && !Object.keys(sell).length) { plan.actions = plan.actions.filter((a) => !isTrade(a)); closeSheet(); save(); render(); return; }
      const basket = { type: 'trade', buy, sell };
      if (ui.rail && C.imports.on) basket.import = true;
      if (addAction(basket, isTrade)) ui.basket = null;
    },
    bond() { if (S && !S.over) bondSheet(); },
    bondDo(op) { addAction({ type: 'bond', op }); },
    removeAction(i) { plan.actions.splice(i, 1); ui.basket = null; ui.inv = null; save(); render(); },
    hint() { toast('Tap a circle, drag between two circles, or tap the market strip'); },
    lock() {
      if (!pv.ok || S.over) return;
      const unused = C.actionsPerRound - plan.actions.length;
      if (unused > 0 || pv.overflow > 0) {
        sheet('<h2>Lock this plan?</h2>' + (unused ? '<p>' + unused + ' action' + (unused > 1 ? 's are' : ' is') + ' unused.</p>' : '') +
          (pv.overflow ? '<p>You would hold ' + pv.storage + ' goods if every order fills as planned. The cap is ' + C.storageCap + '; the cheapest ' + pv.overflow + ' would be discarded.</p>' : '') +
          act('Lock and settle the round', '', 'UI.lockGo()', false, 'primary') + act('Keep planning', '', 'UI.close()'));
      } else lockNow();
    },
    lockGo() { closeSheet(); lockNow(); },
    scores: scoresSheet, report: reportSheet, result: resultSheet, menu: menuSheet,
    rules() { sheet('<h2>How to play</h2>' + RULES); },
  };
  window.UI = UI;

  initBoard();
  render();
})();

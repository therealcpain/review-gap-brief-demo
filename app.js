/**
 * Review Gap Brief — client-side MVP
 * Paste 3–5 Steam AppIDs → clustered negative themes + whitespace brief.
 * Tries Steam public appreviews JSON; falls back to curated seed (CORS).
 * Brand: Review Gap Brief only.
 */
(function () {
  "use strict";

  const THEMES = [
    {
      id: "difficulty_fairness",
      label: "Difficulty / fairness / RNG",
      keywords: [
        "too hard", "unfair", "rng", "random", "bullshit", "bullsh", "cheap",
        "difficulty", "brutal", "punish", "permadeath", "one shot", "oneshot",
        "unbalanced", "balance", "frustrating", "frustrat", "impossible",
        "save scum", "savescum", "gotcha", "screw", "unlucky", "coin flip",
      ],
    },
    {
      id: "grind_pacing",
      label: "Grind / pacing / repetition",
      keywords: [
        "grind", "grinding", "repetitive", "repeat", "tedious", "slow",
        "pacing", "farm", "farming", "padding", "busywork", "chore",
        "boring", "same thing", "recycle", "content drought", "empty",
      ],
    },
    {
      id: "ui_ux",
      label: "UI / UX / readability",
      keywords: [
        "ui", "ux", "interface", "menu", "menus", "clunky", "unintuitive",
        "confusing", "tooltip", "tool tip", "readability", "font", "tiny text",
        "controller", "hotkey", "hotkeys", "quality of life", "qol", "inventory",
        "navigation", "map",
      ],
    },
    {
      id: "bugs_stability",
      label: "Bugs / crashes / performance",
      keywords: [
        "bug", "bugs", "buggy", "crash", "crashes", "broken", "glitch",
        "performance", "fps", "lag", "stutter", "freeze", "freezing",
        "optimization", "memory leak", "softlock", "soft lock", "unplayable",
      ],
    },
    {
      id: "progression_meta",
      label: "Progression / meta / unlocks",
      keywords: [
        "progression", "unlock", "unlocks", "meta", "permanent", "roguelite",
        "carry over", "carryover", "reset", "start over", "no progress",
        "gate", "gated", "skill tree", "talent",
      ],
    },
    {
      id: "combat_feel",
      label: "Combat feel / turns / systems",
      keywords: [
        "combat", "turn", "turns", "fight", "battles", "clunky combat",
        "animation", "animations", "slow combat", "wait", "waiting",
        "deck", "cards", "hand size", "energy", "mana", "stamina",
      ],
    },
    {
      id: "content_value",
      label: "Content amount / value / DLC",
      keywords: [
        "short", "too short", "price", "overpriced", "dlc", "microtransaction",
        "mtx", "cash grab", "content", "worth", "replay", "replayability",
        "hours", "lacking", "barebones", "early access",
      ],
    },
    {
      id: "onboarding",
      label: "Tutorial / onboarding / clarity",
      keywords: [
        "tutorial", "onboarding", "explain", "explanation", "unclear",
        "no guidance", "steep learning", "learning curve", "documentation",
        "wiki", "have to look up", "doesn't explain", "does not explain",
      ],
    },
    {
      id: "multiplayer_social",
      label: "Multiplayer / co-op / social",
      keywords: [
        "multiplayer", "co-op", "coop", "cooperative", "friends", "online",
        "matchmaking", "solo only", "no multiplayer", "asynchronous",
      ],
    },
    {
      id: "story_tone",
      label: "Story / tone / writing",
      keywords: [
        "story", "writing", "lore", "narrative", "characters", "dialogue",
        "tone", "edgy", "cringe", "boring story", "no story",
      ],
    },
  ];

  const STOP = new Set(
    "the a an and or but if in on of to for with from by is are was were be been being it this that these those as at so not no yes you your we they them their my me i he she his her its our about into than then when what which who how why can could would should will just also only very much more most some any all each every other own same such than too very".split(
      /\s+/
    )
  );

  const els = {};
  function $(id) {
    return document.getElementById(id);
  }

  function parseAppIds(raw) {
    const parts = String(raw || "")
      .split(/[\s,;|/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ids = [];
    const seen = new Set();
    for (const p of parts) {
      let id = null;
      const mStore = p.match(/store\.steampowered\.com\/app\/(\d+)/i);
      const mSteam = p.match(/steam:\/\/store\/(\d+)/i);
      if (mStore) id = mStore[1];
      else if (mSteam) id = mSteam[1];
      else if (/^\d{1,10}$/.test(p)) id = p;
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t));
  }

  function scoreTheme(text, theme) {
    const lower = text.toLowerCase();
    let score = 0;
    const hits = [];
    for (const kw of theme.keywords) {
      if (lower.includes(kw)) {
        score += kw.includes(" ") ? 2 : 1;
        hits.push(kw);
      }
    }
    return { score, hits };
  }

  function assignThemes(reviewText) {
    const scored = THEMES.map((t) => {
      const { score, hits } = scoreTheme(reviewText, t);
      return { theme: t, score, hits };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) {
      return [{ theme: { id: "other", label: "Other / uncategorized", keywords: [] }, score: 1, hits: [] }];
    }
    // primary + secondary if close
    const out = [scored[0]];
    if (scored[1] && scored[1].score >= scored[0].score * 0.7 && scored[1].score >= 2) {
      out.push(scored[1]);
    }
    return out;
  }

  function truncate(s, n) {
    s = String(s || "").trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1).trim() + "…";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchLiveReviews(appid) {
    const params = new URLSearchParams({
      json: "1",
      language: "english",
      filter: "updated",
      review_type: "negative",
      purchase_type: "all",
      num_per_page: "40",
      cursor: "*",
    });
    const url = `https://store.steampowered.com/appreviews/${appid}?${params}`;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.success !== 1) throw new Error("Steam API success≠1");
    const reviews = (data.reviews || [])
      .map((rev) => {
        const text = String(rev.review || "").trim();
        if (text.length < 50) return null;
        return {
          recommendationid: String(rev.recommendationid || ""),
          votes_up: rev.votes_up || 0,
          timestamp_created: rev.timestamp_created,
          playtime_at_review_hours: Math.round(((rev.author && rev.author.playtime_at_review) || 0) / 60 * 10) / 10,
          review: text.slice(0, 1500),
        };
      })
      .filter(Boolean);
    return {
      appid: Number(appid),
      title: `App ${appid}`,
      store_url: `https://store.steampowered.com/app/${appid}/`,
      reviews,
      live: true,
    };
  }

  function seedApp(appid) {
    const seed = window.REVIEW_GAP_SEED;
    if (!seed || !seed.apps || !seed.apps[appid]) return null;
    const a = seed.apps[appid];
    return {
      appid: a.appid,
      title: a.title,
      store_url: a.store_url,
      reviews: a.reviews.slice(),
      live: false,
    };
  }

  async function resolveApps(appids) {
    const results = [];
    const notes = [];
    let liveOk = 0;
    let seedOk = 0;
    let failed = [];

    for (const id of appids) {
      let got = null;
      try {
        got = await fetchLiveReviews(id);
        if (got.reviews.length) {
          liveOk++;
          // Prefer seed title if we know it
          const s = seedApp(id);
          if (s) got.title = s.title;
          results.push(got);
          continue;
        }
        notes.push(`Live fetch for ${id} returned 0 negatives; trying seed.`);
      } catch (e) {
        notes.push(`Live fetch blocked/failed for ${id} (${e.message}).`);
      }
      const s = seedApp(id);
      if (s && s.reviews.length) {
        seedOk++;
        results.push(s);
      } else {
        failed.push(id);
      }
    }

    let sourceLabel;
    if (liveOk && !seedOk) sourceLabel = `Live Steam public appreviews (${liveOk} app${liveOk > 1 ? "s" : ""})`;
    else if (!liveOk && seedOk) sourceLabel = `Curated seed corpus (CORS / empty live) — ${seedOk} demo app${seedOk > 1 ? "s" : ""}`;
    else if (liveOk && seedOk) sourceLabel = `Mixed: ${liveOk} live + ${seedOk} seed`;
    else sourceLabel = "No review data resolved";

    return { results, sourceLabel, notes, failed, liveOk, seedOk };
  }

  function cluster(apps) {
    const themeMap = new Map();
    let totalReviews = 0;

    for (const app of apps) {
      for (const rev of app.reviews) {
        totalReviews++;
        const assigned = assignThemes(rev.review);
        for (const a of assigned) {
          const tid = a.theme.id;
          if (!themeMap.has(tid)) {
            themeMap.set(tid, {
              id: tid,
              label: a.theme.label,
              count: 0,
              apps: new Map(),
              quotes: [],
            });
          }
          const bucket = themeMap.get(tid);
          bucket.count += 1;
          bucket.apps.set(app.appid, (bucket.apps.get(app.appid) || 0) + 1);
          if (bucket.quotes.length < 12) {
            bucket.quotes.push({
              text: rev.review,
              appid: app.appid,
              title: app.title,
              recommendationid: rev.recommendationid,
              votes_up: rev.votes_up || 0,
            });
          }
        }
      }
    }

    const themes = Array.from(themeMap.values())
      .map((t) => {
        // diversify quotes across apps, prefer helpful votes
        t.quotes.sort((a, b) => (b.votes_up || 0) - (a.votes_up || 0));
        const picked = [];
        const perApp = new Map();
        for (const q of t.quotes) {
          const n = perApp.get(q.appid) || 0;
          if (n >= 2) continue;
          perApp.set(q.appid, n + 1);
          picked.push(q);
          if (picked.length >= 3) break;
        }
        t.sampleQuotes = picked;
        t.appCoverage = t.apps.size;
        t.appBreakdown = Array.from(t.apps.entries())
          .map(([id, c]) => {
            const app = apps.find((x) => String(x.appid) === String(id));
            return { appid: id, title: app ? app.title : `App ${id}`, count: c };
          })
          .sort((a, b) => b.count - a.count);
        return t;
      })
      .filter((t) => t.id !== "other" || t.count >= 3)
      .sort((a, b) => b.count - a.count || b.appCoverage - a.appCoverage);

    return { themes, totalReviews };
  }

  function whitespaceNarrative(themes, apps) {
    const top = themes.filter((t) => t.id !== "other").slice(0, 5);
    const gaps = [];
    for (const t of top) {
      const coverage = t.appCoverage;
      const share = Math.round((t.count / Math.max(1, themes.reduce((s, x) => s + x.count, 0))) * 100);
      if (coverage >= Math.max(2, apps.length - 1)) {
        gaps.push({
          hate: t.label,
          almostNobody: inventCounterPosition(t.id),
          coverage,
          share,
          apps: t.appBreakdown.map((a) => a.title).join(", "),
        });
      } else if (coverage === 1 && t.count >= 4) {
        gaps.push({
          hate: t.label + " (concentrated in one comp)",
          almostNobody: "Treat as competitor-specific — optional differentiator if that title is your closest peer.",
          coverage,
          share,
          apps: t.appBreakdown.map((a) => a.title).join(", "),
        });
      }
    }
    if (!gaps.length && top.length) {
      const t = top[0];
      gaps.push({
        hate: t.label,
        almostNobody: inventCounterPosition(t.id),
        coverage: t.appCoverage,
        share: Math.round((t.count / Math.max(1, themes.reduce((s, x) => s + x.count, 0))) * 100),
        apps: t.appBreakdown.map((a) => a.title).join(", "),
      });
    }
    return gaps;
  }

  function inventCounterPosition(themeId) {
    const map = {
      difficulty_fairness:
        "Ship transparent rules, seeded daily boards, and readable failure feedback — players hate opaque punishment, not challenge itself.",
      grind_pacing:
        "Compress loops; reward skill expression over time sinks. Almost nobody ships a tight daily run that still feels deep.",
      ui_ux:
        "Readable combat math + one-screen turn info. Most comps ship power and bury clarity.",
      bugs_stability:
        "Stability as a feature on the store page. Rare positioning for indies, loud hate when missing.",
      progression_meta:
        "Meaningful unlocks without forcing a second full grind. Few titles nail the first-10-hours meta curve.",
      combat_feel:
        "Snappy turn resolution / skip animations / clear telegraphing. Shared complaint; scarce default.",
      content_value:
        "Honest scope + post-launch cadence promise. Price hate often tracks unclear content density.",
      onboarding:
        "In-run coach that shuts up. Wikis-as-tutorial is still the niche norm.",
      multiplayer_social:
        "Async rivalry / shared daily leaderboard without full co-op cost. Sparse in turn-based roguelikes.",
      story_tone:
        "Tone that respects player time — short, sharp, optional. Mid-niche often overwrites or underwrites.",
      other: "Name the specific complaint in your niche and ship the missing default.",
    };
    return map[themeId] || map.other;
  }

  function buildMarkdown(apps, clusterResult, sourceLabel, gaps) {
    const now = new Date();
    const lines = [];
    lines.push(`# Review Gap Brief`);
    lines.push(``);
    lines.push(`Generated: ${now.toISOString()} (UTC)`);
    lines.push(`Apps: ${apps.map((a) => `${a.title} (${a.appid})`).join(" · ")}`);
    lines.push(`Source: ${sourceLabel}`);
    lines.push(`Negative reviews clustered: ${clusterResult.totalReviews}`);
    lines.push(``);
    lines.push(`> Public Steam review text only. Quotes attributed to recommendation IDs. Not affiliated with Valve.`);
    lines.push(``);
    const topThemes = clusterResult.themes.slice(0, 8);
    const totalReviews = clusterResult.totalReviews || 0;

    lines.push(`## Theme prevalence (negative-review theme hits)`);
    lines.push(``);
    lines.push(`Bars / counts use clustered **theme hit counts** from keyword assignment on negative reviews (primary + optional secondary). A review may contribute to two themes. % of reviews = hits ÷ negative reviews clustered.`);
    lines.push(``);
    if (!topThemes.length) {
      lines.push(`_No themes clustered — empty frequency chart._`);
      lines.push(``);
    } else {
      const maxCount = Math.max(...topThemes.map((t) => t.count), 1);
      for (const t of topThemes) {
        const pctReviews = totalReviews ? Math.round((t.count / totalReviews) * 100) : 0;
        const barUnits = Math.max(1, Math.round((t.count / maxCount) * 20));
        const bar = "█".repeat(barUnits) + "░".repeat(20 - barUnits);
        lines.push(`- \`${bar}\` **${t.label}** — ${t.count} hits (${pctReviews}% of reviews) · ${t.appCoverage}/${apps.length} comps`);
      }
      lines.push(``);
    }

    lines.push(`## Clustered negative themes`);
    lines.push(``);
    for (const t of topThemes) {
      lines.push(`### ${t.label}`);
      lines.push(`- Frequency signal: **${t.count}** theme hits across **${t.appCoverage}/${apps.length}** comps`);
      lines.push(`- Breakdown: ${t.appBreakdown.map((a) => `${a.title} (${a.count})`).join("; ")}`);
      lines.push(``);
      for (const q of t.sampleQuotes) {
        lines.push(`> ${truncate(q.text, 320).replace(/\n/g, " ")}`);
        lines.push(`>`);
        lines.push(
          `> — ${q.title} · Steam review \`${q.recommendationid || "?"}\` · [store](https://store.steampowered.com/app/${q.appid}/)`
        );
        lines.push(``);
      }
    }
    lines.push(`## Whitespace — players hate X / almost nobody ships Y`);
    lines.push(``);
    if (!gaps.length) {
      lines.push(`_Insufficient cross-comp overlap to draft a strong gap line. Add another adjacent AppID._`);
    } else {
      for (const g of gaps) {
        lines.push(`- **Players hate:** ${g.hate} _(seen in ${g.coverage} comps: ${g.apps})_`);
        lines.push(`  - **Almost nobody ships:** ${g.almostNobody}`);
      }
    }
    lines.push(``);
    lines.push(`## Positioning homework prompt`);
    lines.push(``);
    lines.push(
      `Pick one shared hate from above. Write a single store-page sentence that promises the missing default — without naming competitors. If it still sounds like feature laundry, the gap is not sharp enough.`
    );
    lines.push(``);
    lines.push(`---`);
    lines.push(`*Review Gap Brief · free niche utility · ad-supported path (see product README)*`);
    return lines.join("\n");
  }

  function buildFreqBarsHtml(themes, totalReviews, appCount) {
    const top = themes.slice(0, 8);
    if (!top.length) {
      return (
        `<div class="freq-chart" role="img" aria-label="Theme frequency chart empty">` +
        `<p class="freq-empty">No themes clustered yet — frequency bars unavailable.</p>` +
        `</div>`
      );
    }
    const maxCount = Math.max(...top.map((t) => t.count), 1);
    const parts = [];
    parts.push(`<div class="freq-chart" role="list" aria-label="Top themes by negative-review theme hit count">`);
    parts.push(
      `<p class="freq-legend">Sorted by clustered theme hits (keyword assignment on negative reviews). % = hits ÷ ${totalReviews} reviews. Dual-tag reviews can lift totals over 100% across themes.</p>`
    );
    for (const t of top) {
      // Bar width is relative to top theme hit count (not invented scale).
      const pctWidth = Math.max(t.count > 0 ? 3 : 0, Math.round((t.count / maxCount) * 100));
      const pctReviews = totalReviews ? Math.round((t.count / totalReviews) * 100) : 0;
      const aria = `${t.label}: ${t.count} hits, ${pctReviews}% of reviews, ${t.appCoverage} of ${appCount} comps`;
      parts.push(`<div class="freq-row" role="listitem" aria-label="${escapeHtml(aria)}">`);
      parts.push(`<div class="freq-label"><span class="freq-name">${escapeHtml(t.label)}</span>`);
      parts.push(
        `<span class="freq-stat">${t.count} hits · ${pctReviews}% · ${t.appCoverage}/${appCount} apps</span></div>`
      );
      parts.push(`<div class="freq-track" aria-hidden="true">`);
      parts.push(
        `<div class="freq-bar" style="width:${pctWidth}%" title="${escapeHtml(String(t.count))} hits"></div>`
      );
      parts.push(`</div></div>`);
    }
    parts.push(`</div>`);
    return parts.join("\n");
  }

  function buildHtml(apps, clusterResult, sourceLabel, gaps) {
    const parts = [];
    const topThemes = clusterResult.themes.slice(0, 8);
    const totalReviews = clusterResult.totalReviews || 0;

    parts.push(`<div class="meta">`);
    parts.push(`<strong>${apps.length} comps</strong> · ${escapeHtml(apps.map((a) => a.title).join(" · "))}<br>`);
    parts.push(`${totalReviews} negative reviews · source: ${escapeHtml(sourceLabel)}`);
    parts.push(`</div>`);

    parts.push(`<h3 class="viz-primary">Theme prevalence</h3>`);
    parts.push(buildFreqBarsHtml(clusterResult.themes, totalReviews, apps.length));

    parts.push(`<h3 class="viz-secondary">Theme detail + quotes</h3>`);
    if (!topThemes.length) {
      parts.push(`<p class="freq-empty">No theme cards — clustering returned zero themes.</p>`);
    }
    for (const t of topThemes) {
      parts.push(`<div class="theme-card">`);
      parts.push(`<div class="theme-title"><span>${escapeHtml(t.label)}</span><span class="freq">${t.count} hits · ${t.appCoverage}/${apps.length} apps</span></div>`);
      parts.push(
        `<div class="apps-hit">${t.appBreakdown
          .map((a) => `${escapeHtml(a.title)} (${a.count})`)
          .join(" · ")}</div>`
      );
      for (const q of t.sampleQuotes) {
        parts.push(`<blockquote class="quote">${escapeHtml(truncate(q.text, 360))}`);
        parts.push(
          `<span class="attr">${escapeHtml(q.title)} · Steam #${escapeHtml(q.recommendationid || "?")} · <a href="https://store.steampowered.com/app/${q.appid}/" target="_blank" rel="noopener">store</a></span>`
        );
        parts.push(`</blockquote>`);
      }
      parts.push(`</div>`);
    }

    parts.push(`<h3>Whitespace — players hate X / almost nobody ships Y</h3>`);
    parts.push(`<div class="gap-box"><ul>`);
    if (!gaps.length) {
      parts.push(`<li>Insufficient cross-comp overlap. Add another adjacent AppID.</li>`);
    } else {
      for (const g of gaps) {
        parts.push(
          `<li><strong>Players hate:</strong> ${escapeHtml(g.hate)} <span class="apps-hit">(${g.coverage} comps)</span><br><strong>Almost nobody ships:</strong> ${escapeHtml(g.almostNobody)}</li>`
        );
      }
    }
    parts.push(`</ul></div>`);

    parts.push(`<h3>Positioning homework</h3>`);
    parts.push(
      `<p>Pick one shared hate. Write a single store-page sentence that promises the missing default — without naming competitors.</p>`
    );
    return parts.join("\n");
  }

  function setStatus(msg, ok) {
    els.status.textContent = msg || "";
    els.status.classList.toggle("ok", !!ok);
  }

  function updateShare(appids) {
    const hash = `#apps=${appids.join(",")}`;
    const url = `${location.origin}${location.pathname}${location.search}${hash}`;
    els.shareUrl.value = url;
    history.replaceState(null, "", hash);
    els.copyShare.disabled = false;
  }

  async function generate() {
    const appids = parseAppIds(els.appIds.value);
    if (appids.length < 3 || appids.length > 5) {
      setStatus("Enter 3–5 Steam AppIDs (found " + appids.length + ").");
      return;
    }
    // Refuse using DoP alone as the whole set — allow if mixed, but warn; never present as DoP clone
    if (appids.length === 1 && appids[0] === "4996340") {
      setStatus("Depths of Providence is a research case pointer only — paste 3–5 adjacent comps.");
      return;
    }

    els.generateBtn.disabled = true;
    setStatus("Fetching / resolving reviews…");
    els.emptyState.hidden = true;

    try {
      const { results, sourceLabel, notes, failed } = await resolveApps(appids);
      if (results.length < 2) {
        setStatus(
          "Need review text for at least 2 apps. Live Steam JSON is often CORS-blocked in the browser — use the seed chips (Darkest Dungeon, Across the Obelisk, Slay the Spire) or host a same-origin proxy. Failed: " +
            (failed.join(", ") || "n/a")
        );
        els.generateBtn.disabled = false;
        return;
      }

      const clustered = cluster(results);
      const gaps = whitespaceNarrative(clustered.themes, results);
      const md = buildMarkdown(results, clustered, sourceLabel, gaps);
      const html = buildHtml(results, clustered, sourceLabel, gaps);

      els.briefHtml.innerHTML = html;
      els.briefHtml.hidden = false;
      els.briefMd.textContent = md;
      els.briefMd.hidden = true;
      els.emptyState.hidden = true;

      els.dataSource.textContent = sourceLabel;
      els.reviewCount.textContent = String(clustered.totalReviews);
      els.appCount.textContent = String(results.length);

      els.copyMd.disabled = false;
      els.downloadMd.disabled = false;
      els.printBrief.disabled = false;
      window.__lastBriefMd = md;
      window.__lastBriefTitle = `review-gap-brief-${results.map((a) => a.appid).join("-")}.md`;

      updateShare(results.map((a) => String(a.appid)));

      const warn =
        notes.slice(0, 2).join(" ") +
        (failed.length ? ` Unresolved AppIDs (no live + no seed): ${failed.join(", ")}.` : "");
      setStatus(
        (results.length >= 3 ? "Brief ready. " : "Brief ready (partial set). ") + warn,
        true
      );
    } catch (e) {
      setStatus("Generate failed: " + e.message);
    } finally {
      els.generateBtn.disabled = false;
    }
  }

  function loadSeedChips() {
    const seed = window.REVIEW_GAP_SEED;
    const box = els.seedChips;
    box.innerHTML = "";
    if (!seed || !seed.apps) return;
    const allIds = Object.keys(seed.apps);
    // one chip = load all three demo comps
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "chip";
    allBtn.textContent = "Load 3 seed comps";
    allBtn.addEventListener("click", () => {
      els.appIds.value = allIds.join(", ");
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      allBtn.classList.add("active");
    });
    box.appendChild(allBtn);

    for (const id of allIds) {
      const app = seed.apps[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = `${app.title} (${id})`;
      btn.title = "Add this AppID";
      btn.addEventListener("click", () => {
        const cur = parseAppIds(els.appIds.value);
        if (!cur.includes(id)) cur.push(id);
        els.appIds.value = cur.slice(0, 5).join(", ");
        btn.classList.add("active");
      });
      box.appendChild(btn);
    }
  }

  function restoreHash() {
    const m = location.hash.match(/apps=([0-9,]+)/);
    if (m) {
      els.appIds.value = m[1].split(",").join(", ");
    }
  }

  function init() {
    els.appIds = $("appIds");
    els.generateBtn = $("generateBtn");
    els.clearBtn = $("clearBtn");
    els.dataSource = $("dataSource");
    els.reviewCount = $("reviewCount");
    els.appCount = $("appCount");
    els.status = $("status");
    els.seedChips = $("seedChips");
    els.briefHtml = $("briefHtml");
    els.briefMd = $("briefMd");
    els.emptyState = $("emptyState");
    els.copyMd = $("copyMd");
    els.downloadMd = $("downloadMd");
    els.printBrief = $("printBrief");
    els.shareUrl = $("shareUrl");
    els.copyShare = $("copyShare");

    loadSeedChips();
    restoreHash();

    els.generateBtn.addEventListener("click", generate);
    els.clearBtn.addEventListener("click", () => {
      els.appIds.value = "";
      els.briefHtml.hidden = true;
      els.briefHtml.innerHTML = "";
      els.emptyState.hidden = false;
      els.dataSource.textContent = "—";
      els.reviewCount.textContent = "0";
      els.appCount.textContent = "0";
      els.copyMd.disabled = true;
      els.downloadMd.disabled = true;
      els.printBrief.disabled = true;
      setStatus("");
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    });

    els.copyMd.addEventListener("click", async () => {
      const md = window.__lastBriefMd || "";
      try {
        await navigator.clipboard.writeText(md);
        setStatus("Markdown copied.", true);
      } catch {
        els.briefMd.hidden = false;
        setStatus("Clipboard blocked — Markdown shown below for manual copy.");
      }
    });

    els.downloadMd.addEventListener("click", () => {
      const md = window.__lastBriefMd || "";
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = window.__lastBriefTitle || "review-gap-brief.md";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("Download started.", true);
    });

    els.printBrief.addEventListener("click", () => window.print());

    els.copyShare.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(els.shareUrl.value);
        setStatus("Share URL copied.", true);
      } catch {
        setStatus("Copy the share URL from the field.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

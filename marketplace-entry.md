# Marketplace submission — awesome-dsh-plugin

The [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
list is **generated** — you do NOT edit the README by hand. You add one YAML
file and run the generator.

## 1. The YAML file to add

Create `data/plugins/yushuosun__dsh-cost-governor.yml` with exactly:

```yaml
url: https://github.com/yushuosun/dsh-cost-governor
name: yushuosun/dsh-cost-governor
category: usage
description:
  en: 'Per-model token-cost accounting and budget tracking for DeepSeek Harness: prices token buckets against a multi-provider catalog and shows a usage-and-budget dashboard with warn thresholds.'
  zh: 'DeepSeek Harness 的按模型 token 成本核算与预算跟踪：以多厂商价格目录计价 token 桶，并提供用量与预算仪表盘。'
```

> `category: usage` maps to the "Usage & Billing" section. Description is kept
> factual (no superlatives) per the review rules.

## 2. Submit the PR (run AFTER the repo is ≥1 day old + has ≥10 commits)

```bash
# fork + clone
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone
cd awesome-dsh-plugin

# add the entry
#   (create data/plugins/yushuosun__dsh-cost-governor.yml with the content above)

# regenerate both READMEs (required)
npm ci
node scripts/generate-readme.mjs

# commit + push + open the PR
git checkout -b add-dsh-cost-governor
git add data/plugins/yushuosun__dsh-cost-governor.yml README.md README.zh.md
git commit -m "Add dsh-cost-governor"
git push -u origin add-dsh-cost-governor
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --title "Add dsh-cost-governor" \
  --body "Per-model token-cost accounting and budget tracking for DeepSeek Harness."
```

## ⚠️ CI gates (enforced automatically)

1. **Repo age ≥ 1 day** — your repo was created today, so submit the PR **tomorrow or later**.
2. **≥ 10 commits** — the repo currently has fewer; keep committing real work (the two
   integration points in PUBLISHING.md §4 are natural follow-up commits).
3. **`dsh.bundle` manifest** — present (`package.json` → `dsh.bundle.patch` → `cordis.patch.yml`). ✅
4. At most 3 entries per PR — this PR adds 1. ✅
5. Add the `dsh-plugin` GitHub topic to the repo. ✅ (done by `gh repo edit`)

## Screenshot (optional, recommended)

Add an entry to `data/screenshots.json` keyed by `https://github.com/yushuosun/dsh-cost-governor`
pointing at a rendered PNG of `preview/dashboard.html`.

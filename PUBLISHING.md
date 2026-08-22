# Publishing guide

Everything is authored; the last mile is publishing. Run these **from a machine
with normal outbound network** (the sandbox this was written in blocks TLS).

## 0. One-time prerequisites

```bash
gh auth login          # authenticate GitHub CLI
npm login              # authenticate npm
```

## 1. GitHub

```bash
cd dsh-cost-governor

# create the repo (or create it on github.com first)
gh repo create dsh-cost-governor --public --source . --push

# if the repo already exists:
git remote add origin https://github.com/<you>/dsh-cost-governor.git
git push -u origin main
```

The `ci.yml` workflow typechecks on every push.

## 2. npm

```bash
# bump out of 0.1.0 first if you want a stable tag
npm version patch
npm publish --access public
```

> Before `npm publish`, confirm the peer-dependency version ranges in
> `package.json` match your target DSH release (`@deepseek-ai/schemastery` is
> `^3.18.0`, the rest `^0.1.0-rc.8`).

## 3. awesome-dsh-plugin market

1. Fork <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>.
2. Add the entry from `marketplace-entry.md` to the README (match the repo's
   current table/list schema — see its CONTRIBUTING).
3. Optionally add a `preview/dashboard.png` screenshot.
4. Open a PR titled `Add dsh-cost-governor`.

## 4. Before you merge (build-integrity checklist)

The plugin source is written against the DSH public API reverse-engineered from
the installed `0.1.0-rc.8` packages. Before shipping, verify these **two**
integration points against the official DSH plugin docs / dev guide:

1. **Hard-quota wiring** — `BudgetGovernor.gate()` returns the block/steer
   decision; connect it to the LLM waterfall hook (see the official
   "Everything is a plugin" / first-plugin docs). The `notify-only` path needs
   no wiring and is safe to ship first.
2. **Client slot wiring** — `ctx.slots.register({ name, id, order, locale, inject }, Component)`
   is the confirmed call shape; confirm the projection/settings read hooks a
   settings section injects (`PropsRuntime` / `PropsLocale`) and finish the
   `DashboardContainer` live-data effect.

Then run the full DSH build (`pnpm build` with the DSH toolchain) and smoke-test
in a real harness before tagging a stable release.

## 5. Tag + release

```bash
git tag v0.1.0
git push --tags
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release"
```

p = "D:/First-Commit/src/components/experience/Decisions/DecisionsScene.tsx"
s = open(p, encoding="utf-8").read()
jsx = s[s.index("  return (\n    <section"):]
# drop dead evidence carrier
a = jsx.index("        {/* Approved transaction evidence becomes")
b = jsx.index("        {/* Top Institutional Header Bar */}")
jsx = jsx[:a] + jsx[b:]
# add lane wrap hooks
for lane in ("allow", "stepup", "deny"):
    marker = f'data-lane-tag="{lane}"'
    assert marker in jsx
# the wrap div precedes each tag: <div className={styles.laneTagWrap}>
parts = jsx.split("<div className={styles.laneTagWrap}>")
assert len(parts) == 4, len(parts)
out = parts[0]
for lane, rest in zip(("allow", "stepup", "deny"), parts[1:]):
    out += f'<div className={{styles.laneTagWrap}} data-lane-tagwrap="{lane}">' + rest
jsx = out
head = open("D:/First-Commit/output/motion-verify/decisions-head.tsx.txt", encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(head + jsx)
print("ok", len(head + jsx))

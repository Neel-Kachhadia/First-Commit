p = "D:/First-Commit/src/components/experience/Delegation/DelegationScene.tsx"
s = open(p, encoding="utf-8").read()
jsx = s[s.index("  return (\n    <section"):]
a = jsx.index("        {/* Incoming approved receipt")
b = jsx.index("        {/* Scene title remains scene-owned")
jsx = jsx[:a] + jsx[b:]
head = open("D:/First-Commit/output/motion-verify/delegation-head.tsx", encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(head + jsx)
print("assembled", len(head + jsx))

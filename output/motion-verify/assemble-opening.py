import re
base = "D:/First-Commit/"
old_css = open(base + "output/motion-verify/opening-9456/OpeningScene.module.css.txt", encoding="utf-8").read()
head_css = open(base + "src/components/experience/Opening/OpeningScene.module.css", encoding="utf-8").read()

def grab(css, name):
    m = re.search(r"^\." + name + r" \{.*?^\}\n", css, re.S | re.M)
    assert m, name
    return m.group(0)

extra = "\n/* Thesis statement bar, registration mark and rule: resolve into the frame the 00->01 film begins on */\n"
for n in ("aperture", "registrationMark", "regCross", "rule"):
    extra += grab(head_css, n) + "\n"

# insert before the responsive tail so mobile rules still win
i = old_css.index("/* 1366x768 Laptop Viewport")
css = old_css[:i] + extra + "\n" + old_css[i:]
open(base + "src/components/experience/Opening/OpeningScene.module.css", "w", encoding="utf-8").write(css)

tsx = open(base + "output/motion-verify/opening-new.tsx.txt", encoding="utf-8").read()
open(base + "src/components/experience/Opening/OpeningScene.tsx", "w", encoding="utf-8").write(tsx)
print("ok")

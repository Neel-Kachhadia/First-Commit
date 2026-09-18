from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def comps(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h=im.shape[0]
    m=(im[:,:,0]>105)&(im[:,:,1]>95)&(im[:,:,2]>75)
    m[:int(h*0.10)]=False; m[int(h*0.93):]=False
    m=ndi.binary_closing(m,iterations=6); m=ndi.binary_fill_holes(m)
    lab,n=ndi.label(m); out=[]
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if len(ys)>h*h*0.02*0.5: out.append((int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())))
    return sorted(out)
B="D:/First-Commit/output/motion-verify/s03seam/"
for vp in ["1920x1080","1440x900","1366x768"]:
    print(vp)
    for n in ["in_film","in_live","out_film","out_live"]: print("  ",n,comps(B+vp+"/"+n+".png"))

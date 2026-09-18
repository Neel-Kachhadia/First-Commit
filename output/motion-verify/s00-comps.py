from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def bbox(mask):
    ys,xs=np.where(mask)
    return (int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())) if len(xs) else None
def analyse(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h,w,_=im.shape
    red=(im[:,:,0]>140)&(im[:,:,1]<90)&(im[:,:,2]<80); red[:int(h*0.15)]=False
    cream=(im[:,:,0]>200)&(im[:,:,1]>190)&(im[:,:,2]>160); cream[:int(h*0.3)]=False; cream[:, int(w*0.7):]=False; cream[int(h*0.95):]=False
    cream=ndi.binary_closing(cream,iterations=6)
    lab,n=ndi.label(cream); best=None
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if best is None or len(ys)>best[0]: best=(len(ys),(int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())))
    return {"wordmark":best[1] if best else None,"red":bbox(red)}
B="D:/First-Commit/output/motion-verify/s00seam/"
for vp in ["1920x1080","1440x900","1366x768"]:
    print(vp)
    for n in ["out_film","out_film2","out_live"]: print("  ",n,analyse(B+vp+"/"+n+".png"))

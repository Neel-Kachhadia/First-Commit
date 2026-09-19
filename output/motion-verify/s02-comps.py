from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def receipts(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h,w,_=im.shape
    m=(im[:,:,0]>190)&(im[:,:,1]>180)&(im[:,:,2]>150); m[:int(h*0.09)]=False; m[int(h*0.96):]=False; m[:, :int(w*0.12)]=False
    m=ndi.binary_closing(m,iterations=5); m=ndi.binary_fill_holes(m)
    lab,n=ndi.label(m); out=[]
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if len(ys)>h*w*0.006: out.append((int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())))
    return sorted(out,key=lambda b:b[1])
def labels(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h,w,_=im.shape
    lum=im.sum(axis=2)/3; m=lum>110; m[:int(h*0.12)]=False; m[int(h*0.95):]=False; m[:, int(w*0.16):]=False
    m=ndi.binary_dilation(m,iterations=6); lab,n=ndi.label(m); out=[]
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if len(ys)>250: out.append((int(xs.min()+6),int(ys.min()+6),int(xs.max()-6),int(ys.max()-6)))
    return sorted(out,key=lambda b:b[1])
B="D:/First-Commit/output/motion-verify/s02seam/"
for vp in ["1920x1080","1440x900","1366x768"]:
    print(vp)
    print("  IN labels  film",labels(B+vp+"/in_film.png")); print("             live",labels(B+vp+"/in_live.png"))
    print("  OUT labels film",labels(B+vp+"/out_film.png")); print("             live",labels(B+vp+"/out_live.png"))
    print("  OUT recpts film",receipts(B+vp+"/out_film.png")); print("             live",receipts(B+vp+"/out_live.png"))

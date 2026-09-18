from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def cream(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h,w,_=im.shape
    m=(im[:,:,0]>185)&(im[:,:,1]>175)&(im[:,:,2]>145); m[:int(h*0.07)]=False; m[int(h*0.97):]=False; m[:, :int(w*0.2)]=False
    m=ndi.binary_closing(m,iterations=4); m=ndi.binary_fill_holes(m)
    lab,n=ndi.label(m); out=[]
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if len(ys)>h*w*0.01: out.append((int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())))
    return sorted(out)
def stack_right(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h,w,_=im.shape
    lum=im.sum(axis=2)/3; band=lum[int(h*0.25):int(h*0.75)]
    cols=np.where((band>70).mean(axis=0)>0.5)[0]
    return int(cols.max())
def head(path):
    im=np.array(Image.open(path).convert("RGB")).astype(int); h,w,_=im.shape
    lum=im.sum(axis=2)/3; m=lum>150; m[:int(h*0.12)]=False; m[int(h*0.5):]=False; m[:, int(w*0.3):]=False
    m=ndi.binary_dilation(m,iterations=10); lab,n=ndi.label(m); out=[]
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if len(ys)>3000: out.append((int(xs.min()+10),int(ys.min()+10),int(xs.max()-10),int(ys.max()-10)))
    return sorted(out)
B="D:/First-Commit/output/motion-verify/s01seam/"
for vp in ["1920x1080","1440x900","1366x768"]:
    print(vp)
    for n in ["in_film","in_live","out_film","out_live"]:
        print("  ",n,"cream",cream(B+vp+"/"+n+".png"),"stackRight",stack_right(B+vp+"/"+n+".png"),"head",head(B+vp+"/"+n+".png")[:1])

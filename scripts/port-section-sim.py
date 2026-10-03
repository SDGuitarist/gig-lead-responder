# Port helper (plan 0.5): per-section similarity between the private Project extraction
# (~/Data/gig-lead-responder/) and the repo docs/ copies. Prints headings and ratios only,
# never source text. Usage: python3 scripts/port-section-sim.py > <scratch file>
import re, difflib, sys, os
SRC=os.path.expanduser('~/Data/gig-lead-responder/Gig_Lead_Response_System_4.0_Extraction.md')
lines=open(SRC,encoding='utf-8').read().split('\n')
# file boundaries
bounds=[(i,int(m.group(1))) for i,l in enumerate(lines) for m in [re.match(r'=== FILE (\d+) of 19',l)] if m]
end4=next(i for i,l in enumerate(lines) if l.startswith('# PART 4'))
files={}
for k,(i,n) in enumerate(bounds):
    j=bounds[k+1][0] if k+1<len(bounds) else end4
    files[n]=lines[i+1:j]
def norm(t):
    t=t.replace('—',' ').replace('–',' ').replace('â€"',' ')
    t=re.sub(r'[^a-z0-9$%. ]+',' ',t.lower()); return re.sub(r'\s+',' ',t).strip()
def sections(ls):
    out=[];cur=None
    for l in ls:
        m=re.match(r'^(#{1,4})\s+(.*)',l)
        if m and len(m.group(1))<=3:
            cur=[m.group(2).strip(),[]];out.append(cur)
        elif cur: cur[1].append(l)
    return [(h,norm('\n'.join(b))) for h,b in out]
REPO={2:None,3:'docs/Rate_Card_Trio_Ensemble.md',4:'docs/Rate_Card_Bolero_Trio.md',5:None,6:'docs/Rate_Card_Solo_Duo.md',7:None,8:'docs/CULTURAL_CORE.md',9:'docs/CULTURAL_SPANISH_LATIN.md',10:'docs/PRINCIPLES.md',11:'docs/QUICK_REFERENCE.md',12:'docs/VERIFICATION.md',13:'docs/PRICING.md',14:'docs/RESPONSE_CRAFT.md',15:'docs/DRAFT_METHOD.md',16:'docs/PROTOCOL.md',19:'docs/Bolero_Trio_Negotiation_Playbook.md'}
for n in sorted(REPO):
    src=sections(files[n]); rp=REPO[n]
    if not rp: print(f'F{n}: no repo copy ({len(src)} sections)'); continue
    rs=sections(open(rp,encoding='utf-8').read().split('\n'))
    rmap={}
    for h,b in rs: rmap.setdefault(norm(h),b)
    whole=difflib.SequenceMatcher(None,' '.join(b for _,b in src),' '.join(b for _,b in rs),autojunk=False).ratio()
    print(f'F{n} {rp} sections src={len(src)} repo={len(rs)} whole={whole:.2f}')
    for h,b in src:
        rb=rmap.get(norm(h))
        if rb is None:
            # best heading match
            best=max(rs,key=lambda x:difflib.SequenceMatcher(None,b,x[1]).ratio(),default=None)
            r=difflib.SequenceMatcher(None,b,best[1]).ratio() if best else 0
            print(f'   {r:.2f} [nohead->{best[0][:30] if best else "-"}] {h[:60]}')
        else:
            r=difflib.SequenceMatcher(None,b,rb,autojunk=False).ratio() if (b or rb) else 1.0
            print(f'   {r:.2f} {h[:70]}')

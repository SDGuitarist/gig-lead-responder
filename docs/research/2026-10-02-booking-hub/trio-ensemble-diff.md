# Trio/Ensemble rate card: Project vs repo, side by side

**Reader and trigger:** Alex, at plan step 0.3(a), before the Trio/Ensemble card is ported.
Each block shows the lines that differ: `PROJECT` is the claude.ai Project copy, last updated
2026-04-26, and `REPO` is `docs/Rate_Card_Trio_Ensemble.md`, last updated 2026-04-07. Lines that
match are left out. The text is normalized (lowercased, punctuation removed) so punctuation
differences don't show.

**Summary:** On Apr 26 the Project made a same-day "scope correction": the residency framework
applies to solo Alex only, and trio/ensemble recurring requests are quoted as a series of private
events at the $500 floor, with a 5-10% multi-month concession off the T2D anchor. Every
repo-only line is one of the old B2B residency tables (weekly, bi-weekly, monthly) that the
correction removed.

```diff
@@ -1,28 +1,15 @@
-markdown
 rate card trio ensemble
 purpose pricing reference for trio and larger ensemble configurations
-last updated april 26 2026 confidential
-update history
-april 2026 $500 minimum booking floor enforced system wide all trio ensemble prices already cleared this threshold no rate changes required
-april 26 2026 residency pricing reclassified into three tier framework r1 r2 r3 per council log 2026 04 26 tier classification context briefly added to this card
-april 26 2026 scope correction same day residency framework applies to alex performing solo only see rate card solo duo md trio and ensemble formats are private event products they are not eligible for residency pricing all previously drafted b2b residency pricing subsections have been removed from this card for recurring trio ensemble programming requests quote as a series of b2c private events using the tables below at the $500 b2c floor typically t2d anchor with 5 10% multi month commitment concession
+last updated april 2026 confidential
+april 2026 update $500 minimum booking floor enforced system wide all trio ensemble prices already clear this threshold no rate changes required
 format all prices shown as anchor floor
 note bolero trio has separate rate card rate card bolero trio md
 tier definitions quick reference
-b2c buyer tiers private events
-tier 1 relationship investment reserved for prospects with recurring revenue potential or strategic venue access note t1 is for private events with strategic relationship value recurring programming is a residency which uses the r1 r2 r3 framework below
+tier 1 relationship investment reserved for prospects with recurring revenue potential or strategic venue access
 tier 2 standard private parties social events one off celebrations standard weddings price conscious comparison shoppers
 tier 3 premium named luxury venues corporate at upscale properties rehearsal dinners milestone celebrations with stealth premium signals
 tier 4 duo ensemble product tier clients requesting duo ensemble signal budget capacity
 stealth premium signals any one t3 premium venue 150 guests la jolla rancho santa fe coronado del mar carmel valley zip corporate 100 buried luxury cues valet black tie plated dinner vip executive audience saturday evening at named venue
-recurring programming requests for trio ensemble
-trio and ensemble formats are not eligible for residency pricing the residency framework r1 r2 r3 tier floors applies to alex performing solo only see rate card solo duo md
-if a venue requests recurring trio or ensemble programming
-quote as a series of b2c private events using the tables below
-apply standard tier classification t2 t3 and pricing column p d not r1 r2 r3 floors
-the $500 b2c floor still applies not the residency tier floors
-a documented multi month commitment may justify modest concession typically 5 10% off t2d anchor but the booking is still a private event priced as such
-why trio ensemble economics 3 10 musician costs per night cannot absorb residency floor rates at viable margin the economics that justify residency floors no musician cost sustainability over per night rate alex s personal time margin only hold for solo alex
 flamenco trio guitar cajo n dancer
 traditional spanish flamenco featuring guitarist cajo n percussion and professional flamenco dancer
 best for specialty cultural nights signature experiences mediterranean venues spanish baja coastal concepts
@@ -76,6 +63,19 @@
 t2d $2 400 $2 200
 t3p $2 500 $2 300
 t3d $2 800 $2 600
+b2b residency pricing flamenco trio
+full trio dancer entire duration
+2 hour service
+weekly $1 400 bi weekly $1 550 monthly $1 700
+3 hour service
+weekly $1 800 bi weekly $2 000 monthly $2 200
+hybrid trio dancer partial recommended for b2b
+2 hours dancer 1 hour
+weekly $1 200 bi weekly $1 350 monthly $1 475
+3 hours dancer 1 hour
+weekly $1 550 bi weekly $1 700 monthly $1 850
+3 hours dancer 2 hours
+weekly $1 800 bi weekly $1 950 monthly $2 100
 mariachi full ensemble weekend 8 10 players
 traditional mexican ensemble with violins trumpets guitars guitarro n vihuela vocals
 best for weekend activations holiday programming cultural celebrations cinco de mayo
@@ -110,6 +110,11 @@
 t2d $4 050 $3 750
 t3p $4 150 $3 900
 t3d $4 500 $4 200
+b2b residency pricing mariachi full ensemble
+2 hour service
+weekly $1 700 bi weekly $1 850 monthly $2 000
+3 hour service
+weekly $2 350 bi weekly $2 550 monthly $2 750
 mariachi 4 piece weekday
 right sized traditional ensemble for weekday corporate events and smaller cultural celebrations
 best for weekday corporate events intimate cultural celebrations budget conscious clients who still want authenticity
@@ -132,6 +137,11 @@
 t2d $1 950 $1 800
 t3p $2 050 $1 900
 t3d $2 350 $2 150
+b2b residency pricing mariachi 4 piece
+2 hour service
+weekly $1 100 bi weekly $1 250 monthly $1 400
+3 hour service
+weekly $1 550 bi weekly $1 750 monthly $1 950
 sourced cultural music universal pricing
 any cultural tradition sourced at standard musician rate hawaiian polynesian indian persian somalian italian celtic and others
 lead time 4 6 weeks specialty ensembles need longer
@@ -143,6 +153,11 @@
 t2p $1 595 $1 450 t2d $1 750 $1 600 t3p $1 800 $1 650 t3d $2 000 $1 850
 3 hour service
 t2p $2 300 $2 100 t2d $2 500 $2 300 t3p $2 600 $2 400 t3d $2 895 $2 650
+b2b residency pricing
+2 hour service
+weekly $1 550 bi weekly $1 700 monthly $1 850
+3 hour service
+weekly $2 200 bi weekly $2 400 monthly $2 600
 quartet 4 musicians
 b2c pricing
 1 hour service
@@ -151,6 +166,11 @@
 t2p $2 100 $1 925 t2d $2 400 $2 200 t3p $2 500 $2 300 t3d $2 895 $2 650
 3 hour service
 t2p $3 100 $2 825 t2d $3 400 $3 100 t3p $3 600 $3 300 t3d $4 100 $3 750
+b2b residency pricing
+2 hour service
+weekly $2 050 bi weekly $2 250 monthly $2 450
+3 hour service
+weekly $2 900 bi weekly $3 175 monthly $3 450
 5 piece 5 musicians
 b2c pricing
 1 hour service
@@ -159,24 +179,27 @@
 t2p $2 695 $2 450 t2d $2 895 $2 650 t3p $3 100 $2 850 t3d $3 495 $3 200
 3 hour service
 t2p $3 895 $3 550 t2d $4 200 $3 850 t3p $4 500 $4 100 t3d $4 995 $4 550
+b2b residency pricing
+2 hour service
+weekly $2 550 bi weekly $2 800 monthly $3 050
+3 hour service
+weekly $3 600 bi weekly $3 950 monthly $4 300
 booking guidelines
 anchor the number you quote first left number
 floor the number you hold right number
 below floor only if booking has tier 1 strategic value never for one time client
 travel modifiers outside sd county duo solo $250 300 la county $500 800
 holiday peak dates valentine s cinco de mayo nye quoted separately above standard rates
-recurring programming requests trio and ensemble formats are not eligible for residency tier pricing quote as a series of b2c private events from the tables above the $500 b2c floor applies not the r1 r2 r3 residency floors multi month commitment may justify a 5 10% concession off t2d anchor
+b2b frequency tiers
+weekly 4 month deepest discount rewards commitment
+bi weekly 2 3 month mid tier common for testing or alternating programming
+monthly activation 1 month highest rate special events seasonal activations
 strategic notes
 flamenco trio hybrid recommended default delivery model marketed as flamenco trio but structured as duo featured dancer set delivers full experience with better economics for both client and venue
 mariachi 4 piece vs full ensemble position 4 piece as right sized for weekday corporate not budget alternative reserve full ensemble for weekend cultural events with budget
 sourced ensembles ecosystem retention play keeps sophisticated clients from sourcing elsewhere for specialty traditions
-trio ensemble for recurring programming trio and ensemble formats are private event products not residency products the residency framework r1 r2 r3 tier floors applies to alex performing solo only if a venue requests recurring trio ensemble programming quote as a series of b2c private events at the $500 b2c floor typically t2d anchor with potential 5 10% multi month commitment concession multi musician economics cannot absorb residency floor rates that math only works for solo alex no musician cost
-sustainability principle residency context lodge $200 9 years $93 600 lifetime value vs $350 4 months $5 600 per night rate matters less than the rate the venue can sustain over time this principle drives residency pricing for solo alex see rate card solo duo md for trio ensemble recurring requests the relevant logic is different secure the multi month commitment at private event tier rates do not chase residency tier rates that the cost structure cannot absorb
 cross references
 bolero trio see rate card bolero trio md separate rate card
-solo duo including sourced solo duo see rate card solo duo md
-residency tier framework and engagement type logic see pricing md
-residency pricing decision rationale see council log 2026 04 26 google drive amplifyai strategic council logs pfe
 programming details see programming catalog
 positioning language see strategic positioning copy bank
 objection handling see copy bank objection responses
```

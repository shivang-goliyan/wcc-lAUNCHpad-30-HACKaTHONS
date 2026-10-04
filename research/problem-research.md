# Problem research — WCC Launchpad 30 (Agentic AI track)

Compiled 4 Oct 2026. Every figure carries its source. ⚠ = could not be confirmed against a primary document; don't put it on a slide without re-checking.

---

## 1. What to avoid (already built at 2025–26 hackathons)

Most overused: RAG/doc chat, AI tutor, farmer advisory, govt-scheme finder, mental-health companion, travel planner, resume/interview, legal-doc simplifier, deepfake/misinfo, scam/UPI-fraud *detection*, medical-report explainer, meeting/email agents, sales/SEO agents, deep-research agents, trading agents, chat-to-invoice (Build India 2026 grand prize), blind-assist, browser automation, test generation, DevOps agents, supply-chain risk, voice assistants.

The 2026 wave to avoid — "Indian rights/claims agent" (rules + LLM drafting + approval gate):
- Health-insurance denial appeals: 22+ GitHub agents; **AI for Bharat 2026 student winner BimaSathi** ([YourStory](https://yourstory.com/2026/06/crop-insurance-conversational-analytics-ai-for-bharat-hackathon)); Insurance Samadhan, ClaimBuddy commercially.
- Consumer complaints (NCH/e-Daakhil): Resolved, casepilot, Enchanto, Sunwai, NyayaEngine…; NCH 2.0 adds AI.
- Bail eligibility (s.479 BNSS): BailBandhu, NyBot, NyayaSetu, Bail Reckoner.
- EPFO claim pre-checkers: 5+ at "Build What Moves India" (OpenAI × Varun Mayya, Aug 2026), e.g. [pf-clear](https://github.com/AJ-EN/pf-clear).
- RTI drafting (10+ repos), GST notice replies (15 repos), DPDP scanners (80+), MCP security scanners (30+), MSME invoice recovery (several + Vasuli), UPI-fraud golden-hour reporting (CyberGuard 1930 etc.).

---

## 2. Estate settlement after a death (India) — LOW–MEDIUM saturation

**Scale**
- **₹1.84 lakh crore** unclaimed financial assets — FM Sitharaman, launch of "Aapki Poonji, Aapka Adhikar", 4 Oct 2025 ([Business Today](https://www.businesstoday.in/amp/personal-finance/banking/story/finance-minister-launches-rs-1-84-lakh-crore-unclaimed-assets-campaign-496827-2025-10-04)).
- Indicative split: banks ~₹78k cr, insurance ~₹14k cr, dividends ~₹9k cr, MF ~₹3k cr ([PIB backgrounder, 26 Dec 2025](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/dec/doc20251226745501.pdf)).
- Unclaimed bank deposits transferred to RBI DEA Fund: **₹86,917 cr** as of 30 Jun 2026 (Rajya Sabha) ([Outlook Money](https://www.outlookmoney.com/banking/rs-86917-crore-in-unclaimed-bank-deposits-sbi-accounts-for-largest-share)). Grew 26% in FY24 alone (₹62,225 → ₹78,213 cr) ([Tribune](https://www.tribuneindia.com/news/business/unclaimed-deposits-with-banks-rise-26-626486)).
- IEPF: 1.1 bn+ unclaimed shares worth ₹1 lakh cr+, ~₹6,000 cr dividends ([Business Today](https://www.businesstoday.in/amp/markets/stocks/story/forgotten-shares-govt-portal-lets-you-track-reclaim-unclaimed-investments-dividends-worth-rs-1-lakh-crore-478850-2025-06-03)).
- EPFO inoperative accounts ₹9,330.56 cr; LIC unclaimed ₹7,318.50 cr (31 Mar 2026, Lok Sabha) ([Moneylife](https://moneylife.in/article/lics-unclaimed-funds-rise-to-7318-crore-epfo-inoperative-accounts-hold-9330-crore-govt/81108.html)).
- Unclaimed MF money up 153% in 3 years to ₹3,811 cr (SEBI) ([CafeMutual](https://cafemutual.com/news/industry/38475-unclaimed-mutual-fund-money-rises-153-in-three-years-to-rs-3811-crore)).
- **86.6 lakh deaths registered in 2023 ≈ 23,700 families a day** (CRS 2023) ([Drishti](https://www.drishtiias.com/daily-updates/daily-news-analysis/indias-vital-statistics-report-2023/print_manually)).

**The government's own campaign barely dents it**
- 748-district campaign returned **₹5,777 cr on 22.95 lakh claims (to 28 Feb 2026) ≈ 3%** of ₹1.84 lakh cr ([PIB, 24 Mar 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2244475)).
- Common Landing Portal (unclaimedassetsportal.in, 30 May 2026) is **search-only**, redirects to per-asset portals ([AIR](https://newsonair.gov.in/government-launches-portal-for-search-of-unclaimed-financial-assets/)). UDGAM/IEPF/MITRA only list money **after 7–10 years of dormancy**.
- RBI Inter-Regulatory Working Group is designing a single search-and-claim portal (same PIB release) — future partner/competitor for *dormant* money.

**Why families fail**
- 72.48% of single-holder demat accounts (9.8 cr) had no nominee (SEBI, Feb 2024) ([Moneylife](https://mas360.moneylife.in/article/sebi-report-flags-alarming-lack-of-nominations-in-demat-accounts/4525.html)).
- <10% of Indians write a will (vs 46% US) ([Inc42](https://inc42.com/?p=525285)).
- Govt lists heirs "unable to provide prescribed documents" as a cause of unclaimed money ([Upstox, Aug 2026](https://upstox.com/news/personal-finance/latest-updates/unclaimed-bank-deposits-near-1-lakh-crore-government-lists-steps-to-help-families-recover-forgotten-money/article-198510/)).
- Banks demanded succession certificates even with a valid nominee ([Moneylife](https://moneylife.in/article/rbi-notifies-new-rules-for-settlement-of-deceased-customers-accounts-banks-to-face-penalties-for-delays/78430.html)).
- Succession certificate: 5–7 months, court fee ~3% of asset value (varies by state) ([ABC explainer](https://www.adityabirlacapital.com/abc-of-money/succession-certificate)) ⚠ explainer, not official.
- IEPF: only 75,417 of 1,32,545 claims approved in two years (~57%); govt doesn't track settlement time ([Outlook Money](https://www.outlookmoney.com/personal-finance/unclaimed-funds-in-iepf-over-75000-claims-approved-in-two-years-rs-7782-crore-dividend-refunded)).
- Recovery consultants charge 10–20%; one heir gave up after 3 years ([The Core](https://www.thecore.in/top-stories/bureaucratic-hassles-force-people-take-help-of-recovery-firms-to-claim-unclaimed-deposits-despite-rbi-udgam-portal-2387976)).
- Supreme Court, 17 Mar 2026: "What is wrong if we give the information to the legal heirs?" ([LiveLaw](https://www.livelaw.in/amp/top-stories/why-cant-information-about-unclaimed-bank-accounts-of-dead-persons-be-given-to-heirs-supreme-court-asks-union-rbi-526762)).
- Global benchmark: US families spend ~500 hours over 13 months settling an estate (Empathy) ([Hospice News](https://hospicenews.com/2025/05/30/bereavement-care-company-empathy-raises-72m-in-series-c-round/)).

**New rules the agent can enforce**
- RBI Directions on deceased customers' claims (26 Sep 2025, in force by 31 Mar 2026): settle within **15 days** of complete documents; delay compensation Bank Rate + 4% p.a. (lockers ₹5,000/day); **no succession certificate up to ₹15 lakh** (₹5 lakh co-op banks) ([RBI](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12901)).
- Up to 4 bank nominees from 1 Nov 2025 ([Taxmann](https://www.taxmann.com/post/blog/banking-laws-amendment-allows-up-to-four-nominees/)); up to 10 for demat/MF ([BT](https://www.businesstoday.in/amp/mutual-funds/story/now-mutual-fund-investors-can-add-up-to-10-nominees-check-details-460716-2025-01-14)).
- SEBI 19 Jun 2026: simplified transmission limit ₹30 lakh (demat), probate not required ([Vinod Kothari](https://vinodkothari.com/2026/06/policy-updates-from-sebi-june-meeting-highlights/)).

**Discovery channel nobody uses:** a legal heir can register on the income-tax e-filing portal as representative of the deceased ("Deceased (Legal heir)") and view **Form 26AS and AIS** — which list interest-paying bank accounts/FDs, dividends, MF and securities transactions against the PAN ([ClearTax](https://cleartax.in/s/file-income-tax-return-for-deceased-by-legal-heir), [TaxBuddy](https://www.taxbuddy.com/blog/itr-for-deceased-person-legal-heir-filing-process)). The heir also has to file the deceased's final ITR anyway.

**Existing solutions:** India — Yellow, WillJini, AasaanWill (wills, *before* death); FOLO (net-worth prep, ₹10 cr pre-seed); FinPeace (counsellor-led); recovery consultants (Share Samadhan, Recoversy, 10–20%). Global — Empathy ($162M raised), Life Ledger (UK death notifications), Alix, Elayne. None start from a death certificate and find *live* Indian accounts, and none handle legal-heir certificate / IEPF-5 / Indian claim forms.
**Hackathons:** one lablab project, Estate Settlement Crew (Jun 2026, Malaysia-oriented) ([lablab](https://lablab.ai/submissions/ip1m8ba53blhr5vged4gud2i)). No India-specific winner found.

---

## 3. RERA delay enforcement for homebuyer groups — nothing found on GitHub/Devpost

- **27.6 lakh homebuyers stuck in delayed RERA-registered projects, ~₹12.44 lakh crore locked** (FPCE, 9 Sep 2026, from MoHUA tracker) ([ETV Bharat](https://www.etvbharat.com/en/business/homebuyers-body-fpce-says-27-dot-6-lakh-customers-stuck-with-delayed-rera-registered-projects-enn26090904794)). FPCE says authorities grant extensions without the statutory checks.
- ~60k complaints at UP RERA, ~34.5k at MahaRERA ⚠ ([realtyhunting](https://realtyhunting.com/rera-10-years-homebuyer-impact-2026/)).
- Agent work: watch one state portal (QPRs, extensions, hearings), compute s.18 interest per buyer, assemble group complaints, track adjournments, escalate to recovery certificates. Build for one state only.

---

## 4. Job-exit settlement (Labour Codes + EPFO) — EPFO part saturated, Labour-Code part open

- Final wages due within **2 working days** (Code on Wages s.17(2), from 21 Nov 2025) ([Nexdigm](https://www.nexdigm.com/media/in-the-news/2-day-full-and-final-settlement-post-employees-resignation-now-mandatory-under-labour-codes-what-it-means-for-employers/)); fixed-term gratuity after 1 year.
- EPFO FY25: 796 lakh claims, 174 lakh rejected (~22%) ([Business Today](https://www.businesstoday.in/personal-finance/news/story/epfos-instant-pf-withdrawal-promise-has-a-catch-one-in-five-claims-still-gets-rejected-541466-2026-07-07)); 16 lakh+ grievances ([AIR](https://www.newsonair.gov.in/epfo-urges-members-to-use-portal-for-free-secure-online-services)).
- ~16.4 lakh members exit/rejoin monthly ([BS](https://www.business-standard.com/amp/economy/news/epfo-adds-2-1-mn-members-in-july-2025-youth-account-for-61-of-growth-125092300519_1.html)) → ~2 crore switches/yr ⚠ extrapolation.

---

## 5. Cyber-fraud money restoration (post-freeze) — reporting side saturated, restoration side not seen

- 2024: ₹22,845.73 cr lost, 19.18 lakh complaints, +206% (Lok Sabha) ([Inc42](https://inc42.com/buzz/indians-lost-inr-22845-cr-to-cyber-fraud-in-2024-govt)). 2025: 24 lakh complaints, ₹22,495 cr ([FPJ](https://www.freepressjournal.in/amp/mumbai/over-24-lakh-cyber-complaints-22495-crore-fraud-reported-in-2025)).
- 2021–May 2026: ₹64,447 cr reported, ₹10,718 cr frozen, **only ₹323 cr refunded** ⚠ (Indian Express on MHA review) ([Outlook Money](https://www.outlookmoney.com/news/cyber-fraud-complaints-continue-to-rise-maharashtra-records-highest-losses)).
- MHA SOP Jan 2026: refunds <₹50k without court order; Money Restoration Module live Apr 2026 ([Drishti](https://www.drishtiias.com/daily-updates/daily-news-analysis/mhas-new-sop-on-cyber-financial-frauds/print_manually)). RBI 24 Jun 2026: 85% compensation up to ₹25k from 1 Jan 2027 ([RBI](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=63011)).

---

## 6. Other verified data (for reference)

- Health claims not paid FY24: ₹26,037.65 cr (Lok Sabha) ([Moneylife](https://moneylife.in/article/health-insurance-claims-worth-rs2603765-crore-rejected-by-insurers-in-fy2324-govt/76282.html)). Health = 61.5% of Insurance Ombudsman complaints (32,655 / 53,102) ([CIO AR 2024-25](https://cioins.co.in/annualreports/AnnualReport2024-2025.pdf)). LocalCircles Mar 2026: 44% rejected or partly approved for invalid reasons ([Moneylife](https://moneylife.in/article/health-insurance-premiums-rise-sharply-while-claim-experiences-remain-difficult-finds-localcircles-survey/79872.html)).
- RBI Ombudsman FY25: 13,34,244 complaints, +13.55% ([RBI](https://rbi.org.in/Scripts/PublicationsView.aspx?id=23441)). PSBs collected ₹11,535.99 cr minimum-balance penalties FY21–25 ([Onmanorama](https://www.onmanorama.com/news/business/2026/02/09/minimum-balance-charges-banks.html)).
- CBAM: steel+aluminium exports to EU fell 24.4% in FY25 (GTRI) ([Maritime Gateway](https://www.maritimegateway.com/eu-carbon-tax-from-2026-set-to-dent-indias-steel-aluminium-exports-gtri)); commercial players already serve 200+ exporters (CleanCarbon.ai).

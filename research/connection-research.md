# Research round 2 — new city, elderly parents, mental health

Compiled 4 Oct 2026. ⚠ = secondary/snippet source; re-check before it goes on a slide.

## The pattern across all three domains

- **Saturated:** chat companions. "Elderly companion" 410 GitHub repos since 2025; fall detection 470; medication reminders 256; mental-health chatbots everywhere (Gen AI Exchange 2025 winner YouthMind). Indian elder voice companions are already shipped products (Saathi AI, JunoDost on Product Hunt). PG finders 590 repos, roommate matching 482 since 2025.
- **Open:** agents that act in the real world to get people to *real people* and follow through over weeks. "Elderly siblings caregiving coordination" and "longitudinal conversation drift" returned 0 repos. No newcomer product follows through, makes consented introductions, or measures belonging.
- **Design thesis backed by data:** 57% of Indians 13–35 use AI to cope with stress/loneliness; 42% say they're now less likely to approach friends/family; 67% worry AI increases isolation (Youth Ki Awaaz × YLAC, n=500+, Aug 2025) ([Storyboard18](https://www.storyboard18.com/digital/-79275.htm)). OpenAI × MIT Media Lab (Mar 2025): heaviest chatbot users were lonelier and socialised less ([Fortune](https://fortune.com/2025/03/24/chatgpt-making-frequent-users-more-lonely-study-openai-mit-media-lab)).

## Moving to a new city

- 40.2 crore internal migrants (28.88% of population), top destinations incl. Mumbai, Bengaluru Urban, Hyderabad (EAC-PM "400 Million Dreams", Dec 2024) ([Drishti](https://www.drishtiias.com/summary-of-important-reports/eac-pm-report-on-domestic-migration-1/print_manually)).
- 21% of higher-ed students study outside their home state (British Council/Kantar 2021) ([PDF](https://opportunities-insight.britishcouncil.org/download/data/44337/18339)); × AISHE 4.33 cr ≈ 90 lakh ⚠ extrapolation.
- Fresher engineering hiring expected >1.5 lakh in FY26 (TeamLease) ([Outlook Business](https://www.outlookbusiness.com/news/fresher-hiring-in-tech-to-double-in-fy26-it-sector-leads-with-53-growth)).
- ~60% of Indians feel at least a little lonely — highest of 7 countries (Meta-Gallup 2022) ([360info](https://360info.org/the-other-half-who-do-the-lonely-turn-to-for-help)).
- 35% of urban singles 18–45 feel lonely often/always; 55% too exhausted to socialise; 58% "connected online, lonely in real life" (Match-Ipsos, n=1,000, Sep 2026) ([Indian Television](https://indiantelevision.com/mam/in-a-world-of-endless-swipes-35-per-cent-of-indian-singles-still-feel-lonely/)).
- 56% of young workers admit loneliness (64% women), most acute among migrants 25–35 in Bengaluru/Gurugram/Pune/Hyderabad/Chennai ⚠ original not found ([InsightsIAS](https://www.insightsonindia.com/2025/09/10/loneliness-indias-working-young/)).
- Only 16% of young men would first talk to someone they trust (Dil Dosti Data 2, n=3,072, May 2026) ([RNP](https://rohininilekaniphilanthropies.org/?p=3537)).
- PG trust deficit: 58/61 seekers distrust listing photos; ~half found hidden charges (InstaDwell, Jul 2026) ([PropNewsTime](https://propnewstime.com/latestnewsstories/MzI0MzY=/trust-deficit-dominates-india-s-pg-market-as-tenants-reject-online-listings-study-finds)).
- Existing: Bumble BFF (groups relaunch Sep 2025), Misfits (₹5 cr seed), Timeleft, Meetup — all marketplaces where the lonely user must initiate. No data on "time to feel settled" in India → our survey fills it.

## Elderly parents living alone

- 60+ population 138M (2021) → 194M (2031) (NSO) ([ThePrint](https://theprint.in/india/indias-elderly-population-to-rise-41-over-next-decade-to-touch-194-mn-in-2031-govt-report/710476/)); 20.8% of India by 2050 (UNFPA 2023) ([UNFPA](https://india.unfpa.org/en/news/india-ageing-elderly-make-20-population-2050-unfpa-report)).
- LASI Wave 1 ([factsheet](https://www.iipsindia.ac.in/sites/default/files/other_files/LASI_W1_Elderly_India.pdf)): 5.7% live alone + 20.3% spouse-only/others ≈ 1 in 4 with no child at home; 54% of elderly women widowed; **depression 8.3% measured vs 0.8% diagnosed**; 22.9% fell in past 2 years; 48% have an IADL limitation; 39.6% literate.
- 35% are empty nesters, 36% have a migrant child; empty nesters report more depression (SSM Pop Health 2023) ⚠ abstract ([DOAJ](https://doaj.org/article/21e89c2cf6774729b4eda9635689bbf5)).
- Only 41% own a smartphone, 13% use internet (HelpAge India 2025, urban n=5,798) ([HelpAge](https://www.helpageindia.org/news/helpage-india-report-calls-for-strengthening-intergenerational-bonds/)) → voice-call-first, no app for the elder.
- Polypharmacy 49% (meta-analysis) ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8173298/)).
- Elders with no social participation: 2.44× odds of ADL limitation ([BMC PH 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10636804/)).
- Existing: Elder Line 14567 (elder must call in), Emoha/Samarth/Anvayaa (paid human desks, metro), Saathi AI / JunoDost (voice check-in + reminders + family update — already shipped).

## Mental health (non-therapy angles)

- Treatment gap 70–92% (NMHS 2015–16) ([IJP](https://pmc.ncbi.nlm.nih.gov/articles/PMC5419008/)).
- 14,488 student suicides in 2024, record high ⚠ ([The Wire](https://thewire.in/education/rising-student-deaths-by-suicide-what-the-2024-ncrb-report-shows)).
- SC National Task Force (2.43 lakh students, 2,119 HEIs, Jun 2026): 65% of institutions give no access to any MH provider; <4% have a suicide-risk protocol ([Vajiram](https://vajiramandravi.com/current-affairs/findings-of-supreme-court-appointed-national-task-force-ntf-on-student-mental-health-and-suicides/)).
- 49% drop out after first contact (Cureus 2024, n=883) ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10955436/)).
- Tele-MANAS 43.25 lakh calls by Aug 2026 ([SPIF](https://spif.in/blog/student-mental-health-parliament-2026)).
- AI-companion harms: Character.AI/Google settled 5 teen-harm suits (Jan 2026) ([Fortune](https://fortune.com/2026/01/08/google-character-ai-settle-lawsuits-teenage-child-suicides-chatbots)); Illinois bans AI therapy but allows admin tasks like scheduling ([HealthJournalism](https://healthjournalism.org/blog/2025/08/states-crack-down-on-ai-for-behavioral-health-care)); California SB 243 requires AI disclosure + crisis protocol.
- Design implications: no therapy/diagnosis; logistics + connection only; success = hours with real people, not chat minutes; rule-based crisis handoff to Tele-MANAS 14416 / 112; AI disclosure; 18+ MVP; approval for every send.

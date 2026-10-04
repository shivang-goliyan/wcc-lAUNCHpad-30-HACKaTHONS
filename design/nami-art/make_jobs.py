"""Write the production Wan job lists, split over the four Modal accounts.

  python make_jobs.py  -> jobs-0.json .. jobs-3.json
"""
import json

STYLE = ("3D animated cartoon otter mascot named Nami with soft cocoa-brown fur, cream belly and a sea-green knitted "
         "scarf, on a plain flat grey background. Static camera, fixed framing, consistent soft lighting, smooth natural "
         "Pixar-style character animation.")

T = lambda a, b, act, n=33: {"name": f"{a}~{b}", "first": f"_full/{a}.png", "last": f"_full/{b}.png", "frames": n,
                             "prompt": f"{STYLE} {act}"}
L = lambda p, act, n=49: {"name": f"{p}@loop", "first": f"_full/{p}.png", "last": f"_full/{p}.png", "frames": n,
                          "prompt": f"{STYLE} {act} The animation starts and ends in exactly the same pose so it loops seamlessly."}

jobs = [
    # transitions out of the seated idle pose
    T("idle", "greeting", "She lifts her right paw and gives a small friendly wave, smile widening."),
    T("idle", "listening", "She tilts her head attentively and raises one paw up to her ear to listen."),
    T("idle", "thinking", "She brings up a small notebook to her chest and looks up thoughtfully."),
    T("idle", "speaking", "She starts talking warmly, opening one paw in an explaining gesture."),
    T("idle", "reminder", "She lifts a round clock card up to her chest to show it."),
    T("idle", "acknowledged", "She gives a gentle happy nod and closes her eyes in a smile."),
    T("idle", "calling", "She lifts a small phone up to her ear and listens."),
    T("idle", "help", "She sits up taller and reaches one paw forward in a calm supportive gesture."),
    T("idle", "quiet", "She relaxes, gets sleepy, slowly closes her eyes and settles down to rest."),
    T("idle", "point-left", "She turns and stretches her arm out to point to the left."),
    T("idle", "point-right", "She turns and stretches her arm out to point to the right."),
    T("idle", "celebrate", "She throws both paws up in the air with a joyful laugh."),
    T("idle", "heart", "She brings a soft red heart up to her chest and hugs it warmly."),
    T("idle", "stand", "She stands up from sitting onto her hind legs, smooth and easy.", 41),
    T("stand", "walk", "She turns to the right and takes her first step, starting to walk.", 25),
    T("stand", "walk-left", "She turns to the left and takes her first step, starting to walk.", 25),
    # half cycles that make the walk loops
    T("walk", "walk-b", "She takes one walking step forward, legs and arms swinging naturally, body bobbing gently.", 13),
    T("walk-b", "walk", "She takes one walking step forward, legs and arms swinging naturally, body bobbing gently.", 13),
    T("walk-left", "walk-left-b", "She takes one walking step forward, legs and arms swinging naturally, body bobbing gently.", 13),
    T("walk-left-b", "walk-left", "She takes one walking step forward, legs and arms swinging naturally, body bobbing gently.", 13),
    T("greeting", "greeting-b", "She waves her raised paw from side to side, cheerful.", 9),
    # living loops
    L("idle", "She sits calmly, breathes gently, blinks once, her ears twitch and whiskers move slightly. Subtle idle life."),
    L("listening", "She listens closely with her paw at her ear, nods slightly once and blinks. Subtle."),
    L("thinking", "She holds her notebook and looks up thinking, taps the notebook once and blinks. Subtle."),
    L("calling", "She holds the phone to her ear, listening and nodding gently, blinks once. Subtle."),
    L("reminder", "She holds the clock card up, sways a little and blinks. Subtle."),
    L("help", "She stays calm and attentive with her paw extended, breathing steadily and blinking. Very subtle."),
    L("quiet", "She sleeps peacefully, her chest rising and falling slowly with each breath. Very subtle."),
    L("swim", "She floats on her back, paddling her feet gently and bobbing up and down as if on water."),
    L("celebrate", "She bounces happily with both paws up, laughing."),
]

for i in range(4):
    json.dump(jobs[i::4], open(f"jobs-{i}.json", "w"), indent=1)
print(len(jobs), "jobs ->", [len(jobs[i::4]) for i in range(4)])

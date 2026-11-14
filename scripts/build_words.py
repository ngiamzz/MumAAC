"""Build src/data/words.json: common English words with a frequency score.

Run once with `pip install wordfreq`; the output is committed so the app needs
no network. Score is wordfreq's Zipf value (log10 per billion words).
"""
import json, re, pathlib
from wordfreq import top_n_list, zipf_frequency

BLOCK = set("fuck fucking shit sex porn bitch damn ass dick pussy cock cunt fucked "
            "nigga nigger whore slut sexy nude naked rape kill killed gay lol omg wtf "
            "lmao bro dude".split())
# Words a person in care needs often but general text under-ranks.
CARE = ("pain hurt toilet water drink hungry thirsty tired cold hot help medicine "
        "doctor nurse bed sleep yes no please thank thanks sorry love home tv phone "
        "glasses itchy sick dizzy wash shower blanket pillow tea coffee rice soup "
        "bathroom pee poo walk sit stand lie turn light fan music quiet").split()

out, seen = [], set()
for w in top_n_list("en", 8000):
    if not re.fullmatch(r"[a-z]+", w) or w in BLOCK or w in seen:
        continue
    if len(w) == 1 and w not in ("a", "i"):
        continue
    seen.add(w)
    out.append([w, round(zipf_frequency(w, "en"), 2)])
    if len(out) >= 3000:
        break
for w in CARE:
    z = round(max(zipf_frequency(w, "en"), 5.0), 2)
    if w in seen:
        for row in out:
            if row[0] == w:
                row[1] = max(row[1], z)
    else:
        out.append([w, z]); seen.add(w)
path = pathlib.Path(__file__).resolve().parent.parent / "src/data/words.json"
path.write_text(json.dumps(out, separators=(",", ":")))
print(len(out), "words ->", path)

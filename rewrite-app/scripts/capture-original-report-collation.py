"""Capture comparison orders from the qualified Original PostgreSQL container.

Uses only read-only SELECTs, never Source application edits, table seeds or DAO
substitutes. Run the Node verifier against the resulting fresh directory.
"""
import argparse
import base64
import hashlib
import itertools
import json
from pathlib import Path
import random
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("container")
parser.add_argument("output", type=Path)
parser.add_argument("--generate-only", action="store_true")
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=False)
ascii_chars = [chr(value) for value in range(32, 127)]
corpus = [""] + ascii_chars + ["".join(parts) for size in (2, 3)
                              for parts in itertools.product(ascii_chars, repeat=size)]
seeds = ['a','A','á','a\u0301','ä','a\u0308','ae','æ','Æ','ß','ss','SS','-','_',' ','\t','\n','\r','Ω','ω','😀','👩\u200d💻','❤','❤️','한','한','क','क्ष','क्\u200dष','ا','أ','ب','׳','ש','שָׁ','\u200b','\u2060','\U000f0000','\U0010ffff','\ufb03','ffi','\u034f','\u202e']
corpus += ["".join(parts) for size in (1, 2, 3)
           for parts in itertools.product(seeds, repeat=size)]
rng = random.Random(49137657)
for _ in range(30000):
    points = []
    for _ in range(1 + rng.randrange(50)):
        point = rng.randrange(1, 0x110000 - 0x800)
        points.append(chr(point + 0x800 if point >= 0xD800 else point))
    corpus.append("".join(points))
payload = json.dumps(corpus, ensure_ascii=False, separators=(",", ":")).encode()
digest = hashlib.sha256(payload).hexdigest()
assert digest == "0d78985f0c8ffbec7d19dbc1baed2127339269f74126285d2529275bf022a3c7"
(args.output / "corpus.json").write_bytes(payload)
receipt = {"compoundCount": len(corpus), "scalarCount": 1112063,
           "corpusSha256": digest, "readOnly": True, "generateOnly": args.generate_only}
if not args.generate_only:
    info = json.loads(subprocess.check_output(["docker", "inspect", args.container]))[0]
    assert info["State"]["Running"]
    archive = subprocess.check_output(["docker", "exec", args.container, "cat", "/usr/lib/locale/locale-archive"])
    receipt["localeArchiveSha256"] = hashlib.sha256(archive).hexdigest()
    assert receipt["localeArchiveSha256"] == "4c3b8c3ae5e03113701a5e760ca2135573679e212e048a578d04c1651cee43c0"
    receipt["image"] = info["Image"]
    receipt["containerId"] = info["Id"]
    metadata_sql = "SELECT datlocprovider,datcollate,datctype,datcollversion,pg_database_collation_actual_version(oid) FROM pg_database WHERE datname=current_database();"
    command = ["docker", "exec", "-i", args.container, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "source_oracle", "-d", "source_oracle"]
    metadata = subprocess.check_output(command, input=metadata_sql.encode()).decode().strip()
    assert metadata == "c|en_US.utf8|en_US.utf8|2.41|2.41"
    receipt["databaseProfile"] = metadata
    queries = {
        "scalars.txt": "BEGIN READ ONLY; SELECT cp FROM generate_series(1,1114111) AS g(cp) WHERE cp NOT BETWEEN 55296 AND 57343 ORDER BY CASE WHEN cp BETWEEN 55296 AND 57343 THEN NULL ELSE chr(cp) END; ROLLBACK;",
        "compounds.hex": "BEGIN READ ONLY; SELECT encode(convert_to(value,'UTF8'),'hex') FROM jsonb_array_elements_text(convert_from(decode('" + base64.b64encode(payload).decode() + "','base64'),'UTF8')::jsonb) AS t(value) ORDER BY value; ROLLBACK;"
    }
    receipt["orders"] = {}
    for filename, sql in queries.items():
        started = time.monotonic()
        target = args.output / filename
        with target.open("wb") as output, (args.output / (filename + ".stderr")).open("wb") as error:
            subprocess.run(command, input=sql.encode(), stdout=output, stderr=error, check=True)
        receipt["orders"][filename] = {"sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                                       "elapsedSeconds": time.monotonic() - started}
    assert subprocess.check_output(command, input=metadata_sql.encode()).decode().strip() == metadata
    assert hashlib.sha256(subprocess.check_output(["docker", "exec", args.container, "cat", "/usr/lib/locale/locale-archive"])).hexdigest() == receipt["localeArchiveSha256"]
(args.output / "capture.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))

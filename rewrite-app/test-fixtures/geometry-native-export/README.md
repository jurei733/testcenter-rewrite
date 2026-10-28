# Native geometry export regression

`responses.json` contains the six Unit records for the first simulated person
from the local 1,000-person, grade-8 geometry pilot. Only Unit identities,
response parts and saved state are retained; participant logins, passwords,
tokens and environment files are excluded.

The nine values exercise numeric responses, a checkbox array, classifications
and free text. The archive regression writes these parts to native storage with
an empty canonical `unitResponses` object, then compares all parts and client
clocks after export and durable reopen. It also checks stored person suffixes,
booklet names, group isolation and rejection of unknown native history.

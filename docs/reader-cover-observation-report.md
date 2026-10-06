# Reader cover observation — blocked preflight

2026-10-06, handoff ee02a11f82b46cc14fa4ec4c8a944827b1fc0754 from
codex/metadata-diagnostics. Requirements OPDS-005, AUTH-001, SOURCE-002/003,
ARCH-001, ACCEPT-001. Prior server receipts and owner feedback were read.

Expected active a55334694d3eff8fcac6a489d965c5fe3de05ab3 confirmed ready.
Read-only preflight: OPDS PID3711018/NRestarts0/active;
bot PID3950811/NRestarts0/active. The bot PID differs from the earlier metadata
receipt; no capture interval took place and that change is not attributed to
this task. Receipt: `reader-cover-observation-preflight.json`.

## Exact blocker

Installed command inventory finds only `/usr/bin/tcpdump` among the checked
capture tools. tshark, dumpcap, tcpflow, ngrep and httpry are absent from PATH;
dpkg-query also reports no tshark/wireshark-common/tcpflow/ngrep packages.
Python scapy/dpkt/pyshark are absent. No suitable existing HTTP reassembly/
request-reference decoder was found.

tcpdump alone cannot provide the required HTTP-message reassembly and
request/response reference correlation. Raw ASCII output or packet files could
expose Basic headers or image bodies; packet/timing-based matching would not
satisfy reused connections, split headers and unrelated requests. No ad-hoc
packet parser or raw capture was substituted for the required decoder.

The handoff explicitly says: "Do not install packages or change units/config
here" and, when the available tool cannot safely provide evidence, "Propose a
separately reviewed minimal logging change". Applied that fallback. No package
installation, production edit, source probe, env read or packet capture occurred.
The180s window never started, so no owner action/capture/drop/absence evidence
is claimed. No sanitizer was tested or observer presented as executed.

## Next bounded proposal

`reader-cover-observation-logging-proposal.md` describes minimal, default-off,
time-limited origin request/status telemetry for review. It includes required
privacy/correlation tests before any implementation or release. This is a
proposal, not a new normative spec or authorization to deploy. It can establish
whether matching entry/cover requests reach the origin and their status,
including401 challenges/retries. It cannot establish full image delivery or
reader decoding, and no observations would identify a phone without the
controlled owner window.

META-01 remains unaccepted. Current next hypothesis to distinguish: a cover
request either fails at origin (for example an unmatched auth challenge) or
does not reach origin; neither is established. A200 would instead leave
downstream delivery/reader handling open. No renderer/auth/listing fix proposed
as a conclusion. Results returned through codex/reader-cover-observation-evidence;
no dirty/unmerged worktrees or unrelated files removed.

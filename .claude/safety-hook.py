#!/usr/bin/env python3
"""PreToolUse hook for Bash. Blocks irrecoverable patterns that prefix-only
permission rules can't catch reliably (mid-string flags, pipes, etc.).

Output contract: print a JSON deny decision and exit 0 to block; exit 0 with
no output to allow. Never raise — silent pass-through is the safe default."""
import json, re, sys

DENY = [
    (r"\|\s*(sudo\s+)?(sh|bash|zsh|fish)(\s|$)",          "pipe-to-shell"),
    (r"--no-verify\b",                                     "--no-verify (skips git hooks)"),
    (r"--no-gpg-sign\b",                                   "--no-gpg-sign (skips signing)"),
    (r"\bgit\s+push\b[^&;|]*\s(-f|--force)\b",             "git push --force"),
    (r"\brm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+/(\s|$)",           "rm -rf /"),
    (r"\brm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+(/\*|~|~/|\$HOME)", "rm -rf of home/root"),
    (r"--no-preserve-root\b",                              "--no-preserve-root"),
    (r"\bsudo\s+rm\s+-[a-zA-Z]*r",                         "sudo rm -r..."),
    (r"\bdd\b[^|;&]*\bof=/dev/(sd|nvme|hd|xvd|disk)",      "dd to block device"),
    (r"\bmkfs(\.[a-z0-9]+)?\b",                            "mkfs (format filesystem)"),
    (r":\(\)\s*\{[^}]*:\s*\|\s*:",                         "fork bomb"),
    (r"\bchmod\s+-R\s+0?777\s+/(\s|$)",                    "chmod -R 777 /"),
    (r">\s*/dev/(sd|nvme|hd)[a-z]",                        "redirect to block device"),
    (r"(^|[\s;&|])(\.|source)\s+<\(\s*curl",               "source <(curl ...)"),
    (r"\.claude/settings\.json",                           "writing to ~/.claude settings"),
    (r"/\.claude/\.credentials",                           "touching Claude credentials"),
    (r"\.ssh/(id_|authorized_keys)",                       "touching SSH keys"),
]

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    cmd = (payload.get("tool_input") or {}).get("command", "") or ""
    for pattern, label in DENY:
        if re.search(pattern, cmd):
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Safety hook blocked: {label}",
                }
            }))
            return

if __name__ == "__main__":
    main()

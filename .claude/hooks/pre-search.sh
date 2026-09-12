#!/usr/bin/env bash
# Pre-search hook: suggests codegraph over raw grep when knowledge graph exists.
# Invoked by Claude Code's PreToolUse hook on Bash commands containing grep/find/etc.

CMD="${1:-}"

case "$CMD" in
  *grep*|*"rg "*|*ripgrep*|*"find "*|*"fd "*|*ack*|*" ag "*)
    if [ -f .codegraph/graph.db ]; then
      echo "codegraph: Index available. Prefer codegraph_search/codegraph_context over raw search for symbol lookups."
    fi
    ;;
esac

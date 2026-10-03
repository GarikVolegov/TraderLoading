# Nightshift — helper API GitHub. Da sourcare DOPO config.sh.
# Richiede: curl, node, PAT nel credential helper git. Il PAT non va MAI stampato/loggato.

gh_pat() {
  printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p'
}

gh_api() { # gh_api METHOD PATH [FILE_JSON_BODY]
  local method="$1" apipath="$2" body="${3:-}"
  local args=(-sS -X "$method" \
    -H "Authorization: Bearer $(gh_pat)" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com$apipath")
  [[ -n "$body" ]] && args=("${args[@]}" -H "Content-Type: application/json" --data-binary "@$body")
  curl "${args[@]}"
}

gh_open_prs() { # stampa: "<numero>\t<branch di testa>" per ogni PR aperta
  gh_api GET "/repos/$GITHUB_REPO/pulls?state=open&per_page=50" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))console.log(p.number+"\t"+p.head.ref)})'
}

gh_pr_diff() { # gh_pr_diff NUMERO
  curl -sS -H "Authorization: Bearer $(gh_pat)" -H "Accept: application/vnd.github.v3.diff" \
    "https://api.github.com/repos/$GITHUB_REPO/pulls/$1" | head -c 200000
}

gh_pr_reviewed() { # exit 0 se la PR ha già la review nightshift
  gh_api GET "/repos/$GITHUB_REPO/issues/$1/comments?per_page=100" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{process.exit(JSON.parse(s).some(c=>(c.body||"").includes("<!-- nightshift-review -->"))?0:1)})'
}

gh_comment() { # gh_comment NUMERO FILE_BODY_MD
  node -e 'const fs=require("node:fs");process.stdout.write(JSON.stringify({body:fs.readFileSync(process.argv[1],"utf8")}))' "$2" > "$2.json"
  gh_api POST "/repos/$GITHUB_REPO/issues/$1/comments" "$2.json" > /dev/null
  rm -f "$2.json"
}

gh_create_pr() { # gh_create_pr BRANCH TITLE FILE_BODY_MD → stampa html_url
  node -e 'const fs=require("node:fs");const [b,t,f,base]=process.argv.slice(1);process.stdout.write(JSON.stringify({head:b,base,title:t,body:fs.readFileSync(f,"utf8")}))' \
    "$1" "$2" "$3" "$BASE_BRANCH" > "$3.json"
  local out rc=0
  out=$(gh_api POST "/repos/$GITHUB_REPO/pulls" "$3.json" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.html_url){console.error("PR non creata: "+(r.message||s.slice(0,300)));process.exit(1)}console.log(r.html_url)})') || rc=1
  rm -f "$3.json"
  [[ $rc -eq 0 ]] && printf '%s\n' "$out"
  return $rc
}

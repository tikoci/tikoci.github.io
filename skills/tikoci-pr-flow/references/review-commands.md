# Review commands

The `gh` commands behind [tikoci-pr-flow](../SKILL.md), run from inside the
repo's checkout. `gh` fills in `{owner}` and `{repo}` from the checkout, so
the commands copy unchanged between repos. `gh` does not fill in the PR
number; set it once:

```sh
N=123
```

## Open and label

```sh
gh pr create --draft --title "Short imperative subject" --body-file .scratch/pr-body.md
gh pr create --draft --label skip-review ...   # docs, nits, a bump
gh pr ready "$N"                                # after the cross-review
```

## Read every finding

Inline threads, unresolved only, with their ids and every comment in full:
read the whole finding before acting on it. The query reads 100 threads and
50 comments per thread at a time, and prints the cursor for the rest: run it
again with `-F after=<cursor>` for more threads, and use the second command
for more comments in one thread.

```sh
gh api graphql -F owner='{owner}' -F name='{repo}' -F pr="$N" -f query='
query($owner:String!,$name:String!,$pr:Int!,$after:String){
  repository(owner:$owner,name:$name){pullRequest(number:$pr){
    reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor}
      nodes{id isResolved isOutdated path line originalLine
        comments(first:50){pageInfo{hasNextPage endCursor} nodes{author{login} url body}}}}}}}' \
  --jq '.data.repository.pullRequest.reviewThreads
        | (if .pageInfo.hasNextPage then "more threads: -F after=\(.pageInfo.endCursor)" else empty end),
          (.nodes[] | select(.isResolved==false)
           | "== \(.id) \(.path):\(.line // .originalLine) outdated=\(.isOutdated)",
             (if .comments.pageInfo.hasNextPage then "more comments: -f t=\(.id) -f c=\(.comments.pageInfo.endCursor)" else empty end),
             (.comments.nodes[] | "[\(.author.login)] \(.url)\n\(.body)\n"))'

# More comments in one thread, with the -f t= and -f c= values printed above.
gh api graphql -f t=THREAD_ID -f c=CURSOR -f query='
query($t:ID!,$c:String){node(id:$t){... on PullRequestReviewThread{
  comments(first:50,after:$c){pageInfo{hasNextPage endCursor} nodes{author{login} url body}}}}}' \
  --jq '.data.node.comments | (.nodes[] | "[\(.author.login)] \(.url)\n\(.body)\n"),
        (if .pageInfo.hasNextPage then "more comments: -f c=\(.pageInfo.endCursor)" else empty end)'
```

Review bodies (where CodeRabbit puts comments outside the diff) and
conversation comments:

```sh
gh api --paginate "repos/{owner}/{repo}/pulls/$N/reviews" \
  --jq '.[] | select((.body // "") != "") | "\(.user.login) \(.commit_id[0:7]) \(.state)\n\(.body)\n"'
gh api --paginate "repos/{owner}/{repo}/issues/$N/comments" \
  --jq '.[] | "\(.user.login) \(.created_at)\n\(.body)\n"'
```

## Post a review

A review with inline comments, from a JSON file (located findings in
`comments`, cross-cutting points in `body`). `line` is the line number in the
new file, on the right side of the diff; the commit is the head you read.
A comment's `line` must fall inside a diff hunk: one line outside fails the
whole POST (422, the line cannot be resolved), and every comment is lost
with it. A finding about unchanged code goes in `body`.

```sh
cat > .scratch/review.json <<'JSON'
{
  "commit_id": "FULL_HEAD_SHA",
  "event": "COMMENT",
  "body": "Reviewer: codex/gpt-6.1-sol (high) · head abc1234 · goal: <what it looked for>\n\nSummary.",
  "comments": [
    { "path": "src/example.ts", "line": 42, "side": "RIGHT", "body": "[P2] The finding, its evidence and the fix." }
  ]
}
JSON
gh api -X POST "repos/{owner}/{repo}/pulls/$N/reviews" --input .scratch/review.json --jq .html_url
```

## Reply and resolve

One call replies with the fixing commit and resolves the thread:

```sh
gh api graphql -f t=THREAD_ID -f b='Fixed in abc1234: <what changed>.' -f query='
mutation($t:ID!,$b:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{id}}
  resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' \
  --jq '.data.resolveReviewThread.thread.isResolved'
```

For a declined finding, the reply gives the evidence instead of a commit (the
command run and its output, the doc, the source line); for a tracked one, the
follow-up issue or BACKLOG.md item.

## Which commits were reviewed

A review's `commit_id` is the head it saw. Compare it with the PR head; the
commits after it got no review. Ignore reviews with an empty body, whose
`commit_id` says nothing about coverage.

```sh
gh api --paginate "repos/{owner}/{repo}/pulls/$N/reviews" \
  --jq '.[] | select((.body // "") != "") | "\(.user.login) \(.commit_id[0:7]) \(.submitted_at)"'
gh pr view "$N" --json headRefOid --jq '.headRefOid[0:7]'
```

## Ready to merge

```sh
gh pr view "$N" --json mergeStateStatus,reviewDecision,statusCheckRollup \
  --jq '{mergeStateStatus, reviewDecision, not_ok: [.statusCheckRollup[]
    | (.conclusion // .state // "PENDING") as $s
    | select(["SUCCESS","SKIPPED","NEUTRAL"] | index($s) | not)
    | "\(.name // .context)=\($s)"]}'
```

`not_ok` lists every check that has not passed: failed, cancelled, timed
out, still running, or waiting for approval. Commit statuses carry `context`
and `state` instead of `name` and `conclusion`. `SKIPPED` and `NEUTRAL` count
as passing, which is also how a skipped or rate-limited CodeRabbit check
reports, so read the reviews, not the check (see above).

`CLEAN` means the checks pass and every thread is resolved. `BLOCKED` with
passing checks usually means an unresolved thread; `reviewDecision` stays
empty while every review is `COMMENTED`.

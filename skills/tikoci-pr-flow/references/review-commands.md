# Review commands

<!-- cspell:ignore Oid -->

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
read the whole finding before acting on it. The query reads the first 100
threads and 50 comments per thread; it prints `more threads` or `more
comments` when there are more, and then you page with `after:` on the
`endCursor`.

```sh
gh api graphql -F owner='{owner}' -F name='{repo}' -F pr="$N" -f query='
query($owner:String!,$name:String!,$pr:Int!){
  repository(owner:$owner,name:$name){pullRequest(number:$pr){
    reviewThreads(first:100){pageInfo{hasNextPage endCursor}
      nodes{id isResolved isOutdated path line originalLine
        comments(first:50){totalCount nodes{author{login} url body}}}}}}}' \
  --jq '.data.repository.pullRequest.reviewThreads
        | (if .pageInfo.hasNextPage then "more threads" else empty end),
          (.nodes[] | select(.isResolved==false)
           | "== \(.id) \(.path):\(.line // .originalLine) outdated=\(.isOutdated)",
             (if .comments.totalCount > 50 then "more comments" else empty end),
             (.comments.nodes[] | "[\(.author.login)] \(.url)\n\(.body)\n"))'
```

Review bodies (where CodeRabbit puts comments outside the diff) and
conversation comments:

```sh
gh api --paginate "repos/{owner}/{repo}/pulls/$N/reviews" \
  --jq '.[] | select((.body // "") != "") | "\(.user.login) \(.commit_id[0:7]) \(.state)\n\(.body)\n"'
gh api --paginate "repos/{owner}/{repo}/issues/$N/comments" \
  --jq '.[] | "\(.user.login) \(.created_at)\n\(.body)\n"'
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
command run and its output, the doc, the source line).

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
  --jq '{mergeStateStatus, reviewDecision, failing: [.statusCheckRollup[] | select(.conclusion == "FAILURE") | .name]}'
```

`CLEAN` means the checks pass and every thread is resolved. `BLOCKED` with
passing checks usually means an unresolved thread; `reviewDecision` stays
empty while every review is `COMMENTED`.

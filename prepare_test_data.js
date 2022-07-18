const opensearch = require("./opensearch");

function getQueryBody(owner, repo) {
  return {
    query: {
      bool: {
        must: [
          {
            term: {
              "search_key.owner.keyword": {
                value: owner,
              },
            },
          },
          {
            term: {
              "search_key.repo.keyword": {
                value: repo,
              },
            },
          },
        ],
      },
    },
    sort: [
      {
        "search_key.updated_at": {
          order: "desc",
        },
      },
    ],
    size: 1,
    _source: "search_key.updated_at",
  };
}

const fs = require("fs");

const gitsPromise = opensearch
  .getUniqOwnerRepos("gits")
  .then((uniqOwnerRepos) => {
    const items = {};
    const promises = uniqOwnerRepos.map((item) => {
      const { owner, repo } = item;
      const key = `${owner}___${repo}`;

      return opensearch.client
        .search({ index: "gits", body: getQueryBody(owner, repo) })
        .then((result) => {
          const hits = result.body.hits.hits;
          if (hits.length > 0) {
            // console.log(owner, repo, hits[0]._source.search_key.updated_at);
            items[key] = hits[0]._source.search_key.updated_at;
          }
        })
        .catch((e) => {
          console.log("failed:", e);
        });
    });
    return Promise.all(promises).then(() => {
      console.log("all gits ready");
      return { index: "gits", data: items };
    });
  });

const githubIndices = [
  "github_commits",
  "github_pull_requests",
  "github_issues",
  "github_issues_comments",
  "github_issues_timeline",
];

const githubPromises = githubIndices.map((githubIndex) => {
  return opensearch.getUniqOwnerRepos(githubIndex).then((uniqOwnerRepos) => {
    const items = {};
    const promises = uniqOwnerRepos.map((item) => {
      const { owner, repo } = item;
      const key = `${owner}___${repo}`;

      return opensearch.client
        .search({ index: githubIndex, body: getQueryBody(owner, repo) })
        .then((result) => {
          const hits = result.body.hits.hits;
          if (hits.length > 0) {
            // console.log(owner, repo, hits[0]._source.search_key.updated_at);
            items[key] = hits[0]._source.search_key.updated_at;
          }
        })
        .catch((e) => {
          console.log("failed:", e);
        });
    });
    return Promise.all(promises).then(() => {
      console.log(`all ${githubIndex} ready`);
      return { index: githubIndex, data: items };
    });
  });
});

const allPromises = [gitsPromise].concat(githubPromises);

const outputJsonObject = {};
console.log(allPromises, allPromises.length);
Promise.all(allPromises).then((results) => {
  console.log("all promises finished");
  results.forEach((indexResult) => {
    console.log(
      indexResult.index,
      indexResult.data["SELinuxProject___selinux"]
    );
  });

  outputJsonObject.gits = results[0].data;
  outputJsonObject.github = results[1].data;
  fs.writeFileSync("./test_data.json", JSON.stringify(outputJsonObject));
});

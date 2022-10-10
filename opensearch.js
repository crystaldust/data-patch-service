const { Client } = require("@opensearch-project/opensearch");

const host = process.env.OS_HOST || "192.168.8.108";
const protocol = process.env.OS_PROTOCOL || "https";
const port = process.env.OS_PORT || 19201;
const auth = process.env.OS_AUTH || "admin:admin"; // For testing only. Don't store credentials in code.

const UNIQ_OWNER_REPO_QUERY = {
  query: {
    match_all: {},
  },
  aggs: {
    uniq_owner: {
      terms: {
        field: "search_key.owner.keyword",
        size: 10000,
      },
      aggs: {
        uniq_repo: {
          terms: {
            field: "search_key.repo.keyword",
            size: 10000,
          },
        },
      },
    },
  },
  size: 0,
};

const client = new Client({
  node: protocol + "://" + auth + "@" + host + ":" + port,
  ssl: {
    rejectUnauthorized: false,
    // ca: fs.readFileSync(ca_certs_path),
    // You can turn off certificate verification (rejectUnauthorized: false) if you're using self-signed certificates with a hostname mismatch.
    // cert: fs.readFileSync(client_cert_path),
    // key: fs.readFileSync(client_key_path)
  },
});

function getUniqOwnerRepos(index) {
  return client
    .search({
      index,
      body: UNIQ_OWNER_REPO_QUERY,
    })
    .then((result) => {
      const uniqOwners = result.body.aggregations.uniq_owner;
      const uniqOwnerRepos = [];
      uniqOwners.buckets.forEach((ownerItem) => {
        const owner = ownerItem.key;
        ownerItem.uniq_repo.buckets.forEach((repoItem) => {
          uniqOwnerRepos.push({
            owner,
            repo: repoItem.key,
          });
        });
      });
      return uniqOwnerRepos;
    });
}

function getDiffESDumpParams(fromOwnerRepos, index, prefix = "/tmp") {
  return getUniqOwnerRepos(index).then((uniqOwnerRepos) => {
    const diffESDumpParams = [];

    uniqOwnerRepos.forEach((item) => {
      const {owner, repo} = item;
      const key = `${owner}___${repo}`;
      // Decide: loop through fromOwnerRepos and just fetch the specified owner_repos
      // Decision: We should dump the data if it's not specified from the requester
      // Since it's needed if not specified, but the code can be used for debugging.
      if (!fromOwnerRepos.hasOwnProperty(key)) {
        return;
      }

      const searchBody = {
        query: {
          bool: {
            must: [
              {
                match: {
                  "search_key.owner.keyword": owner,
                },
              },
              {
                match: {
                  "search_key.repo.keyword": repo,
                },
              },
            ],
          },
        },
      };
      if (fromOwnerRepos.hasOwnProperty(key)) {
        const timestamp = fromOwnerRepos[key];
        searchBody.query.bool.must.push({
          range: {
            "search_key.updated_at": {
              gt: timestamp,
            },
          },
        });
      }

      diffESDumpParams.push({
        searchBody,
        outputPath: `${prefix}/${key}.${index}.json`,
      });
    });
    return diffESDumpParams;
  });
}


exports.getUniqOwnerRepos = getUniqOwnerRepos;
exports.getDiffESDumpParams = getDiffESDumpParams
exports.host = host;
exports.protocol = protocol;
exports.port = port;
exports.auth = auth;
exports.client = client;

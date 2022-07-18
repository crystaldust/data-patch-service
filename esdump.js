const ElasticDump = require("elasticdump");

function createCompressedJson(owner, repo, timestamp) {
  // Call esdump
  const options = {
    query: "", //
  };
  const dumper = new Elasticdump(options);
}

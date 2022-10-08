const ElasticDump = require("elasticdump");
const opensearch = require("./opensearch");

const OPTIONS_TEMPLATE = {
    size: -1,
    limit: 5000,
    offset: 0,
    debug: false,
    type: "data",
    delete: false,
    maxSockets: null,
    input: "https://admin:admin@192.168.8.21:19201/gits",
    "input-index": null,
    output: "/tmp/gits.json.gzip",
    "output-index": null,
    noRefresh: false,
    // inputTransport: null,
    // outputTransport: null,
    // searchBody: { query: { match: { "search_key.owner.keyword": "apache" } } },
    searchBodyTemplate: null,
    searchWithTemplate: false,
    filterSystemTemplates: true,
    // templateRegex: "^(metrics|logs|.+_audit_log|.+-index-template|\\..+)$",
    headers: null,
    "input-headers": null,
    "output-headers": null,
    sourceOnly: false,
    jsonLines: false,
    format: "",
    "ignore-errors": false,
    "support-big-int": false,
    "big-int-fields": "",
    scrollId: null,
    scrollTime: "10m",
    scrollRetryDelay: 15000,
    "scroll-with-post": false,
    timeout: null,
    toLog: true,
    quiet: false,
    fsCompress: true,
    awsIniFileName: null,
    sessionToken: null,
    transform: null,
    httpAuthFile: null,
    params: null,
    "input-params": null,
    "output-params": null,
    prefix: "",
    suffix: "",
    retryAttempts: 0,
    customBackoff: false,
    retryDelayBase: 0,
    retryDelay: 5000,
    parseExtraFields: "",
    fileSize: -1,
    maxRows: -1,
    cert: null,
    key: null,
    pass: null,
    ca: null,
    tlsAuth: false,
    concurrency: 1,
    throttleInterval: 1,
    carryoverConcurrencyCount: true,
    intervalCap: 5,
    concurrencyInterval: 5000,
    overwrite: false,
    rejectUnauthorized: false,
    "force-os-version": "7.10.2",
};
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

function createCompressedJson(index, outputTag, searchBody = null) {
    // Call ElasticDump, the 'cloned' options by Object.assign is a shallow copy, which just copy the value.
    // So if the value is a reference type, it should be handled with care.
    const options = Object.assign({}, OPTIONS_TEMPLATE);
    options.input = `https://${opensearch.auth}@${opensearch.host}:${opensearch.port}/${index}`;
    options.output = `${outputTag}`;
    if (searchBody) {
        options.searchBody = searchBody;
    }

    const dumper = new ElasticDump(options);

    // TODO Check if the query result is empty or not when searchBody is not empty
    // If no result, skip the creation of compressed file to save computation resource
    return opensearch.client
        .search({
            index,
            body: searchBody,
        })
        .then((result) => {
            if (!result.body.hits.hits.length) {
                return Promise.resolve({
                    outputTag,
                    totalWrites: 0,
                });
            }
            // Do the real dump
            return new Promise((resolve, reject) => {
                // TODO track the log in debug mode
                // dumper.on('log', (msg)=>{
                //   console.log('dump log', msg)
                // })
                dumper.dump((err, totalWrites) => {
                    if (err) {
                        // TODO Delete the dumped file, or we should delete it outside the call
                        return reject(err);
                    }
                    return resolve({
                        outputTag,
                        totalWrites,
                    });
                });
            });
        });
}

exports.createCompressedJson = createCompressedJson;

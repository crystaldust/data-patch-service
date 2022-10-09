const fs = require("fs");
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

const archiver = require('archiver')

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
const http = require("http");

const esdump = require("./esdump");
const opensearch = require("./opensearch");
const obs = require('./obs')


var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

let ENV_NAME = process.env.ENV_NAME || "HWCLOUD";

function getDiffESDumpParams(fromOwnerRepos, index, prefix = "/tmp") {
    return opensearch.getUniqOwnerRepos(index).then((uniqOwnerRepos) => {
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

function pack(taskID) {
    return new Promise((resolve, reject) => {
        // The tar lib has a bug that will change the file stat, bring the error of size mismatch.
        // const archive = archiver('tar', {gzip: false})
        const archivePath = `${taskID}.zip`
        const archive = archiver('zip', {level: 9})
        const output = fs.createWriteStream(archivePath)

        output.on('close', () => {
            return resolve(archivePath)
        })
        // output.on('end', ()=>{
        //     console.log('data drained')
        // })
        archive.on('error', (err) => {
            return reject(err);
        })
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                console.log('tar warning!', err)
            } else {
                return reject(err)
            }
        });

        archive.pipe(output)
        archive.directory(taskID)
        archive.finalize()
    })
}

const INDICE_MAP = {
    gits: ["gits"],
    github: [
        "github_commits",
        "github_pull_requests",
        "github_issues",
        "github_issues_comments",
        "github_issues_timeline",
    ],
};

app.post("/api/patch", function (req, res) {
    const body = req.body;
    const from = req.header("from");
    if (!body || !from) {
        console.warn("Either from or body is empty")
        res.status(400);
        return res.send("");
    }

    const nowStr = new Date().toISOString().replaceAll(':', '');
    const taskId = `FROM_${from}_TO_${ENV_NAME}_${nowStr}`;
    // TODO Add the task record to PG
    if (!fs.existsSync(taskId)) {
        fs.mkdirSync(taskId);
    }

    // const taskPromises = [];
    const allPromises = [];
    for (const key in req.body) {
        // key is [gits, github...]
        const indices = INDICE_MAP[key];
        const promises = indices.map((index) => {
            return getDiffESDumpParams(req.body[key], index, `./${taskId}`).then(
                (diffDumpParams) => {
                    console.log(JSON.stringify(diffDumpParams, null, 2))
                    const dumpPromises = diffDumpParams.map((param) => {
                        const {searchBody, outputPath} = param;
                        return esdump.createCompressedJson(index, outputPath, searchBody);
                    });
                    return Promise.all(dumpPromises).then((results) => {
                        // // TODO Update the task state(dump finished, start zipping)
                        // console.log('all dump finished', 'zip the folder ', taskId)
                        // pack(taskId)
                        return results;
                    });
                }
            );
        });
        allPromises.push(...promises);
    }
    // TODO Update task state(dump started)
    console.log('dump started')
    Promise.all(allPromises).then((results) => {
            console.log("all dump promises finished");
            // TODO Dump finished, update the state(zipping)
            // console.log(results);
            return pack(taskId)
        }).then((archiveFilePath)=>{
        // TODO update state(zipped)
        // start obs uploading
        return obs.upload(archiveFilePath, 'oss-know-bj')
        }).then((uploadResult)=>{
            console.log('upload Url:', uploadResult.uploadUrl )
    })
        .catch((err) => {
            // TODO Update task state(dump error)
            console.log("failed to collect dump promises, err:", err);
        });

    return res.send({
        task_id: taskId,
    });
});

app.get("/api/patch", function (req, res) {
    const taskId = req.header("task-id");
    if (!taskId) {
        res.status(400);
        return res.send("");
    }

    return res.send({
        state: "created",
    });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render("error");
});

module.exports = app;

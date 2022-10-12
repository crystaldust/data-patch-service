const fs = require("fs");
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var morgan = require("morgan");

const bunyan = require('bunyan')
const archive = require('./archive')

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
const http = require("http");

const esdump = require("./esdump");
const opensearch = require("./opensearch");
const obs = require('./obs')
const db = require('./db')
const {Task} = require("./db");

const logger = bunyan.createLogger({name: 'app'})

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(morgan("dev"));
app.use(express.json({limit: '5mb'}));
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

let ENV_NAME = process.env.ENV_NAME || "HWCLOUD";

const memoryEngine = new db.MemoryEngine()


app.post("/api/patch", function (req, res) {
    const body = req.body;
    const from = req.header("from");
    if (!body || !from) {
        logger.warn("Either from or body is empty")
        res.status(400);
        return res.send("");
    }

    const nowStr = new Date().toISOString().replaceAll(':', '');
    const taskId = `FROM_${from}_TO_${ENV_NAME}_${nowStr}`;
    // TODO Add the task record to PG
    if (!fs.existsSync(taskId)) {
        fs.mkdirSync(taskId);
    }

    const allPromises = [];
    for (const index in req.body) {
        const indexPromise = opensearch.getDiffESDumpParams(req.body[index], index, `./${taskId}`).then(
            (diffDumpParams) => {
                const dumpPromises = diffDumpParams.map((param) => {
                    const {searchBody, outputPath} = param;
                    return esdump.createCompressedJson(index, outputPath, searchBody);
                });
                return Promise.all(dumpPromises).then((results) => {
                    logger.info(`index ${index} dump finished, ${results.length} owner___repos dumped`)
                    return results;
                });
            }
        );
        allPromises.push(indexPromise);
    }

    const task = new Task(taskId, memoryEngine)
    task.updateState('dumping')
    Promise.all(allPromises).then((results) => {
        task.updateState('archiving')
        return archive.pack(taskId)
    }).then((archiveFilePath) => {
        task.updateState('uploading')
        return obs.upload(archiveFilePath, 'oss-know-bj')
    }).then((uploadResult) => {
        task.updateState('uploaded')
        task.updateUrl(uploadResult.uploadUrl)
        return uploadResult
    }).then(uploadResult => {
        logger.info('Archive uploaded, delete', uploadResult.localFilePath, taskId)
        fs.rmdirSync(taskId)
        fs.rmSync(uploadResult.localFilePath)
    }).catch((err) => {
        task.updateState('error')
        task.update('error', err.message)
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
    const task = memoryEngine.get(taskId)
    if (!task) {
        return res.send({
            state: 'not_found'
        })
    }

    return res.send(task)
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

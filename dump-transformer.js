const bunyan = require('bunyan')
const opensearch = require('./opensearch')
const {client} = require("./opensearch");

const logger = bunyan.createLogger({
    name: 'dump-transformer',
    streams: [
        {
            level: 'info',
            path: './dump.log'  // log ERROR and above to a file
        }
    ]
})

class IndexTransformer {
    constructor(index, doc) {
        this.index = index
        this.doc = doc
    }

    transform() {

    }
}

class IssueTransformer extends IndexTransformer {
    transform() {
        const {owner, repo} = this.doc._source.search_key
        const {node_id} = this.doc._source.raw_data
        const {_id} = this.doc

        const doc = this.doc
        const searchBodyBase = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "search_key.owner.keyword": owner
                            }
                        },
                        {
                            "match": {
                                "search_key.repo.keyword": repo
                            }
                        }
                    ]
                }
            }
        }
        let searchBody = Object.assign({}, searchBodyBase)
        searchBody.query.bool.must.push({
            "match": {
                "_id": _id
            }
        })

        return client.search({index: this.index, body: searchBody}).then(result => {
            if (result.body && result.body.hits.hits.length) {
                return {}
            }

            let searchBody = Object.assign({}, searchBodyBase)

            // If doc with same _id is not found, try to match it by node_id or (actor_id, issue_number)
            if (node_id) {
                searchBody.query.bool.must.push(
                    {
                        "match": {
                            "raw_data.node_id": node_id
                        }
                    }
                );
            } else {
                // console.log(JSON.stringify(doc, null, 2))
                console.log('event node_id not found', doc._id)
                searchBody.query.bool.must.push(
                    {
                        "match": {
                            "raw_data.actor.id": doc._source.raw_data.actor.id
                        }
                    }
                );
                searchBody.query.bool.must.push(
                    {
                        "match": {
                            "raw_data.source.issue.node_id": doc._source.raw_data.source.issue.node_id
                        }
                    }
                );
            }
            return client.search({index: this.index, body: searchBody})

        }).then(result => {
            if (result.body && result.body.hits.hits.length) {
                // console.log(result.body.hits.hits[0]._id, this.doc._id)
                if (!this.doc._source.raw_data.node_id) {
                    console.log('node_id not found', this.doc._source.raw_data.this.doc._id)
                } else {
                    console.log('node_id found', this.doc._source.raw_data.node_id, this.doc._source.raw_data.this.doc._id)
                }
                return client.delete({index: this.index, id: result.body.hits.hits[0]._id})
            }
            return {}
        }).catch(e => {
            return e
        })

        //
        // // console.log(JSON.stringify(searchBody, null, 2))
        // return opensearch.client.search({
        //     index: this.index,
        //     body: searchBody
        // })
        //     .then(result => {
        //         // console.log('search result:', result)
        //         if (result.body && result.body.hits.hits.length) {
        //             // found, delete it
        //             client.delete({
        //                 index: this.index,
        //                 id: result.body.hits.hits[0]._id
        //             })
        //             console.log('delete ', result.body.hits.hits[0]._id, 'in', this.index, 'and insert')
        //             return 'deleted, insert'
        //         } else {
        //             // not found
        //             return 'not found, just insert'
        //         }
        //     }).catch(err => {
        //         console.log('failed!', err, searchBody)
        //         console.log(JSON.stringify(searchBody, null, 2))
        //         console.log(JSON.stringify(doc, null, 2))
        //         return err
        //     })
    }
}

class TimelineTransformer extends IssueTransformer {

}


module.exports = function (doc, params) {
    // logger.info(params)
    if (!params.hasOwnProperty('index')) {
        logger.error('index not specified!')
        throw(new Error('Essential parameter [index] not specified for transform'))
    }

    const index = params.index
    if (index == 'github_issues_timeline') {
        new TimelineTransformer(index, doc).transform().then(result => {
            // console.log()
        }).catch(err => {
            console.log('failed to transform:', err)
        })
    }
    return doc
}
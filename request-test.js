const opensearch = require('./opensearch')
const fs = require("fs");
const indices = ['gits', 'github_commits', 'github_pull_requests', 'github_issues', 'github_issues_comments', 'github_issues_timeline']
const axios = require('axios')

const reqBody = {}
const allPromises = indices.map(index => {
    const indexPromises = []
    return opensearch.getUniqOwnerRepos(index).then(result => {
        indexPromises[index] = result.map(item => {
            const {owner, repo} = item
            const searchBody = {
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
                },
                "sort": [
                    {
                        "search_key.updated_at": {
                            "order": "desc"
                        }
                    }
                ],
                "size": 1,
                "_source": "search_key.updated_at"
            }

            return opensearch.client.search({index, body: searchBody}).then(result => {
                const ret = {}
                ret[`${owner}___${repo}`] = result.body.hits.hits[0]._source.search_key.updated_at
                return ret
            }).catch(err => {
                console.log(err)
            })
        })
        return Promise.all(indexPromises[index]).then(result => {
            return {
                index,
                result,
            }
        })
    }).catch(err => {
        console.log(err)
    })
})

Promise.all(allPromises).then(result => {
    console.log(result)
    const requestBody = {}
    result.forEach(item => {
        requestBody[item.index] = item.result
    })
    return requestBody
}).then(reqBody => {
    // axios.post('url', reqBody, )
    // console.log(JSON.stringify(reqBody, null, 2))
    return axios.post('http://localhost:3000/api/patch', reqBody, {
        headers: {
            FROM: 'lance-dev'
        }
    })
}).then(res => {
    console.log(res)
}).catch(err => {
    console.log(err)
})

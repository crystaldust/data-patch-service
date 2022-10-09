class Engine {
    set(id, content) {

    }

    get(id) {

    }
}

const _memory = {}

class MemoryEngine extends Engine {
    set(id, contentObj) {
        if (!_memory.hasOwnProperty(id)) {
            _memory[id] = {}
        }
        for (var key in contentObj) {
            _memory[id][key] = contentObj[key]
        }
    }
    get(id) {
        return _memory[id]
    }
}

class PGEngine extends Engine {
    constructor(host, port, user, password) {
        super();
        // TODO Connect to pg and init table if not exists
    }
    set(id, content) {
        // TODO Update row
    }
    get(id) {
        // TODO Get the row from table
    }
}

class Task {
    constructor(taskId, engine) {
        this.id = taskId;
        this.engine = engine;
        this.state = 'created'
    }

    updateState(state) {
        this.state = state
        this.engine.set(this.id, {state:this.state})
    }

    updateUrl(url) {
        this.url = url
        this.engine.set(this.id, {url: url})
    }
    update(key, val) {
        this[key] = val
        const content = {}
        content[key] = val
        this.engine.set(this.id, content)
    }

    getState() {
        this.engine.get(this.id)
    }
}

exports.Task = Task
exports.MemoryEngine = MemoryEngine
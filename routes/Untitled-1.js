
var elasticsearch = require('@elastic/elasticsearch');
var es = new elasticsearch.Client({ node: "http://ml_service_account:u7i8o9p0@192.170.227.31:9200", log: 'error' });

var req = {
    index: 'mlfront_users', type: 'docs',
    body: {
        query: {
            bool: {
                must: [
                    { match: { event: 'Codas20119' } }
                ]
            }
        }
    }
};

async function se(){
    r = await es.search(req);
}

se();

r

{ match: { _id: 'a51dbd7e-d274-11e5-9b11-9be347a09ce0' } }

var req = { index: 'mlfront_users', type: 'docs', id: 'a51dbd7e-d274-11e5-9b11-9be347a09ce0', body: { doc: { approved_on: 1563471637828, approved: true } } }
es.update(req, (err, result) => {
    if (err) console.log(err)
})


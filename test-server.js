var fs = require('fs');

var express = require('express');
var https = require('https');
var http = require('http');

var request = require('request');


console.log('ML_front server starting ... ');

var ml_front_config = {
    "SITENAME": "www.atlas-ml.org",
    "NAMESPACE": "ml-usatlas-org",
    "SSL": false,
    "STATIC_BASE_PATH": "ml-usatlas-org",
    "APPROVAL_REQUIRED": true,
    "APPROVAL_EMAIL": "ivukotic@cern.ch",
    "SINGLE_INSTANCE": false,
    "PUBLIC_INSTANCE": true,
    "MONITOR": true,
    "TFAAS": false,
    "REMOTE_K8S": false,
    "REPORTING": true,
    "JL_POD": "./jupyter-pod.json",
    "JL_SERVICE": "./jupyter-service.json"
}


var elasticsearch = require('elasticsearch');
var session = require('express-session')

// App
const app = express();

app.use(express.static(ml_front_config.STATIC_BASE_PATH));
app.set('view engine', 'pug');
app.use(express.json());       // to support JSON-encoded bodies
app.use(session({
    secret: 'mamicu mu njegovu', resave: false,
    saveUninitialized: true, cookie: { secure: false, maxAge: 3600000 }
}))

// Elasticsearch

var es_client = new elasticsearch.Client({
    host: 'atlas-kibana.mwt2.org:9200',
    log: 'trace'
});

app.get('/get_services_from_es', function (req, res) {
    console.log('user:', req.session.sub_id, 'services.');
    es_client.search({
        index: 'ml_front', type: 'docs',
        body: {
            _source: ["service", "name", "link", "timestamp", "gpus", 'cpus', 'memory', "link", "ttl"],
            query: {
                match: {
                    "owner": req.session.sub_id
                }
            },
            sort: { "timestamp": { order: "desc" } }
        }
    }).then(
        function (resp) {
            // console.log(resp);
            if (resp.hits.total > 0) {
                // console.log(resp.hits.hits);
                toSend = [];
                for (var i = 0; i < resp.hits.hits.length; i++) {
                    var obj = resp.hits.hits[i]._source;
                    console.log(obj);
                    var start_date = new Date(obj.timestamp).toUTCString();
                    var end_date = new Date(obj.timestamp + obj.ttl * 86400000).toUTCString();
                    serv = [obj.service, obj.name, start_date, end_date, obj.gpus, obj.cpus, obj.memory]
                    toSend.push(serv);
                }
                res.status(200).send(toSend);
            } else {
                console.log("no services found.");
                res.status(200).send([]);
            }
        },
        function (err) {
            console.trace(err.message);
        });
});


app.get('/plugins', function (req, res) {
    // console.log('sending plugins info back.');
    res.json({
        TFAAS: ml_front_config.TFAAS,
        PUBLIC_INSTANCE: ml_front_config.PUBLIC_INSTANCE,
        MONITOR: ml_front_config.MONITOR
    });
});



app.get('/user', function (req, res) {
    console.log('sending profile info back.');

    res.json({
        loggedIn: req.session.loggedIn,
        name: req.session.name,
        email: req.session.email,
        username: req.session.username,
        organization: req.session.organization,
        user_id: req.session.sub_id,
        authorized: req.session.authorized
    });
});

app.get('/users_data', function (req, res) {
    console.log('sending profile info back.');

    es_client.search({
        index: 'mlfront_users', type: 'docs',
        body: {
            query: {
                match: {
                    "event": ml_front_config.NAMESPACE
                }
            },
            sort: { "created_at": { order: "desc" } }
        }
    }).then(
        function (resp) {
            // console.log(resp);
            if (resp.hits.total > 0) {
                // console.log(resp.hits.hits);
                toSend = [];
                for (var i = 0; i < resp.hits.hits.length; i++) {
                    var obj = resp.hits.hits[i]._source;
                    console.log(obj);
                    var created_at = new Date(obj.created_at).toUTCString();
                    var approved_on = new Date(obj.approved_on).toUTCString();
                    serv = [obj.user, obj.email, obj.affiliation, created_at, obj.approved, approved_on]
                    toSend.push(serv);
                }
                res.status(200).send(toSend);
            } else {
                console.log("no users found.");
                res.status(200).send([]);
            }
        },
        function (err) {
            console.trace(err.message);
        });

});

app.use((err, req, res, next) => {
    console.error('Error in error handler: ', err.message);
    res.status(err.status).send(err.message);
});


var httpsServer = http.createServer(app).listen(8080);

// http.createServer(function (req, res) {
//     res.writeHead(302, { 'Location': 'https://' + ml_front_config.SITENAME });
//     res.end();
// }).listen(80);


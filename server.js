var fs = require('fs');

var express = require('express');
var https = require('https');
var http = require('http');

var request = require('request');


console.log('ML_front server starting ... ');

console.log('config load ... ');
var ml_front_config = require('/etc/ml-front-conf/mlfront-config.json');
console.log(ml_front_config);

var privateKey = fs.readFileSync('/etc/https-certs/key.pem');//, 'utf8'
var certificate = fs.readFileSync('/etc/https-certs/cert.pem');

var credentials = { key: privateKey, cert: certificate };

var elasticsearch = require('elasticsearch');
var session = require('express-session')

var mg_config = require('/etc/mg-conf/config.json');
var mailgun = require('mailgun-js')({ apiKey: mg_config.APPROVAL_MG, domain: mg_config.MG_DOMAIN });


// App
const app = express();

app.use(express.static(ml_front_config.STATIC_BASE_PATH));
app.set('view engine', 'pug');
app.use(express.json());       // to support JSON-encoded bodies
app.use(session({
    secret: 'mamicu mu njegovu', resave: false,
    saveUninitialized: true, cookie: { secure: false, maxAge: 3600000 }
}))

// k8s stuff
const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;


var client;

// GLOBUS STUFF
const globConf = require('/etc/globus-conf/globus-config.json');
var auth = "Basic " + new Buffer(globConf.CLIENT_ID + ":" + globConf.CLIENT_SECRET).toString("base64");



// called on every path
// app.use(function (req, res, next) {
//     next();
// })


// Elasticsearch

var es_client = new elasticsearch.Client({
    host: 'atlas-kibana.mwt2.org:9200',
    log: 'trace'
});

async function es_check_user_authorized(user_info) {
    try {
        const response = await es_client.search({
            index: "mlfront_users", type: "docs",
            body: {
                query: {
                    bool: {
                        "must": [
                            {
                                match: {
                                    "event": ml_front_config.NAMESPACE
                                }
                            },
                            {
                                match: {
                                    "_id": user_info.sub
                                }
                            }
                        ]
                    }
                }
            }
        });
        console.log(response);
        if (response.hits.total == 0) {
            console.log("user not found...");
            await es_create_user(user_info);
            return await es_check_user_authorized(user_info);
        }
        else {
            console.log("user was found and authorization was: ", response.hits.hits[0]._source.approved);
            return response.hits.hits[0]._source.approved;
        };
    } catch (err) {
        console.error(err)
    }
};

async function es_create_user(user_info) {
    try {
        const response = await es_client.index({
            index: 'mlfront_users',
            type: 'docs',
            id: user_info.sub,
            refresh: true,
            body: {
                "username": user_info.preferred_username,
                "affiliation": user_info.organization,
                "user": user_info.name,
                "email": user_info.email,
                "event": ml_front_config.NAMESPACE,
                "created_at": new Date().getTime(),
                "approved": !ml_front_config.APPROVAL_REQUIRED
            }
        });
        console.log(response);
    } catch (err) {
        console.error(err)
    }
}

function ask_for_approval(user_info) {

    if (ml_front_config.APPROVAL_REQUIRED == true) {
        if (ml_front_config.hasOwnProperty("APPROVAL_EMAIL")) {

            link = 'https://' + ml_front_config.SITENAME + '/authorize/' + user_info.sub;
            data = {
                from: "ATLAS Alarm & Alert System <aaas@analytics.mwt2.org>",
                to: ml_front_config.APPROVAL_EMAIL,
                subject: "Authorization requested",
                text: "Dear Sir/Madamme, \n\n\t" + user_info.name +
                    " affiliated with " + user_info.organization +
                    " requested access to " + ml_front_config.NAMESPACE +
                    " ML front.\n\tTo approve it use this link " + link +
                    ". To deny the request simply delete this mail.\n\nBest regards,\n\tML front Approval system"
            }

            mailgun.messages().send(data, function (error, body) {
                console.log(body);
            });

        }
        else {
            console.error("Approval person's mail or mailgun key not configured.");
        }
    }
}

function test_ES_connection() {
    es_client.ping({
        requestTimeout: 30000,
    }).then(all_is_well, all_is_not_well);
}

function all_is_well(err, resp, stat) {
    console.log('All is well');
}

function all_is_not_well(err, resp, stat) {
    console.error('elasticsearch cluster is down!');
    process.exit(1);
}

async function configureKube() {
    try {
        console.log("configuring k8s client");
        client = new Client({ config: config.getInCluster() });
        await client.loadSpec();
        console.log("client configured");
        return client;
    } catch (err) {
        console.log("Ilija - error in configureKube\n", err);
        process.exit(2);
    }

}

async function configureRemoteKube(cluster_url, admin, adminpass) {
    try {
        console.log("configuring remote k8s client");
        const client = new Client({
            config: {
                url: cluster_url,
                auth: {
                    user: admin,
                    pass: adminpass,
                },
                insecureSkipTlsVerify: true,
            }
        })
        await client.loadSpec();
        console.log("client configured");
        return client;
    } catch (err) {
        console.log("Error in configureRemoteKube\n", err);
        process.exit(2);
    }

}

async function cleanup(name) {
    try {
        await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods(name).delete();
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log(`Pod ${name} deleted.`);
    } catch (err) {
        console.warn(`Unable to delete pod ${name}.  Skipping.`);
    }

    while (await get_pod_state(name).catch() == 'running') {
        console.log('still alive. waiting.');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
        await client.api.v1.namespaces(ml_front_config.NAMESPACE).services(name).delete();
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`Service ${name} deleted.`);
    } catch (err) {
        console.warn(`Unable to delete service ${name}.  Skipping.`);
    }

    if (ml_front_config.hasOwnProperty('JL_INGRESS')) {
        try {
            await client.apis.extensions.v1beta1.namespaces(ml_front_config.NAMESPACE).ingresses(name).delete();
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`Ingress ${name} deleted.`);
        } catch (err) {
            console.warn(`Unable to delete ingress ${name}.  Skipping.`);
        }
    }

}

async function show_pods() {
    console.log("all pods in this namespace");
    try {
        const pods = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.get();
        pods.body.items.forEach((item) => {
            console.log(item.metadata.name);
            console.log(item.spec.containers[0].resources);

        });
    } catch (err) {
        console.log("can't show all pods in this namespace.", err);
    }
}

async function users_services(owner) {
    console.log("all user's pods in ml namespace", owner);
    results = []
    try {
        const pods = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.get();
        for (const item of pods.body.items) {

            if (item.metadata.labels == undefined) {
                continue;
            }
            if (item.metadata.labels.owner == owner) {
                resources = item.spec.containers[0].resources;
                console.log(resources);
                crt = Date.parse(item.metadata.creationTimestamp); //number
                ttl = parseInt(item.metadata.labels.time2delete.replace('ttl-', ''));
                endingat = new Date(crt + ttl * 86400000).toUTCString();
                gpus = resources.limits['nvidia.com/gpu'];
                cpus = resources.limits['cpu'];
                ram = resources.limits['memory'];
                link = await get_service_link(item.metadata.name);
                results.push(['Private JupyterLab', item.metadata.name, new Date(crt).toUTCString(), endingat, gpus, `<a href="${link}">${link}</a>`])
            }
        };
    } catch (err) {
        console.log("can't show all pods in namespace ml", err);
    }
    return results;
}

async function enforce_time2delete() {
    const pods = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.get();
    for (item of pods.body.items) {
        if (item.metadata.labels == undefined) {
            continue;
        }
        if (item.metadata.labels['k8s-app'] == 'ml-personal') {
            // console.log(item.metadata);
            ttd = parseInt(item.metadata.labels.time2delete.replace('ttl-', ''));
            crt = Date.parse(item.metadata.creationTimestamp);
            if (Date.now() > crt + ttd * 86400 * 1000) {
                console.log('Deleting:', item.metadata.name);
                cleanup(item.metadata.name);
            } else {
                console.log('name:', item.metadata.name, " remaining time: ", (crt + ttd * 86400 * 1000 - Date.now()) / 3600000, ' hours.');
            }
        }
    };
}

async function get_pod_state(name) {
    console.log(`Looking for pod ${name} in ml namespace`);
    try {
        const pod = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods(name).get();
        console.log(pod.body.status.phase);
        return pod.body.status.phase;
    } catch (err) {
        console.log(`can't get pod ${name}.`);
    }
}

async function get_service_link(name) {
    console.log(`Looking for service ${name}.`);

    try {
        const service = await client.api.v1.namespaces(ml_front_config.NAMESPACE).services(name).get();
        if (ml_front_config.hasOwnProperty('JL_INGRESS')) {
            link = ml_front_config.SITENAME;
            to_replace = link.split(".", 1);
            link = link.replace(to_replace, name);
            return `https://${link}`;
        }
        else {
            console.log(service.body.spec.ports);
            link = service.body.metadata.labels.servingat;
            port = service.body.spec.ports[0].nodePort;
            if (ml_front_config.SSL == true) {
                return `https://${link}:${port}`;
            } else {
                return `http://${link}:${port}`;
            }
        }
    } catch (err) {
        console.log(`can't get service ${name}.`);
    }

}

async function create_jupyter(owner, name, pass, gpu, cpu = 1, memory = "12", time, repo) {

    console.log("Deploying jupyter: ", name, pass, gpu, cpu, memory, time, repo);

    try {
        const jupyterPodManifest = require(ml_front_config.JL_POD);
        jupyterPodManifest.metadata.name = name;
        jupyterPodManifest.metadata.namespace = ml_front_config.NAMESPACE;
        jupyterPodManifest.metadata.labels["time2delete"] = 'ttl-' + String(time);
        jupyterPodManifest.metadata.labels["instance"] = name;
        jupyterPodManifest.metadata.labels["owner"] = owner;
        jupyterPodManifest.spec.containers[0].resources.requests["nvidia.com/gpu"] = gpu;
        jupyterPodManifest.spec.containers[0].resources.limits["nvidia.com/gpu"] = gpu;
        jupyterPodManifest.spec.containers[0].resources.requests["memory"] = memory + "Gi";
        jupyterPodManifest.spec.containers[0].resources.limits["memory"] = memory + "Gi";
        jupyterPodManifest.spec.containers[0].resources.requests["cpu"] = cpu;
        jupyterPodManifest.spec.containers[0].resources.limits["cpu"] = cpu;
        jupyterPodManifest.spec.containers[0].args[2] = pass;
        jupyterPodManifest.spec.containers[0].args[3] = repo;

        await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.post({ body: jupyterPodManifest });
    } catch (err) {
        console.error("Error in creating jupyter pod:  " + err);
        var err = new Error("Error in creating jupyter pod:  " + err);
        err.status = 500;
        return err;
    }

    if (ml_front_config.hasOwnProperty('JL_INGRESS')) {
        try {
            jupyterIngressManifest = require(ml_front_config.JL_INGRESS);
            jupyterIngressManifest.metadata.name = name;
            jupyterIngressManifest.metadata.labels["instance"] = name;
            link = ml_front_config.SITENAME;
            to_replace = link.split(".", 1);
            jupyterIngressManifest.spec.rules[0].host = link.replace(to_replace, name);
            jupyterIngressManifest.spec.rules[0].http.paths[0].backend.serviceName = name;
            await client.apis.extensions.v1beta1.namespaces(ml_front_config.NAMESPACE).ingresses.post({ body: jupyterIngressManifest });
        } catch (err) {
            console.error("Error in creating jupyter ingress:  " + err);
            var err = new Error("Error in creating jupyter ingress:  " + err);
            err.status = 500;
            return err;
        }
    }

    try {
        jupyterServiceManifest = require(ml_front_config.JL_SERVICE);
        jupyterServiceManifest.metadata.name = name;
        jupyterServiceManifest.metadata.namespace = ml_front_config.NAMESPACE;
        jupyterServiceManifest.metadata.labels["instance"] = name;
        jupyterServiceManifest.spec.selector["instance"] = name;
        await client.api.v1.namespaces(ml_front_config.NAMESPACE).services.post({ body: jupyterServiceManifest });
    } catch (err) {
        console.error("Error in creating jupyter service:  " + err);
        var err = new Error("Error in creating jupyter service:  " + err);
        err.status = 500;
        return err;
    }

    console.log(`Jupyter and service ${name} successfully deployed.`)
}

const parameterChecker = (req, res, next) => {
    if (req.body == 'undefined' || req.body == null) {
        res.status(400).send('nothing POSTed.')
        return;
    }

    console.log('body:', req.body);

    if (
        typeof req.body.name !== 'undefined' && req.body.name &&
        typeof req.body.password !== 'undefined' && req.body.password &&
        typeof req.body.gpus !== 'undefined' && req.body.gpus &&
        typeof req.body.time !== 'undefined' && req.body.time
    ) {
        console.log('Creating a private JupyterLab.');
        try {
            req.body.time = parseInt(req.body.time);
            req.body.gpus = parseInt(req.body.gpus);
        } catch (error) {
            res.sendStatus(400).send('unparseable parameters.');
            return;
        }
        next();
    } else {
        res.sendStatus(400).send('not all parameters POSTed.');
        return;
    }
}

const fullHandler = async (req, res, next) => {
    await cleanup(req.body.name);

    try {
        await create_jupyter(
            req.session.sub_id,
            req.body.name, req.body.password,
            req.body.gpus, req.body.cpus, req.body.memory, req.body.time, req.body.repository);
    } catch (err) {
        console.log("Some error in creating jupyter.", err)
        res.status(500).send('Some error in creating your JupyterLab.');
    };

    try {
        res.link = await get_service_link(req.body.name);

        es_client.index({
            index: 'ml_front', type: 'docs',
            body: {
                "service": "Private JupyterLab",
                "name": req.body.name,
                "owner": req.session.sub_id,
                "user": req.session.name,
                "ttl": req.body.time,
                "timestamp": new Date().getTime(),
                "gpus": req.body.gpus,
                "cpus": req.body.cpus,
                "memory": req.body.memory,
                "gpus": req.body.gpus,
                "link": res.link,
                "repository": req.body.repository
            }
        }, function (err, resp, status) {
            console.log("from ES indexer:", resp);
        });

        next();
    } catch (err) {
        console.log("Some error in getting service link.", err)
        res.status(500).send('Some error in creating your JupyterLab.');
    };
}

const requiresLogin = (req, res, next) => {
    // to be used as middleware

    if (req.session.loggedIn !== true) {
        var err = new Error('You must be logged in to view this page.');
        err.status = 403;
        return next(err);
    }

    if (ml_front_config.APPROVAL_REQUIRED == true) {

        console.log("Authorization required - searching for: ", req.session.email);

        es_client.search({
            index: "mlfront_users", type: "docs",
            body: { size: 500, query: { match: { "event": ml_front_config.NAMESPACE } } }
        }, function (error, response, status) {
            if (error) {
                console.log("search error: " + error);
                return "not authorized. Server error."
            }
            else {
                for (const hit of response.hits.hits) {
                    d = hit['_source']
                    console.log(d);
                    if (d.email.toLowerCase() == req.session.email.toLowerCase()) {
                        return next();
                    }
                };
                var err = new Error('You must be authorized for this service.');
                err.status = 403;
                return next(err);
            }
        });
    } else {
        // authorization not required
        return next();
    }
}



app.get('/delete/:jservice', function (request, response) {
    var jservice = request.params.jservice;
    cleanup(jservice);
    response.redirect("/index.html");
});

app.get('/resources', async function (req, res) {
    console.log('getting available resources...');
    try {
        const nodes = await client.api.v1.nodes.get();
        for (const node of nodes.body.items) {
            console.log('node >>>', node.metadata.name);
            console.log(node.status);
        }
        res.sendStatus(200);
    } catch (err) {
        console.log(`can't get available resources in namespace ml`);
    }
    rqs = await client.api.v1.namespaces(ml_front_config.NAMESPACE).resourcequotas.get();
    console.log(rqs);
});

app.get('/users_services', async function (req, res) {
    console.log('user:', req.session.sub_id, 'services.');
    await users_services(req.session.sub_id)
        .then(function (resp) {
            console.log(resp);
            res.status(200).send(resp);
        }, function (err) {
            console.trace(err.message);
        });
});

app.get('/get_services', function (req, res) {
    console.log('user:', req.session.sub_id, 'services.');
    es_client.search({
        index: 'ml_front', type: 'docs',
        body: {
            _source: ["service", "name", "link", "timestamp", "gpus", "link", "ttl"],
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
                    serv = [obj.service, obj.name, start_date, end_date, obj.gpus, `<a href="${obj.link}">${obj.link}</a>`]
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

app.get('/healthz', function (req, res) {
    // console.log('Checking health and if some private pod/service needs deletion.');
    try {
        enforce_time2delete();
        res.status(200).send('OK');
    } catch (err) {
        console.log("can't get check time2delete for all pods in namespace ml", err);
    }
});

app.post('/jupyter', requiresLogin, parameterChecker, fullHandler, (req, res) => {
    console.log('Private Jupyter created!');
    res.status(200).send(res.link);
});

app.get('/login', (req, res) => {
    console.log('Logging in');
    red = `${globConf.AUTHORIZE_URI}?scope=urn%3Aglobus%3Aauth%3Ascope%3Aauth.globus.org%3Aview_identities+openid+email+profile&state=garbageString&redirect_uri=${globConf.redirect_link}&response_type=code&client_id=${globConf.CLIENT_ID}`;
    // console.log('redirecting to:', red);
    res.redirect(red);
});


app.get('/logout', function (req, res, next) {

    if (req.session.loggedIn) {

        // logout from Globus
        let requestOptions = {
            uri: `https://auth.globus.org/v2/web/logout?client_id=${globConf.CLIENT_ID}`,
            headers: {
                Authorization: `Bearer ${req.session.token}`
            },
            json: true
        };

        request.get(requestOptions, function (error, response, body) {
            if (error) {
                console.log("logout failure...", error);
            }
            console.log("globus logout success.\n");
        });


    }
    req.session.destroy();

    res.redirect('index.html');

});

app.get('/authcallback', (req, res) => {
    console.log('AUTH CALLBACK query:', req.query);
    let code = req.query.code;
    if (code) {
        console.log('there is a code. first time around.');
        code = req.query.code;
        let state = req.query.state;
        console.log('AUTH CALLBACK code:', code, '\tstate:', state);
    }
    else {
        console.log('NO CODE call...');
    }

    red = `${globConf.TOKEN_URI}?grant_type=authorization_code&redirect_uri=${globConf.redirect_link}&code=${code}`;

    let requestOptions = {
        uri: red, method: 'POST', headers: { "Authorization": auth }, json: true
    }

    // console.log(requestOptions);

    request.post(requestOptions, function (error, response, body) {
        if (error) {
            console.log("failure...", err);
            res.redirect("index.html");
        }
        console.log("success");//, body);

        req.session.loggedIn = true;

        console.log('==========================\n getting name.');
        id_red = `https://auth.globus.org/v2/oauth2/userinfo`;
        let idrequestOptions = {
            uri: id_red, method: 'POST', json: true,
            headers: { "Authorization": `Bearer ${body.access_token}` }
        }

        request.post(idrequestOptions, async function (error, response, body) {
            if (error) {
                console.log('error on geting username:\t', error);
            }
            console.log('body:\t', body);
            req.session.authorized = await es_check_user_authorized(body);
            if (req.session.authorized == false) {
                ask_for_approval(body);
            }
            req.session.sub_id = body.sub;
            req.session.username = body.preferred_username;
            req.session.organization = body.organization;
            req.session.name = body.name;
            req.session.email = body.email;
            res.redirect("index.html");
        });

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
            _source: ["user", "email", "affiliation", "created_at", "approved", "approved_on"],
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

app.get('/authorize/:user_id', async function (req, res) {
    var user_id = req.params.user_id;
    try {
        const response = await es_client.update({
            index: 'mlfront_users',
            type: 'docs',
            id: user_id,
            body: {
                doc: {
                    "approved_on": new Date().getTime(),
                    "approved": true
                }
            }
        });
        console.log(response);
    } catch (err) {
        console.error(err)
    }
    res.redirect("/users.html");
});

app.use((err, req, res, next) => {
    console.error('Error in error handler: ', err.message);
    res.status(err.status).send(err.message);
});


var httpsServer = https.createServer(credentials, app).listen(443);

http.createServer(function (req, res) {
    res.writeHead(302, { 'Location': 'https://' + ml_front_config.SITENAME });
    res.end();
}).listen(80);


async function main() {

    try {
        await configureKube();
        // await cleanup("ml-personal");
        // await create_jupyter("ml-personal", "ASDF", 1, 2);
        await show_pods();
    } catch (err) {
        console.error('Error: ', err);
    }
}

main();
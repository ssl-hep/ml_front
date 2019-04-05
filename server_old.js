var fs = require('fs');

var express = require('express');
var https = require('https');
var http = require('http');

var request = require('request');
// const JSONStream = require('json-stream'); need for events only


console.log('ML_front server starting ... ');

console.log('config load ... ');
var ml_front_config = require('/etc/ml-front-conf/mlfront-config.json');
console.log(ml_front_config);

const userm = require('./user.js');

var privateKey = fs.readFileSync('/etc/https-certs/key.pem');//, 'utf8'
var certificate = fs.readFileSync('/etc/https-certs/cert.pem');

var credentials = { key: privateKey, cert: certificate };

var elasticsearch = require('elasticsearch');
var session = require('express-session');

// App
const app = express();

app.use(express.static(ml_front_config.STATIC_BASE_PATH));
app.set('view engine', 'pug');
app.use(express.json());       // to support JSON-encoded bodies
app.use(session({
    secret: 'mamicu mu njegovu', resave: false,
    saveUninitialized: true, cookie: { secure: false, maxAge: 3600000 }
}));

require('./routes/user')(app);
require('./routes/spark')(app);
require('./routes/jupyter')(app);

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
                    pass: adminpass
                },
                insecureSkipTlsVerify: true
            }
        });
        await client.loadSpec();
        console.log("client configured");
        return client;
    } catch (err) {
        console.log("Error in configureRemoteKube\n", err);
        process.exit(2);
    }

}

async function get_user(id) {
    var user = new userm();
    user.id = id;
    await user.load();
    return user;
}

async function cleanup(name) {
    try {
        await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods(name).delete();
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log(`Pod ${name} deleted.`);
    } catch (err) {
        console.warn(`Unable to delete pod ${name}.  Skipping.`);
    }

    while (await get_pod_state(name).catch() === 'running') {
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

async function running_users_services(owner, servicetype) {
    console.log("all user's pods in ml namespace", owner);
    results = [];
    try {
        const pods = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.get();
        for (const item of pods.body.items) {

            if (item.metadata.labels === undefined) {
                continue;
            }
            if (item.metadata.labels.owner === owner) {
                if (item.metadata.labels['k8s-app'] !== servicetype) continue;

                crt = Date.parse(item.metadata.creationTimestamp); //number

                if (item.metadata.labels['k8s-app'] === "privatejupyter") {
                    ttl = parseInt(item.metadata.labels.time2delete.replace('ttl-', ''));
                    endingat = new Date(crt + ttl * 86400000).toUTCString();
                    resources = item.spec.containers[0].resources;
                    console.log(resources);
                    gpus = resources.requests['nvidia.com/gpu'];
                    cpus = resources.requests['cpu'];
                    ram = resources.requests['memory'];
                    status = item.status.phase;
                    link = await get_service_link(item.metadata.name);
                    results.push(['Private JupyterLab', item.metadata.name, new Date(crt).toUTCString(), endingat, gpus, cpus, ram, `<a href="${link}">${link}</a>`, status]);
                }

                if (item.metadata.labels['k8s-app'] === "sparkjob") {
                    execs = item.spec.containers[0].args[10].replace("spark.executor.instances=", "")
                    path = item.spec.containers[0].args[15]

                    results.push(['Spark Job', item.metadata.name, new Date(crt).toUTCString(), item.status.phase, execs, path])
                }
            }
        }
    } catch (err) {
        console.log("can't show all pods in namespace ml", err);
    }
    return results;
}

async function enforce_time2delete() {
    const pods = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.get();
    for (item of pods.body.items) {
        if (item.metadata.labels === undefined) {
            continue;
        }
        if (item.metadata.labels['k8s-app'] === 'privatejupyter') {
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
    }
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
            if (ml_front_config.SSL === true) {
                return `https://${link}:${port}`;
            } else {
                return `http://${link}:${port}`;
            }
        }
    } catch (err) {
        console.log(`can't get service ${name}.`);
    }

}

async function get_log(name) {
    console.log(`Logs for pod ${name} in ml namespace`);
    try {
        pod_log = await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods(name).log.get();
        // console.log(pod_log);
        return pod_log.body;
    } catch (err) {
        console.log(`can't get pod ${name} log.`);
    }
}

// function follow_events() {
//     const stream = client.apis.apps.v1.watch.namespaces(ml_front_config.NAMESPACE).pods.getStream();
//     const jsonStream = new JSONStream();
//     stream.pipe(jsonStream);
//     jsonStream.on('data', object => {
//         console.log('Event: ', JSON.stringify(object, null, 2));
//     });
// }

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
        jupyterPodManifest.spec.containers[0].resources.limits["memory"] = 2 * memory + "Gi";
        jupyterPodManifest.spec.containers[0].resources.requests["cpu"] = cpu;
        jupyterPodManifest.spec.containers[0].resources.limits["cpu"] = 2 * cpu;
        jupyterPodManifest.spec.containers[0].args[2] = pass;
        jupyterPodManifest.spec.containers[0].args[3] = repo;
        jupyterPodManifest.spec.serviceAccountName = ml_front_config.NAMESPACE + '-fronter';

        await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.post({ body: jupyterPodManifest });
    } catch (err) {
        console.error("Error in creating jupyter pod:  " + err);
        error = new Error("Error in creating jupyter pod:  " + err);
        error.status = 500;
        return error;
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
            error = new Error("Error in creating jupyter ingress:  " + err);
            error.status = 500;
            return error;
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
        error = new Error("Error in creating jupyter service:  " + err);
        error.status = 500;
        return error;
    }

    console.log(`Jupyter and service ${name} successfully deployed.`);
};

const jupyterCreator = async (req, res, next) => {

    if (req.body === 'undefined' || req.body === null) {
        res.status(400).send('nothing POSTed.');
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

    await cleanup(req.body.name);

    try {
        await create_jupyter(
            req.session.sub_id,
            req.body.name, req.body.password,
            req.body.gpus, req.body.cpus, req.body.memory, req.body.time, req.body.repository);
    } catch (err) {
        console.log("Some error in creating jupyter.", err);
        res.status(500).send('Some error in creating your JupyterLab.');
    }

    try {
        res.link = await get_service_link(req.body.name);
        var user = await get_user(req.session.sub_id);
        var service_description = {
            service: "privatejupyter",
            name: req.body.name,
            ttl: req.body.time,
            gpus: req.body.gpus,
            cpus: req.body.cpus,
            memory: req.body.memory,
            link: res.link,
            repository: req.body.repository
        };
        await user.add_service(service_description);
        next();
    } catch (err) {
        console.log("Some error in getting service link.", err);
        res.status(500).send('Some error in creating your JupyterLab.');
    }
};

async function create_spark_pod(owner, name, path, executors) {

    console.log("Starting spark job: ", name, path, executors);

    try {
        const sparkPodManifest = require(ml_front_config.SPARK_POD);
        sparkPodManifest.metadata.name = name;
        sparkPodManifest.metadata.namespace = ml_front_config.NAMESPACE;
        sparkPodManifest.metadata.labels["instance"] = name;
        sparkPodManifest.metadata.labels["owner"] = owner;
        sparkPodManifest.spec.containers[0].args[4] = "spark.kubernetes.namespace=" + ml_front_config.NAMESPACE;
        sparkPodManifest.spec.containers[0].args[10] = "spark.executor.instances=" + executors;
        sparkPodManifest.spec.containers[0].args[14] = "spark-" + name;
        sparkPodManifest.spec.containers[0].args[15] = path;
        // sparkPodManifest.spec.containers[0].resources.requests["memory"] = memory + "Gi";
        // sparkPodManifest.spec.containers[0].resources.limits["memory"] = 2 * memory + "Gi";
        // sparkPodManifest.spec.containers[0].resources.requests["cpu"] = cpu;
        // sparkPodManifest.spec.containers[0].resources.limits["cpu"] = 2 * cpu;
        console.log(sparkPodManifest)
        await client.api.v1.namespaces(ml_front_config.NAMESPACE).pods.post({ body: sparkPodManifest });
    } catch (err) {
        console.error("Error in creating spark pod:  " + err);
        error = new Error("Error in creating spark pod:  " + err);
        error.status = 500;
        return error;
    }

    console.log(`Spark pod ${name} successfully deployed.`);
};

const sparkCreator = async (req, res, next) => {

    await cleanup(req.body.name);

    try {
        await create_spark_pod(
            req.session.sub_id,
            req.body.name, req.body.exe_path,
            req.body.executors);
    } catch (err) {
        console.log("Some error in creating spark pod.", err);
        res.status(500).send('Some error in creating your spark pod.');
    }

    try {
        //TODO - get driver name so logs could be looked up.
        // res.link = await get_service_link(req.body.name);
        var user = await get_user(req.session.sub_id);
        var service_description = {
            service: "sparkjob",
            name: req.body.name,
            // gpus: req.body.gpus,
            // cpus: req.body.cpus,
            // memory: req.body.memory,
            // link: res.link,
            executors: req.body.executors,
            repository: req.body.exe_path
        };
        await user.add_service(service_description);
        next();
    } catch (err) {
        console.log("Some error in getting service link.", err);
        res.status(500).send('Some error in creating your JupyterLab.');
    }
};

const requiresLogin = async (req, res, next) => {
    // to be used as middleware

    if (req.session.loggedIn !== true) {
        error = new Error('You must be logged in to view this page.');
        error.status = 403;
        return next(error);
    }

    if (ml_front_config.APPROVAL_REQUIRED === false)
        return next();

    console.log("Authorization required - searching for: ", req.session.sub_id);
    var user = await get_user(req.session.sub_id);
    if (user.approved === true) {
        console.log("authorized.");
        return next();
    }
    error = new Error('You must be authorized for this service.');
    error.status = 403;
    return next(error);
};


app.get('/delete/:jservice', requiresLogin, function (request, response) {
    var jservice = request.params.jservice;
    cleanup(jservice);
    response.redirect("/index.html");
});

app.get('/log/:podname', requiresLogin, async function (request, response) {
    var podname = request.params.podname;
    plog = await get_log(podname);
    // console.log(plog.replace(/(?:\r\n|\r|\n)/g, '<br>'));
    response.render("podlog", { pod_name: podname, content: plog.replace(/(?:\r\n|\r|\n)/g, '<br>') });
});

app.get('/get_users_services/:servicetype', async function (req, res) {
    var servicetype = req.params.servicetype;
    console.log('user:', req.session.sub_id, 'running services.', servicetype);
    await running_users_services(req.session.sub_id, servicetype)
        .then(function (resp) {
            console.log(resp);
            res.status(200).send(resp);
        }, function (err) {
            console.trace(err.message);
        });
});

app.get('/get_services_from_es/:servicetype', async function (req, res) {
    console.log(req.params);
    var servicetype = req.params.servicetype;
    console.log('user:', req.session.sub_id, 'service:', servicetype);
    var user = await get_user(req.session.sub_id);
    var services = await user.get_services(servicetype);
    console.log(services);
    res.status(200).send(services);
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

app.get('/plugins', function (req, res) {
    // console.log('sending plugins info back.');
    res.json({
        PRIVATE_JUPYTER: ml_front_config.PRIVATE_JUPYTER,
        TFAAS: ml_front_config.TFAAS,
        PUBLIC_INSTANCE: ml_front_config.PUBLIC_INSTANCE,
        MONITOR: ml_front_config.MONITOR,
        SPARK: ml_front_config.SPARK
    });
});

app.post('/jupyter', requiresLogin, jupyterCreator, (req, res) => {
    console.log('Private Jupyter created!');
    res.status(200).send(res.link);
});

app.post('/spark', requiresLogin, sparkCreator, (req, res) => {
    console.log('Spark job created!');
    res.status(200).send("OK");
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
    };

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
        };

        request.post(idrequestOptions, async function (error, response, body) {
            if (error) {
                console.log('error on geting username:\t', error);
            }
            console.log('body:\t', body);
            const user = new userm();
            user.id = req.session.sub_id = body.sub;
            user.username = req.session.username = body.preferred_username;
            user.affiliation = req.session.organization = body.organization;
            user.name = req.session.name = body.name;
            user.email = req.session.email = body.email;
            var found = await user.load();
            if (found === false) {
                await user.write();
            }
            req.session.authorized = user.approved;
            if (user.approved === false) {
                user.ask_for_approval();
            }
            res.redirect("index.html");
        });

    });

});

app.get('/authorize/:user_id', async function (req, res) {
    console.log('Authorizing user...');
    var user = await get_user(req.params.user_id);
    user.approve();
    res.redirect("/users.html");
});

app.get('/users_data', async function (req, res) {
    console.log('Sending all users info...');
    const user = new userm();
    var data = await user.get_all_users();
    res.status(200).send(data);
    console.log('Done.');
});


app.use((err, req, res, next) => {
    console.error('Error in error handler: ', err.message);
    res.status(err.status).send(err.message);
});


var httpsServer = https.createServer(credentials, app).listen(443);

// redirects if someone comes on http.
http.createServer(function (req, res) {
    res.writeHead(302, { 'Location': 'https://' + ml_front_config.SITENAME });
    res.end();
}).listen(80);


async function main() {

    try {
        await configureKube();
        await show_pods();
    } catch (err) {
        console.error('Error: ', err);
    }
}

main();
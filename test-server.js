var fs = require('fs');

var express = require('express');
var http = require('http');

var request = require('request');


console.log('ML_front server starting on localhost:8080 ');


var ml_front_config = require('./kube/ml-usatlas-org/secrets/config.json');

const userm = require('./user.js');

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

require('./routes/user')(app);
require('./routes/spark')(app);
require('./routes/jupyter')(app);
// Elasticsearch

var es_client = new elasticsearch.Client({
    host: 'atlas-kibana.mwt2.org:9200',
    log: 'error'
});

async function get_user(id) {
    var user = new userm();
    user.id = id;
    await user.load();
    return user;
}

app.get('/get_services_from_es', async function (req, res) {
    console.log('user:', req.session.sub_id, 'services...');
    const user = await get_user(req.session.sub_id);
    var services = await user.get_services();
    console.log(services);
    res.status(200).send(services);
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

app.get('/login', (req, res) => {
    console.log('Logging in');
    // const user = new userm();
    // user.id = req.session.sub_id = body.sub;
    // user.username = req.session.username = body.preferred_username;
    // user.affiliation = req.session.organization = body.organization;
    // user.name = req.session.name = body.name;
    // user.email = req.session.email = body.email;
    // var found = await user.load();
    req.session.authorized = true;
    req.session.loggedIn = true;
    res.redirect("index.html");
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

app.get('/users_data', async function (req, res) {
    console.log('Sending all users info...');
    const user = new userm();
    var data = await user.get_all_users();
    res.status(200).send(data);
    console.log('Done.')
});

app.get('/authorize/:user_id', async function (req, res) {
    console.log('Authorizing user...')
    const user = await get_user(req.params.user_id);
    user.approve();
    res.redirect("/users.html");
});

app.use((err, req, res, next) => {
    console.error('Error in error handler: ', err.message);
    res.status(err.status).send(err.message);
});


var httpsServer = http.createServer(app).listen(8080);

async function main() {

    // const user = new userm();
    // var usrs = await user.get_all_users();
    // console.log(usrs);

    // user.id = "0000000-0000-0000-0000-00000000000";
    // user.affiliation = "Ilija test center";
    // user.email = "ilija@vukotic.me";
    // user.name = "Ilija Vukotic";
    // user.username = "ilijatester";
    // var found = await user.load();
    // if (found == false) {
    //     await user.write();
    //     user.ask_for_approval();
    //     await user.approve();
    //     user.print();

    //     const u = await get_user("0000000-0000-0000-0000-00000000000");
    //     var service_description = {
    //         service: "Private JupyterLab",
    //         name: "req.body.name",
    //         ttl: 1,
    //         gpus: 0,
    //         cpus: 0,
    //         memory: 0,
    //         link: "res.link",
    //         repository: "req.body.repository"
    //     };
    //     await u.add_service(service_description);


    //     var services = await u.get_services();
    //     console.log(services);
    // } else {
    //     user.print();
    //     await user.delete();
    // }

}

main();
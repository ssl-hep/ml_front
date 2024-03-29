/* eslint-disable no-multi-assign */
const fs = require('fs');
const express = require('express');
const https = require('https');
// const http = require('http');
const mrequest = require('request');
const k8s = require('@kubernetes/client-node');

const session = require('express-session');

console.log('ML_front server starting ... ');

const TEST = false;

let config;
let privateKey;
let certificate;
let globConf;

if (!TEST) {
  config = JSON.parse(fs.readFileSync('/etc/ml-front-conf/mlfront-config.json', 'utf8'));
  globConf = JSON.parse(fs.readFileSync('/etc/globus-conf/globus-config.json', 'utf8'));
  if (!config.INGRESS_CONTROLLER) {
    privateKey = fs.readFileSync('/etc/https-certs/key.pem');
    certificate = fs.readFileSync('/etc/https-certs/cert.pem');
  }
} else {
  config = JSON.parse(fs.readFileSync('./kube/test-ml/secrets/config.json', 'utf8'));
  globConf = JSON.parse(fs.readFileSync('./kube/test-ml/secrets/globus-config.json', 'utf8'));
  if (!config.INGRESS_CONTROLLER) {
    privateKey = fs.readFileSync('./kube/test-ml/secrets/certificates/test-ml.pem');
    certificate = fs.readFileSync('./kube/test-ml/secrets/certificates/test-ml.pem');
  }
}

console.log(config);

// App
const app = express();

app.use(express.static('./static'));
app.use(express.static(`./instances/${config.STATIC_PATH}/static/`));

app.set('view engine', 'pug');
const path = require('path');

app.set('views', path.join(__dirname, `/instances/${config.STATIC_PATH}`));

app.use(express.json()); // to support JSON-encoded bodies
app.use(session({
  secret: 'mamicu mu njegovu',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 3600000 },
}));

const usr = require('./routes/user')(app, config);
require('./routes/spark')(app);
require('./routes/jupyter')(app, config);

// GLOBUS STUFF
let auth = Buffer.from(`${globConf.CLIENT_ID}:${globConf.CLIENT_SECRET}`, 'utf8').toString('base64');
auth = `Basic ${auth}`;

let k8sCoreApi;
let k8sNetwApi;

async function configureKube() {
  try {
    console.log('configuring k8s client');
    const kc = new k8s.KubeConfig();
    if (TEST) {
      kc.loadFromDefault();
    } else {
      kc.loadFromCluster();
    }
    k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sNetwApi = kc.makeApiClient(k8s.NetworkingV1Api);
    console.log('client configured');
  } catch (err) {
    console.log('Ilija - error in configureKube\n', err);
    process.exit(2);
  }
}

async function getPodState(name) {
  console.log(`Looking for pod ${name} in ${config.NAMESPACE} namespace`);
  try {
    const pods = await k8sCoreApi.listNamespacedPod(config.NAMESPACE);
    for (const pod of pods.body.items) {
      if (pod.metadata.name === name) {
        return pod.status.phase;
      }
    }
  } catch (err) {
    console.log(`can't get pod ${name}. Error: ${err}.`);
  }
  console.log(`no pod named: ${name}.`);
  return false;
}

async function getServiceLink(name) {
  console.log(`Looking for service ${name}.`);
  try {
    if (config.JL_INGRESS) {
      const ingress = await k8sNetwApi.listNamespacedIngress(config.NAMESPACE);
      for (const ing of ingress.body.items) {
        if (ing.metadata.name === name) {
          const link = ing.spec.tls[0].hosts[0];
          console.log(`found ingress ${link}`);
          if (config.SSL === true) {
            return `https://${link}`;
          }
          return `http://${link}`;
        }
      }
    } else {
      console.log('Ilija - not coded for non Ingress instances.');
      process.exit(3);
    }
    // this part not rewritten as I can't test now without ingress
    // const service = await client.api.v1.namespaces(config.NAMESPACE).services(name).get();
    // console.log(service.body.spec.ports);
    // const link = service.body.metadata.labels.servingat;
    // const port = service.body.spec.ports[0].nodePort;
    // if (config.SSL === true) {
    //   return `https://${link}:${port}`;
    // }
    // return `http://${link}:${port}`;
  } catch (err) {
    console.log(`can't get service ${name}. Err: ${err}`);
  }
  return null;
}

async function cleanup(name) {
  try {
    await k8sCoreApi.deleteNamespacedPod(name, config.NAMESPACE);
    // await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log(`Pod ${name} deleted.`);
  } catch (err) {
    console.warn(`Unable to delete pod ${name}.  Skipping.`);
  }

  // while (await getPodState(name).catch() === 'running') {
  //   console.log('still alive. waiting.');
  //   await new Promise((resolve) => setTimeout(resolve, 1000));
  // }

  try {
    await k8sCoreApi.deleteNamespacedService(name, config.NAMESPACE);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log(`Service ${name} deleted.`);
  } catch (err) {
    console.warn(`Unable to delete service ${name}.  Skipping.`);
  }

  if (config.JL_INGRESS) {
    try {
      await k8sNetwApi.deleteNamespacedIngress(name, config.NAMESPACE);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log(`Ingress ${name} deleted.`);
    } catch (err) {
      console.warn(`Unable to delete ingress ${name}.  Skipping.`);
    }
  }
}

async function showPods() {
  console.log('all pods in this namespace');
  try {
    const pods = await k8sCoreApi.listNamespacedPod(config.NAMESPACE);
    pods.body.items.forEach((pod) => {
      console.log(pod.metadata.name);
      console.log(pod.spec.containers[0].resources);
    });
  } catch (err) {
    console.log("can't show all pods in this namespace.", err);
  }
}

async function runningUsersServices(owner, servicetype) {
  console.log("all user's pods in ml namespace", owner);
  const results = [];
  try {
    const pods = await k8sCoreApi.listNamespacedPod(config.NAMESPACE);
    for (const pod of pods.body.items) {
      // rewrite this part like this: https://codeburst.io/javascript-async-await-with-foreach-b6ba62bbf404
      // and replace continues with returns
      if (pod.metadata.labels !== undefined) {
        if (pod.metadata.labels.owner === owner && pod.metadata.labels['k8s-app'] === servicetype) {
          const crt = Date.parse(pod.metadata.creationTimestamp); // number

          if (pod.metadata.labels['k8s-app'] === 'privatejupyter') {
            const ttl = parseInt(pod.metadata.labels.time2delete.replace('ttl-', ''), 10);
            const endingat = new Date(crt + ttl * 86400000).toUTCString();
            const { resources } = pod.spec.containers[0];
            // console.log(resources);
            const gpus = resources.requests['nvidia.com/gpu'];
            const cpus = resources.requests.cpu;
            const ram = resources.requests.memory;
            const status = pod.status.phase;
            const link = await getServiceLink(pod.metadata.name);
            results.push(['Private JupyterLab', pod.metadata.name, new Date(crt).toUTCString(), endingat, gpus, cpus, ram, `<a href="${link}">${link}</a>`, status]);
          }

          if (pod.metadata.labels['k8s-app'] === 'sparkjob') {
            const execs = pod.spec.containers[0].args[10].replace('spark.executor.instances=', '');
            const spath = pod.spec.containers[0].args[15];

            results.push(['Spark Job', pod.metadata.name, new Date(crt).toUTCString(), pod.status.phase, execs, spath]);
          }
        }
      }
    }
  } catch (err) {
    console.log("can't show all pods in namespace ml", err);
  }
  console.log('running user services', results);
  return results;
}

async function enforceTime2delete() {
  const pods = await k8sCoreApi.listNamespacedPod(config.NAMESPACE);
  pods.body.items.forEach((pod) => {
    if (pod.metadata.labels !== undefined) {
      if (pod.metadata.labels['k8s-app'] === 'privatejupyter') {
        const ttd = parseInt(pod.metadata.labels.time2delete.replace('ttl-', ''), 10);
        const crt = Date.parse(pod.metadata.creationTimestamp);
        if (Date.now() > crt + ttd * 86400 * 1000) {
          console.log('Deleting:', pod.metadata.name);
          cleanup(pod.metadata.name);
        } else {
          console.log('name:', pod.metadata.name, ' remaining time: ', (crt + ttd * 86400 * 1000 - Date.now()) / 3600000, ' hours.');
        }
      }
    }
  });
}

async function getLog(name) {
  console.log(`Logs for pod ${name} in ml namespace`);
  try {
    const podLog = await k8sCoreApi.readNamespacedPodLog(name, config.NAMESPACE);
    // console.log(podLog);
    return podLog.body;
  } catch (err) {
    console.log(`can't get pod ${name} log.`);
    return null;
  }
}

async function createJupyter(owner, name, pass, gpu, cpu = 1, memory = '12', time, repo, image) {
  console.log('Deploying jupyter: ', name, pass, gpu, cpu, memory, time, repo);

  try {
    const jupyterPodManifest = JSON.parse(fs.readFileSync(config.JL_POD, 'utf8'));
    jupyterPodManifest.metadata.name = name;
    jupyterPodManifest.metadata.namespace = config.NAMESPACE;
    jupyterPodManifest.metadata.labels.time2delete = `ttl-${String(time)}`;
    jupyterPodManifest.metadata.labels.instance = name;
    jupyterPodManifest.metadata.labels.owner = owner;
    jupyterPodManifest.spec.containers[0].image = image;
    jupyterPodManifest.spec.containers[0].resources.requests['nvidia.com/gpu'] = gpu;
    jupyterPodManifest.spec.containers[0].resources.limits['nvidia.com/gpu'] = gpu;
    jupyterPodManifest.spec.containers[0].resources.requests.memory = `${memory}Gi`;
    jupyterPodManifest.spec.containers[0].resources.limits.memory = `${2 * memory}Gi`;
    jupyterPodManifest.spec.containers[0].resources.requests.cpu = cpu;
    jupyterPodManifest.spec.containers[0].resources.limits.cpu = 2 * cpu;
    jupyterPodManifest.spec.containers[0].args[2] = pass;
    jupyterPodManifest.spec.containers[0].args[3] = repo;
    jupyterPodManifest.spec.serviceAccountName = `${config.NAMESPACE}-fronter`;

    await k8sCoreApi.createNamespacedPod(config.NAMESPACE, jupyterPodManifest);
    console.log('pod deployed.');
  } catch (err) {
    console.error(`Error in creating jupyter pod: ${err}`);
    const error = new Error(`Error in creating jupyter pod: ${err}`);
    error.status = 500;
    return error;
  }

  try {
    const jupyterServiceManifest = JSON.parse(fs.readFileSync(config.JL_SERVICE, 'utf8'));
    jupyterServiceManifest.metadata.name = name;
    jupyterServiceManifest.metadata.namespace = config.NAMESPACE;
    jupyterServiceManifest.metadata.labels.instance = name;
    jupyterServiceManifest.spec.selector.instance = name;
    await k8sCoreApi.createNamespacedService(config.NAMESPACE, jupyterServiceManifest);
    console.log('service deployed.');
  } catch (err) {
    console.error(`Error in creating jupyter service: ${err}`);
    const error = new Error(`Error in creating jupyter service: ${err}`);
    error.status = 500;
    return error;
  }

  if (config.JL_INGRESS) {
    try {
      const jupyterIngressManifest = JSON.parse(fs.readFileSync(config.JL_INGRESS.INGRESS, 'utf8'));

      jupyterIngressManifest.metadata.name = name;
      jupyterIngressManifest.metadata.namespace = config.NAMESPACE;
      jupyterIngressManifest.metadata.labels.instance = name;
      if (config.JL_INGRESS.annotations) {
        jupyterIngressManifest.metadata.annotations = config.JL_INGRESS.annotations;
      }
      const host = `${name}.${config.JL_INGRESS.host}`;
      jupyterIngressManifest.spec.rules[0].host = host;
      if (jupyterIngressManifest.spec.tls) {
        jupyterIngressManifest.spec.tls[0].hosts[0] = host;
        jupyterIngressManifest.spec.tls[0].secretName = `autogenerated-${name}`;
      }
      jupyterIngressManifest.spec.rules[0].http.paths[0].backend.service.name = name;
      await k8sNetwApi.createNamespacedIngress(config.NAMESPACE, jupyterIngressManifest);
      console.log('ingress deployed.');
    } catch (err) {
      console.error(`Error in creating jupyter ingress: ${err}`);
      const error = new Error(`Error in creating jupyter ingress: ${err}`);
      error.status = 500;
      return error;
    }
  }

  console.log(`Jupyter: ${name} successfully deployed.`);
  return null;
}

async function createSparkPod(owner, name, spath, executors) {
  console.log('Starting spark job: ', name, spath, executors);

  try {
    const sparkPodManifest = JSON.parse(fs.readFileSync(config.SPARK_POD, 'utf8'));
    sparkPodManifest.metadata.name = name;
    sparkPodManifest.metadata.namespace = config.NAMESPACE;
    sparkPodManifest.metadata.labels.instance = name;
    sparkPodManifest.metadata.labels.owner = owner;
    sparkPodManifest.spec.containers[0].args[4] = `spark.kubernetes.namespace=${config.NAMESPACE}`;
    sparkPodManifest.spec.containers[0].args[10] = `spark.executor.instances=${executors}`;
    sparkPodManifest.spec.containers[0].args[14] = `spark-${name}`;
    sparkPodManifest.spec.containers[0].args[15] = spath;
    // sparkPodManifest.spec.containers[0].resources.requests["memory"] = memory + "Gi";
    // sparkPodManifest.spec.containers[0].resources.limits["memory"] = 2 * memory + "Gi";
    // sparkPodManifest.spec.containers[0].resources.requests["cpu"] = cpu;
    // sparkPodManifest.spec.containers[0].resources.limits["cpu"] = 2 * cpu;
    console.log(sparkPodManifest);

    await k8sCoreApi.createNamespacedPod(config.NAMESPACE, sparkPodManifest);
  } catch (err) {
    console.error(`Error in creating spark pod:  ${err}`);
    const error = new Error(`Error in creating spark pod:  ${err}`);
    error.status = 500;
    return error;
  }

  console.log(`Spark pod ${name} successfully deployed.`);
  return null;
}

const jupyterCreator = async (req, res, next) => {
  if (req.body === 'undefined' || req.body === null) {
    const err = new Error('nothing POSTed');
    err.status = 500;
    next(err);
  }

  console.log('body:', req.body);

  if (
    typeof req.body.name !== 'undefined' && req.body.name
    && typeof req.body.password !== 'undefined' && req.body.password
    && typeof req.body.gpus !== 'undefined' && req.body.gpus
    && typeof req.body.time !== 'undefined' && req.body.time
  ) {
    console.log('Creating a private JupyterLab.');
    try {
      req.body.time = parseInt(req.body.time, 10);
      req.body.gpus = parseInt(req.body.gpus, 10);
    } catch (error) {
      const err = new Error('Unparsable parameters.');
      err.status = 500;
      next(err);
    }
  } else {
    const err = new Error('Not all parameters POSTed.');
    err.status = 500;
    next(err);
  }

  await cleanup(req.body.name);

  try {
    await createJupyter(
      req.session.user_id, req.body.name, req.body.password,
      req.body.gpus, req.body.cpus, req.body.memory, req.body.time,
      req.body.repository, req.body.image,
    );
  } catch (err) {
    console.log('Some error in creating jupyter.', err);
    next(err);
  }

  try {
    res.link = await getServiceLink(req.body.name);

    const user = new usr.User(req.session.user_id);
    await user.load();
    const serviceDescription = {
      service: 'privatejupyter',
      name: req.body.name,
      ttl: req.body.time,
      gpus: req.body.gpus,
      cpus: req.body.cpus,
      memory: req.body.memory,
      link: res.link,
      repository: req.body.repository,
    };
    await user.AddService(serviceDescription);
    next();
  } catch (err) {
    console.log('Some error in getting service link.', err);
    next(err);
  }
};

const sparkCreator = async (req, res, next) => {
  await cleanup(req.body.name);

  try {
    await createSparkPod(
      req.session.user_id,
      req.body.name, req.body.exe_path,
      req.body.executors,
    );
  } catch (err) {
    console.log('Some error in creating spark pod.', err);
    res.status(500).send('Some error in creating your spark pod.');
  }

  try {
    // TODO - get driver name so logs could be looked up.
    // res.link = await getServiceLink(req.body.name);

    const user = new usr.User(req.session.user_id);
    await user.load();
    const serviceDescription = {
      service: 'sparkjob',
      name: req.body.name,
      executors: req.body.executors,
      repository: req.body.exe_path,
    };
    await user.AddService(serviceDescription);
    next();
  } catch (err) {
    console.log('Some error in getting service link.', err);
    res.status(500).send('Some error in creating your SaprkJob.');
  }
};

const requiresLogin = async (req, _res, next) => {
  // to be used as middleware

  if (req.session.loggedIn !== true) {
    console.log('NOT logged in!');
    const error = new Error('You must be logged in to view this page.');
    error.status = 401;
    return next(error);
  }

  if (config.APPROVAL_REQUIRED === false) return next();

  console.log('Authorization required - searching for: ', req.session.user_id);

  const user = new usr.User(req.session.user_id);
  await user.load();

  if (user.approved === true) {
    console.log('authorized.');
    return next();
  }

  console.log('NOT authorized!');
  const error = new Error('You must be authorized for this service.');
  error.status = 403;
  return next(error);
};

// =============   routes ========================== //

app.get('/delete/:jservice', requiresLogin, (request, response) => {
  const { jservice } = request.params;
  cleanup(jservice);
  response.redirect('/');
});

app.get('/log/:podname', requiresLogin, async (request, response) => {
  const { podname } = request.params;
  const plog = await getLog(podname);
  // console.log(plog.replace(/(?:\r\n|\r|\n)/g, '<br>'));
  response.render('podlog', { pod_name: podname, content: plog.replace(/(?:\r\n|\r|\n)/g, '<br>') });
});

app.get('/get_users_services/:servicetype', async (req, res) => {
  const { servicetype } = req.params;
  await runningUsersServices(req.session.user_id, servicetype)
    .then((resp) => {
      console.log(`user ${req.session.user_id} running ${servicetype} services: ${resp}.`);
      res.status(200).send(resp);
    }, (err) => {
      console.trace(err.message);
    });
});

app.get('/get_services_from_es/:servicetype', async (req, res) => {
  console.log(req.params);
  const { servicetype } = req.params;
  console.log(`looking up user ${req.session.user_id} services of type ${servicetype} in ES.`);
  const user = new usr.User(req.session.user_id);
  await user.load();
  user.print();
  const services = await user.getServices(servicetype);
  console.log(`according to ES user had services: ${services}`);
  res.status(200).send(services);
});

app.post('/jupyter', requiresLogin, jupyterCreator, (_req, res) => {
  console.log(`Private Jupyter created and accessible at ${res.link}`);
  res.status(200).send(res.link);
});

app.post('/spark', requiresLogin, sparkCreator, (_req, res) => {
  console.log('Spark job created!');
  res.status(200).send('OK');
});

app.get('/profile', requiresLogin, async (req, res) => {
  console.log('profile called!');
  res.render('profile', req.session);
});

app.get('/users', requiresLogin, async (req, res) => {
  console.log('users called!');
  res.render('users', req.session);
});

app.get('/login', async (req, res) => {
  console.log('Logging in');
  if (config.TESTING) {
    const user = new usr.User('test_id');
    await user.load();
    console.log('fake loaded');
    user.write();
    console.log('fake written.');
    req.session.user_id = user.id;
    req.session.name = user.name;
    req.session.username = user.username;
    req.session.affiliation = user.affiliation;
    req.session.email = user.email;
    req.session.loggedIn = true;
    res.render('index', req.session);
  } else {
    const red = `${globConf.AUTHORIZE_URI}?scope=urn%3Aglobus%3Aauth%3Ascope%3Aauth.globus.org%3Aview_identities+openid+email+profile&state=garbageString&redirect_uri=${globConf.redirect_link}&response_type=code&client_id=${globConf.CLIENT_ID}`;
    // console.log('redirecting to:', red);
    res.redirect(red);
  }
});

app.get('/logout', (req, res) => { // , next
  if (req.session.loggedIn) {
    // logout from Globus
    const requestOptions = {
      uri: `https://auth.globus.org/v2/web/logout?client_id=${globConf.CLIENT_ID}`,
      headers: {
        Authorization: `Bearer ${req.session.token}`,
      },
      json: true,
    };

    mrequest.get(requestOptions, (error) => { // , response, body
      if (error) {
        console.log('logout failure...', error);
      }
      console.log('globus logout success.\n');
    });
  }
  req.session.destroy();

  res.redirect('/');
});

app.get('/authcallback', (req, res) => {
  console.log('AUTH CALLBACK query:', req.query);
  let { code } = req.query;
  if (code) {
    console.log('there is a code. first time around.');
    code = req.query.code;
    const { state } = req.query;
    console.log('AUTH CALLBACK code:', code, '\tstate:', state);
  } else {
    console.log('NO CODE call...');
  }

  const red = `${globConf.TOKEN_URI}?grant_type=authorization_code&redirect_uri=${globConf.redirect_link}&code=${code}`;

  const requestOptions = {
    uri: red, method: 'POST', headers: { Authorization: auth }, json: true,
  };

  // console.log(requestOptions);

  mrequest.post(requestOptions, (error, _response, body) => {
    if (error) {
      console.log('failure...', error);
      res.redirect('/');
    }
    console.log('success');// , body);

    req.session.loggedIn = true;

    console.log('==========================\n getting name.');
    const idRed = 'https://auth.globus.org/v2/oauth2/userinfo';
    const idrequestOptions = {
      uri: idRed,
      method: 'POST',
      json: true,
      headers: { Authorization: `Bearer ${body.access_token}` },
    };

    mrequest.post(idrequestOptions, async (lerror, _lresponse, lbody) => {
      if (lerror) {
        console.log('error on geting username:\t', lerror);
      }
      console.log('body:\t', lbody);
      const user = new usr.User();
      user.id = req.session.user_id = lbody.sub;
      user.username = req.session.username = lbody.preferred_username;
      user.affiliation = req.session.affiliation = lbody.organization;
      user.name = req.session.name = lbody.name;
      user.email = req.session.email = lbody.email;
      const found = await user.load();
      if (found === false) {
        await user.write();
      }
      console.log('user is authorized:', user.approved);
      req.session.authorized = user.approved;
      if (user.approved === false) {
        user.askForApproval();
      }
      res.render('index', req.session);
    });
  });
});

app.get('/about', async (req, res) => {
  console.log('about called!');
  res.render('about', req.session);
});

app.get('/healthz', (_req, res) => {
  // console.log('Checking health and if some private pod/service needs deletion.');
  try {
    enforceTime2delete();
    res.status(200).send('OK');
  } catch (err) {
    console.log("can't get check time2delete for all pods in namespace ml", err);
  }
});

app.get('/', async (req, res) => {
  console.log('===========> / CALL');
  if (req.session.loggedIn === undefined) {
    console.log('Defining...');
    req.session.loggedIn = !config.APPROVAL_REQUIRED;
    req.session.Title = config.TITLE;
    req.session.plugins = config.PLUGINS;
  }
  console.log(req.session);
  res.render('index', req.session);
});

app.use((err, req, res, _next) => {
  console.log(`I'm the error handler. '${err.message}' status: ${err.status} `);
  res.render('error', { code: err.status, text: err.message });
});

app.use((req, res) => {
  console.error('Unexisting page requested:', req.path);
  console.error('Parameters:', req.params);
  res.status(404);
  res.render('error', { code: 404, text: 'No such page.' });
});

if (!config.TESTING && !config.INGRESS_CONTROLLER) {
  https.createServer({ key: privateKey, cert: certificate }, app).listen(443);
} else {
  app.listen(80, () => {
    console.log('Listening on port 80.');
  });
}

async function main() {
  try {
    if (!config.TESTING) {
      await configureKube();
      await showPods();
    }
  } catch (err) {
    console.error('Error: ', err);
  }
}

main();

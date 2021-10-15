const formData = require('form-data');
const Mailgun = require('mailgun.js');
const elasticsearch = require('@elastic/elasticsearch');

module.exports = function us(app, config) {
  let mgConfig;

  if (!config.TESTING) {
  //   config = require('/etc/ml-front-conf/mlfront-config.json');
    mgConfig = require('/etc/mg-conf/config.json');
  } else {
  //   config = require('../kube/test-ml/secrets/config.json');
    mgConfig = require('../kube/test-ml/secrets/mg-config.json');
  }

  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({ username: 'api', key: mgConfig.APPROVAL_MG });

  const module = {};

  module.User = class User {
    constructor(id = null) {
      this.es = new elasticsearch.Client({ node: config.ES_HOST, log: 'error' });
      this.approved_on = 0;
      this.approved = false;
      if (!config.APPROVAL_REQUIRED) {
        this.approved_on = new Date().getTime();
        this.approved = true;
      }
      this.created_at = new Date().getTime();
      this.tzar = config.APPROVAL_EMAIL;
      if (id) { this.id = id; }
    }

    async write() {
      console.log('adding user to ES...');
      try {
        const response = await this.es.index({
          index: 'mlfront_users',
          id: this.id,
          refresh: true,
          body: {
            username: this.username,
            affiliation: this.affiliation,
            user: this.name,
            email: this.email,
            event: config.EVENT,
            created_at: new Date().getTime(),
            approved: this.approved,
            approved_on: this.approved_on,
          },
        });
        console.log(response);
      } catch (err) {
        console.error(err);
      }
      console.log('Done.');
    }

    async delete() {
      console.log('deleting user from ES...');
      try {
        const response = await this.es.deleteByQuery({
          index: 'mlfront_users',
          body: { query: { match: { _id: this.id } } },
        });
        console.log(response);
      } catch (err) {
        console.error(err);
      }
      console.log('Done.');
    }

    async update() {
      console.log('Updating user info in ES...');
      const req = {
        index: 'mlfront_users',
        id: this.id,
        body: {
          doc: {
            approved_on: this.approved_on,
            approved: this.approved,
          },
        },
      };
      console.log(req);
      try {
        const response = await this.es.update(req);
        console.log(response);
      } catch (err) {
        console.error(err);
      }
      console.log('Done.');
    }

    async load() {
      console.log("getting user's info...");

      if (config.TESTING) {
        this.name = 'Test User';
        this.username = 'testUsername';
        this.email = 'test@email.com';
        this.affiliation = 'Test Institution';
        this.created_at = new Date().getTime();
        this.approved = true;
        this.approved_on = new Date().getTime();
        console.log('test user loaded.');
        return true;
      }

      try {
        const response = await this.es.search({
          index: 'mlfront_users',
          body: {
            query: {
              bool: {
                must: [
                  { match: { event: config.EVENT } },
                  { match: { _id: this.id } },
                ],
              },
            },
          },
        });

        if (response.body.hits.total.value === 0) {
          console.log('user not found.');
          return false;
        }
        console.log('User found.');
        const obj = response.body.hits.hits[0]._source;
        // console.log(obj);
        // var created_at = new Date(obj.created_at).toUTCString();
        // var approved_on = new Date(obj.approved_on).toUTCString();
        this.name = obj.user;
        this.email = obj.email;
        this.affiliation = obj.affiliation;
        this.created_at = obj.created_at;
        this.approved = obj.approved;
        this.approved_on = obj.approved_on;
        return true;
      } catch (err) {
        console.error(err);
      }
      console.log('Done.');
      return false;
    }

    async approve() {
      this.approved = true;
      this.approved_on = new Date().getTime();
      await this.update();
      const body = {
        from: `${config.EVENT}<${config.EVENT}@maniac.uchicago.edu>`,
        to: this.email,
        subject: 'Authorization approved',
        text: `Dear ${this.name},\n\n\tyour request for access to ${config.EVENT} ML front has been approved.\n\nBest regards,\n\tML front Approval system.`,
      };
      User.sendMailToUser(body);
    }

    static sendMailToUser(data) {
      mg.messages.create(config.SITENAME, data)
        .then((msg) => console.log(`mailgun response:${msg}`))
        .catch((err) => console.log(`mailgun error: ${err}`));
    }

    askForApproval() {
      if (config.hasOwnProperty('APPROVAL_EMAIL')) {
        const link = `https://${config.SITENAME}/authorize/${this.id}`;
        const data = {
          from: `${config.EVENT}<${config.EVENT}@maniac.uchicago.edu>`,
          to: config.APPROVAL_EMAIL,
          subject: 'Authorization requested',
          text: `Dear Sir/Madamme, \n\n\t${this.name} affiliated with ${this.affiliation} requested access to ${config.EVENT} ML front.\n\tTo approve it use this link ${link}. To deny the request simply delete this mail.\n\nBest regards,\n\tML front Approval system`,
        };
        User.sendMailToUser(data);
      } else {
        console.error("Approval person's mail or mailgun key not configured.");
      }
    }

    async AddService(service) {
      try {
        service.owner = this.id;
        service.timestamp = new Date().getTime();
        service.user = this.name;
        service.event = config.EVENT;
        console.log('creating service in es: ', service);
        const response = await this.es.index({ index: 'ml_front', body: service });
        console.log('from ES indexer:', response.body.result);
      } catch (err) {
        console.error(err);
      }
    }

    async terminateService(name) {
      console.log('terminating service in ES: ', name, 'owned by', this.id);
      console.log('not implemented yet.');
      // try {
      //     const response = await this.es.update({
      //         index: 'ml_front',  id: this.id,
      //         body: {
      //             doc: {
      //                 "terminated_on": new Date().getTime(),
      //                 "terminated": true
      //             }
      //         }
      //     });
      //     console.log(response);
      // } catch (err) {
      //     console.error(err)
      // }
      console.log('Done.');
    }

    async getServices(servicetype) {
      console.log('getting all services >', servicetype, '< of user:', this.id);
      try {
        const resp = await this.es.search({
          index: 'ml_front',
          body: {
            query: {
              bool: {
                must: [
                  { match: { event: config.EVENT } },
                  { match: { owner: this.id } },
                ],
              },
            },
            sort: { timestamp: { order: 'desc' } },
          },
        });
        const toSend = [];
        if (resp.body.hits.total.value > 0) {
          // console.log(resp.body.hits.hits);
          for (let i = 0; i < resp.body.hits.hits.length; i++) {
            const obj = resp.body.hits.hits[i]._source;
            if (obj.service !== servicetype) continue;
            console.log(obj);
            const startDate = new Date(obj.timestamp).toUTCString();
            if (servicetype === 'privatejupyter') {
              const endDate = new Date(obj.timestamp + obj.ttl * 86400000).toUTCString();
              const serv = [
                obj.service,
                obj.name,
                startDate,
                endDate,
                obj.gpus,
                obj.cpus,
                obj.memory,
              ];
              toSend.push(serv);
            }
            if (servicetype === 'sparkjob') {
              const serv = [obj.service, obj.name, startDate, obj.executors, obj.repository];
              toSend.push(serv);
            }
          }
        } else {
          console.log('no services found.');
        }
        return toSend;
      } catch (err) {
        console.error(err);
      }
      return [];
    }

    print() {
      console.log('- user id', this.id);
      console.log('- user name', this.name);
      console.log('- email', this.email);
      console.log('- affiliation', this.affiliation);
      console.log('- created at', this.created_at);
      console.log('- approved', this.approved);
      console.log('- approved on', this.approved_on);
    }

    async getAllUsers() {
      console.log('getting all users info from es.');
      try {
        const resp = await this.es.search({
          index: 'mlfront_users',
          body: {
            size: 1000,
            query: { match: { event: config.EVENT } },
            sort: { created_at: { order: 'desc' } },
          },
        });
        // console.log(resp);
        const toSend = [];
        if (resp.body.hits.total.value > 0) {
          // console.log("Users found:", resp.body.hits.hits);
          for (let i = 0; i < resp.body.hits.hits.length; i++) {
            const obj = resp.body.hits.hits[i]._source;
            // console.log(obj);
            const createdAt = new Date(obj.created_at).toUTCString();
            const approvedOn = new Date(obj.approved_on).toUTCString();
            const serv = [
              obj.user, obj.email, obj.affiliation, createdAt, obj.approved, approvedOn,
            ];
            toSend.push(serv);
          }
        } else {
          console.log('No users found.');
        }
        return toSend;
      } catch (err) {
        console.error(err);
      }
      console.log('Done.');
    }
  };

  // probably not needed.
  app.get('/user', (req, res) => {
    console.log('sending profile info back.');
    res.json({
      loggedIn: req.session.loggedIn,
      name: req.session.name,
      email: req.session.email,
      username: req.session.username,
      organization: req.session.organization,
      user_id: req.session.user_id,
      authorized: req.session.authorized,
    });
  });

  app.get('/users_data', async (req, res) => {
    console.log('Sending all users info...');
    const user = new module.User();
    const data = await user.getAllUsers();
    res.status(200).send(data);
    console.log('Done.');
  });

  app.get('/authorize/:user_id', async (req, res) => {
    console.log('Authorizing user...', req.params.user_id);
    const user = new module.User(req.params.user_id);
    if (await user.load()) {
      await user.approve();
      res.status(200).send(`User approved:${user.name}`);
    } else {
      res.status(500).send('User not found.');
    }
  });

  return module;
};

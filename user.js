
var elasticsearch = require('elasticsearch');

var config = require('/etc/ml-front-conf/mlfront-config.json');
var mg_config = require('/etc/mg-conf/config.json');

// for testing only.
// var config = require('./kube/ml-usatlas-org/secrets/config.json');
// var mg_config = require('./kube/ml-usatlas-org/secrets/mg-config.json');

module.exports = class User {

    constructor() {
        this.es = new elasticsearch.Client({ host: 'atlas-kibana.mwt2.org:9200', log: 'error' });
        this.mg = require('mailgun-js')({ apiKey: mg_config.APPROVAL_MG, domain: mg_config.MG_DOMAIN });
        this.approved_on = 0;
        this.approved = false;
        if (!config.APPROVAL_REQUIRED) {
            this.approved_on = new Date().getTime();;
            this.approved = true;
        }
        this.created_at = new Date().getTime();
        this.tzar = config.APPROVAL_EMAIL;
    }

    async write() {
        console.log("adding user to ES...");
        try {
            const response = await this.es.index({
                index: 'mlfront_users', type: 'docs', id: this.id,
                refresh: true,
                body: {
                    "username": this.username,
                    "affiliation": this.affiliation,
                    "user": this.name,
                    "email": this.email,
                    "event": config.NAMESPACE,
                    "created_at": new Date().getTime(),
                    "approved": this.approved,
                    "approved_on": this.approved_on
                }
            });
            console.log(response);
        } catch (err) {
            console.error(err)
        }
        console.log("Done.");
    };

    async delete() {
        console.log("deleting user from ES...");
        try {
            const response = await this.es.deleteByQuery({
                index: 'mlfront_users', type: 'docs',
                body: { query: { match: { "_id": this.id } } }
            });
            console.log(response);
        } catch (err) {
            console.error(err)
        }
        console.log("Done.");
    };

    async update() {
        console.log("Updating user info in ES...");
        try {
            const response = await this.es.update({
                index: 'mlfront_users', type: 'docs', id: this.id,
                body: {
                    doc: {
                        "approved_on": this.approved_on,
                        "approved": this.approved
                    }
                }
            });
            console.log(response);
        } catch (err) {
            console.error(err)
        }
        console.log("Done.");
    };

    async load() {
        console.log("getting user's info...");

        try {
            const response = await this.es.search({
                index: 'mlfront_users', type: 'docs',
                body: {
                    query: {
                        bool: {
                            must: [
                                { match: { event: config.NAMESPACE } },
                                { match: { _id: this.id } }
                            ]
                        }
                    }
                }
            });
            // console.log(response);
            if (response.hits.total == 0) {
                console.log("user not found.");
                return false;
            }
            else {
                console.log("User found.");
                var obj = response.hits.hits[0]._source;
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
            };
        } catch (err) {
            console.error(err)
        }
        console.log('Done.');
        return false;
    };

    async approve() {
        this.approved = true;
        this.approved_on = new Date().getTime();
        await this.update();
        var body = {
            from: config.NAMESPACE + "<" + config.NAMESPACE + "@maniac.uchicago.edu>",
            to: this.email,
            subject: "Authorization approved",
            text: "Dear " + this.name + ", \n\n\t" +
                " your request for access to " + config.NAMESPACE +
                " ML front has been approved.\n\nBest regards,\n\tML front Approval system."
        }
        this.send_mail_to_user(body);
    };

    send_mail_to_user(data) {
        this.mg.messages().send(data, function (error, body) {
            console.log(body);
        });
    };

    ask_for_approval() {

        if (config.hasOwnProperty("APPROVAL_EMAIL")) {

            var link = 'https://' + config.SITENAME + '/authorize/' + this.id;
            var data = {
                from: config.NAMESPACE + "<" + config.NAMESPACE + "@maniac.uchicago.edu>",
                to: config.APPROVAL_EMAIL,
                subject: "Authorization requested",
                text: "Dear Sir/Madamme, \n\n\t" + this.name +
                    " affiliated with " + this.affiliation +
                    " requested access to " + config.NAMESPACE +
                    " ML front.\n\tTo approve it use this link " + link +
                    ". To deny the request simply delete this mail.\n\nBest regards,\n\tML front Approval system"
            }
            this.send_mail_to_user(data);
        }
        else {
            console.error("Approval person's mail or mailgun key not configured.");
        }

    };

    async add_service(service) {
        try {
            service.owner = this.id;
            service.timestamp = new Date().getTime();
            service.user = this.name;
            console.log('creating service in es: ', service);
            await this.es.index({
                index: 'ml_front', type: 'docs', body: service
            }, function (err, resp, status) {
                console.log("from ES indexer:", resp);
            });
        } catch (err) {
            console.error(err)
        }
    };

    async terminate_service(name) {
        console.log('terminating service in ES: ', name, 'owned by', this.id);
        console.log('not implemented yet.');
        // try {
        //     const response = await this.es.update({
        //         index: 'ml_front', type: 'docs', id: this.id,
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
        console.log("Done.");
    };

    async get_services(servicetype) {
        console.log('getting all services of this user...');
        try {
            // _source: ["service", "name", "link", "timestamp", "gpus", 'cpus', 'memory', "link", "ttl"],
            const resp = await this.es.search({
                index: "ml_front", type: "docs",
                body: {
                    query: { match: { "owner": this.id } },
                    sort: { "timestamp": { order: "desc" } }
                }
            });
            // console.log(resp);
            var toSend = [];
            if (resp.hits.total > 0) {
                // console.log(resp.hits.hits);
                for (var i = 0; i < resp.hits.hits.length; i++) {
                    var obj = resp.hits.hits[i]._source;
                    // console.log(obj);
                    var start_date = new Date(obj.timestamp).toUTCString();
                    if (servicetype == "privatejupyter") {
                        var end_date = new Date(obj.timestamp + obj.ttl * 86400000).toUTCString();
                        var serv = [obj.service, obj.name, start_date, end_date, obj.gpus, obj.cpus, obj.memory]
                        toSend.push(serv);
                    }
                    if (servicetype == "sparkjob") {
                        var serv = [obj.service, obj.name, start_date, obj.executors, obj.path]
                        toSend.push(serv);
                    }
                }
            } else {
                console.log("no services found.");
            }
            return toSend;
        } catch (err) {
            console.error(err)
        }
        return [];
    };

    print() {
        console.log("- user id", this.id);
        console.log("- user name", this.name);
        console.log("- email", this.email);
        console.log("- affiliation", this.affiliation);
        console.log("- created at", this.created_at);
        console.log("- approved", this.approved);
        console.log("- approved on", this.approved_on);
    };

    async get_all_users() {

        console.log('getting all users info from es.');
        try {
            const resp = await this.es.search({
                index: 'mlfront_users', type: 'docs',
                body: {
                    size: 1000,
                    query: { match: { "event": config.NAMESPACE } },
                    sort: { "created_at": { order: "desc" } }
                }
            });
            // console.log(resp);
            var toSend = [];
            if (resp.hits.total > 0) {
                // console.log("Users found:", resp.hits.hits);
                for (var i = 0; i < resp.hits.hits.length; i++) {
                    var obj = resp.hits.hits[i]._source;
                    // console.log(obj);
                    var created_at = new Date(obj.created_at).toUTCString();
                    var approved_on = new Date(obj.approved_on).toUTCString();
                    var serv = [obj.user, obj.email, obj.affiliation, created_at, obj.approved, approved_on]
                    toSend.push(serv);
                }
            } else {
                console.log("No users found.");
            }
            return toSend;
        } catch (err) {
            console.error(err)
        }
        console.log('Done.');
    };

}




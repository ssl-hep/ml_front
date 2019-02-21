module.exports = function (app) {

    app.get('/get_users_services', async function (req, res) {
        console.log('user:', req.session.sub_id, 'services.');
        await users_services(req.session.sub_id)
            .then(function (resp) {
                console.log(resp);
                res.status(200).send(resp);
            }, function (err) {
                console.trace(err.message);
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

    app.get('/users_data', async function (req, res) {
        console.log('Sending all users info...');
        const user = new userm();
        var data = await user.get_all_users();
        res.status(200).send(data);
        console.log('Done.');
    });



}
module.exports = function (app) {

    app.get('/private_jupyter_lab_manage', async function (req, res) {
        console.log('Private Jupyter Lab called!');
        res.render('PrivateJupyterLab_manage', req.session);
    });

    app.get('/private_jupyter_lab_create', async function (req, res) {
        console.log('Private Jupyter Lab create called!');
        res.render('PrivateJupyterLab_create', req.session);
    });

}
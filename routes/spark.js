module.exports = function (app) {

    app.get('/spark_job_manage', async function (req, res) {
        console.log('Spark Job manage called!');
        res.render('SparkJob_manage', req.session);
    });

    app.get('/spark_job_create', async function (req, res) {
        console.log('Spark job create called!');
        res.render('SparkJob_create', req.session);
    });

}
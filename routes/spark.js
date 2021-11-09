module.exports = function sp(app) {
  app.get('/spark_job_manage', async (req, res) => {
    console.log('Spark Job manage called!');
    res.render('SparkJob_manage', req.session);
  });

  app.get('/spark_job_create', async (req, res) => {
    console.log('Spark job create called!');
    res.render('SparkJob_create', req.session);
  });
};

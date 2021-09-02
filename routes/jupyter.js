module.exports = function pj(app, config) {
  app.get('/private_jupyter_lab_manage', async (req, res) => {
    console.log('Private Jupyter Lab called!');
    if (req.session.name === undefined) {
      res.render('index', req.session);
    } else {
      res.render('PrivateJupyterLab_manage', req.session);
    }
  });

  app.get('/private_jupyter_lab_create', async (req, res) => {
    console.log('Private Jupyter Lab create called!');
    const params = {
      loggedIn: req.session.loggedIn,
      Title: config.TITLE,
      plugins: config.PLUGINS,
      images: config.IMAGES,
    };
    res.render('PrivateJupyterLab_create', params);
  });
};

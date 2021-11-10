; (function () {
  'use strict';

  const dropdown = () => {
    $('.has-dropdown').mouseenter(function () {
      let $this = $(this);
      $this
        .find('.dropdown')
        .css('display', 'block')
        .addClass('animated-fast fadeInUpMenu');
    }).mouseleave(function () {
      let $this = $(this);
      $this
        .find('.dropdown')
        .css('display', 'none')
        .removeClass('animated-fast fadeInUpMenu');
    });
  };

  const tabs = () => {
    // Auto adjust height
    $('.gtco-tab-content-wrap').css('height', 0);
    const autoHeight = function () {
      setTimeout(() => {
        const tabContentWrap = $('.gtco-tab-content-wrap');
        const tabHeight = $('.gtco-tab-nav').outerHeight();
        const formActiveHeight = $('.tab-content.active').outerHeight();
        const totalHeight = parseInt(tabHeight + formActiveHeight + 90, 10);

        tabContentWrap.css('height', totalHeight);

        $(window).resize(() => {
          const tabContentWrap = $('.gtco-tab-content-wrap');
          const tabHeight = $('.gtco-tab-nav').outerHeight();
          const formActiveHeight = $('.tab-content.active').outerHeight();
          const totalHeight = parseInt(tabHeight + formActiveHeight + 90, 10);
          tabContentWrap.css('height', totalHeight);
        });
      }, 100);
    };

    autoHeight();

    // Click tab menu
    $('.gtco-tab-nav a').on('click', (event) => {
      const $this = $(this);
      const tab = $this.data('tab');

      $('.tab-content')
        .addClass('animated-fast fadeOutDown');

      $('.tab-content')
        .removeClass('active');

      $('.gtco-tab-nav li').removeClass('active');

      $this
        .closest('li')
        .addClass('active');

      $this
        .closest('.gtco-tabs')
        .find(`.tab-content[data-tab-content="${tab}"]`)
        .removeClass('animated-fast fadeOutDown')
        .addClass('animated-fast active fadeIn');

      autoHeight();
      event.preventDefault();
    });
  };

  const loaderPage = () => {
    $('.gtco-loader').fadeOut('slow');
  };

  $('#private_jupyter_create_button').click((event) => {
    event.preventDefault();
    console.log('Private jupyter creator called.');

    $('#name_valid').text('').show();
    $('#pass_valid').text('').show();

    const data = {};
    if ($('#name').val() === '') {
      $('#name_valid').text('Name is mandatory!').show();
      return;
    }
    let inp = $('#name').val();
    inp = inp.toLowerCase();
    inp = inp.replace(' ', '-');
    inp = inp.replace('.', '-');
    inp = inp.replace(':', '-');
    inp = inp.replace('_', '-');
    $('#name').val(inp);

    if ($('#password').val() === '') {
      $('#pass_valid').text('Password is mandatory!').show();
      return;
    }

    data.name = inp;
    data.password = $('#password').val();
    data.time = $('#allocation').val();
    data.gpus = $('#gpus').val();
    data.cpus = $('#cpus').val();
    data.memory = $('#memory').val();
    data.repository = $('#customgit').val();
    data.image = $('#imageselection').val();
    console.log(data);
    // call REST API to create a Private Jupyter Instance
    $('.loaderImage').show();
    let jqxhr = $.ajax({
      type: 'post',
      url: '/jupyter',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success() {
        $('.loaderImage').hide();
        alert('It can take several minutes after service status changes to "running" for the service to become available.');
        window.location.href = '/private_jupyter_lab_manage';
      },
      error(xhr, textStatus, errorThrown) {
        alert('Error code:' + xhr.status + '.  ' + xhr.responseText);
        window.location.href = '/private_jupyter_lab_manage';
      },
    });
  });

  $('#private-spark-start').submit(
    (event) => {
      event.preventDefault();

      console.log('sparkJobHandler called.');

      $('#name_valid').text('').show();
      $('#path_valid').text('').show();

      const data = {};
      if ($('#name').val() === '') {
        $('#name_valid').text('Name is mandatory!').show();
        return;
      }

      let inp = $('#name').val();
      inp = inp.toLowerCase();
      inp = inp.replace(' ', '-');
      inp = inp.replace('.', '-');
      inp = inp.replace(':', '-');
      inp = inp.replace('_', '-');
      $('#name').val(inp);

      if ($('#exe_path').val() === '') {
        $('#path_valid').text('URL is mandatory!').show();
        return;
      }

      data.name = inp;
      data.exe_path = $('#exe_path').val();
      data.executors = $('#execs').val();
      // data['memory'] = $("#memory").val();

      // call REST API to submit spark job
      let jqxhr = $.ajax({
        type: 'post',
        url: '/spark',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success(link) {
          // alert('It can take several minutes after service status changes to "running" for the service to become available.');
          window.location.href = 'SparkJob_manage.html';
        },
        error(xhr, textStatus, errorThrown) {
          alert('Error code:' + xhr.status + '.  ' + xhr.responseText);
          window.location.href = 'SparkJob_manage.html';
        },
      });
    },
  );

  $('#logout_button').click(() => {
    $.get('/logout');
    window.location.replace('/');
  });

  $(() => {
    dropdown();
    tabs();
    loaderPage();
  });
}());
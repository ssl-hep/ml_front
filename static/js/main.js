; (function () {
	'use strict';

	var dropdown = function () {

		$('.has-dropdown').mouseenter(function () {

			var $this = $(this);
			$this
				.find('.dropdown')
				.css('display', 'block')
				.addClass('animated-fast fadeInUpMenu');

		}).mouseleave(function () {
			var $this = $(this);

			$this
				.find('.dropdown')
				.css('display', 'none')
				.removeClass('animated-fast fadeInUpMenu');
		});

	};

	var tabs = function () {

		// Auto adjust height
		$('.gtco-tab-content-wrap').css('height', 0);
		var autoHeight = function () {

			setTimeout(function () {

				var tabContentWrap = $('.gtco-tab-content-wrap'),
					tabHeight = $('.gtco-tab-nav').outerHeight(),
					formActiveHeight = $('.tab-content.active').outerHeight(),
					totalHeight = parseInt(tabHeight + formActiveHeight + 90);

				tabContentWrap.css('height', totalHeight);

				$(window).resize(function () {
					var tabContentWrap = $('.gtco-tab-content-wrap'),
						tabHeight = $('.gtco-tab-nav').outerHeight(),
						formActiveHeight = $('.tab-content.active').outerHeight(),
						totalHeight = parseInt(tabHeight + formActiveHeight + 90);

					tabContentWrap.css('height', totalHeight);
				});

			}, 100);

		};

		autoHeight();


		// Click tab menu
		$('.gtco-tab-nav a').on('click', function (event) {

			var $this = $(this),
				tab = $this.data('tab');

			$('.tab-content')
				.addClass('animated-fast fadeOutDown');

			$('.tab-content')
				.removeClass('active');

			$('.gtco-tab-nav li').removeClass('active');

			$this
				.closest('li')
				.addClass('active')

			$this
				.closest('.gtco-tabs')
				.find('.tab-content[data-tab-content="' + tab + '"]')
				.removeClass('animated-fast fadeOutDown')
				.addClass('animated-fast active fadeIn');


			autoHeight();
			event.preventDefault();

		});
	};

	var loaderPage = function () {
		$(".gtco-loader").fadeOut("slow");
	};


	$("#private_jupyter_create_button").click(function (event) {
		event.preventDefault();
		console.log("Private jupyter creator called.");

		$("#name_valid").text("").show();
		$("#pass_valid").text("").show();

		var data = {}
		if ($("#name").val() === "") {
			$("#name_valid").text("Name is mandatory!").show();
			return;
		}
		else {
			var inp = $("#name").val();
			inp = inp.toLowerCase();
			inp = inp.replace(" ", "-");
			inp = inp.replace(".", "-");
			inp = inp.replace(":", "-");
			inp = inp.replace("_", "-");
			$("#name").val(inp);
		}
		if ($("#password").val() === "") {
			$("#pass_valid").text("Password is mandatory!").show();
			return;
		}

		data['name'] = inp;
		data['password'] = $("#password").val();
		data['time'] = $("#allocation").val();
		data['gpus'] = $("#gpus").val();
		data['cpus'] = $("#cpus").val();
		data['memory'] = $("#memory").val();
		data['repository'] = $("#customgit").val();
		data['image'] = $("#imageselection").val();
		console.log(data);
		// call REST API to create a Private Jupyter Instance
		var jqxhr = $.ajax({
			type: 'post',
			url: '/jupyter',
			contentType: 'application/json',
			data: JSON.stringify(data),
			success: function (link) {
				alert('It can take several minutes after service status changes to "running" for the service to become available.');
				window.location.href = "/private_jupyter_lab_manage";
			},
			error: function (xhr, textStatus, errorThrown) {
				alert('Error code:' + xhr.status + '.  ' + xhr.responseText);
				window.location.href = "/private_jupyter_lab_manage";
			}
		});

	});


	$("#private-spark-start").submit(
		function (event) {

			event.preventDefault();

			console.log("sparkJobHandler called.");

			$("#name_valid").text("").show();
			$("#path_valid").text("").show();

			data = {}
			if ($("#name").val() === "") {
				$("#name_valid").text("Name is mandatory!").show();
				return;
			}
			else {
				inp = $("#name").val();
				inp = inp.toLowerCase();
				inp = inp.replace(" ", "-");
				inp = inp.replace(".", "-");
				inp = inp.replace(":", "-");
				inp = inp.replace("_", "-");
				$("#name").val(inp);
			}
			if ($("#exe_path").val() === "") {
				$("#path_valid").text("URL is mandatory!").show();
				return;
			}

			data['name'] = inp;
			data['exe_path'] = $("#exe_path").val();
			data['executors'] = $("#execs").val();
			// data['memory'] = $("#memory").val();

			// call REST API to submit spark job
			var jqxhr = $.ajax({
				type: 'post',
				url: '/spark',
				contentType: 'application/json',
				data: JSON.stringify(data),
				success: function (link) {
					// alert('It can take several minutes after service status changes to "running" for the service to become available.');
					window.location.href = "SparkJob_manage.html";
				},
				error: function (xhr, textStatus, errorThrown) {
					alert('Error code:' + xhr.status + '.  ' + xhr.responseText);
					window.location.href = "SparkJob_manage.html";
				}
			});

		}
	)


	$("#logout_button").click(function () {
		$.get("/logout");
		window.location.replace("/");
	});


	$(function () {
		dropdown();
		tabs();
		loaderPage();
	});


}());
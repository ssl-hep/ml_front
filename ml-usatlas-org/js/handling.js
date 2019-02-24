$(document).ready(function () {

    var privateJupyterHandler = function () {
        $("#private-jupyter-start").submit(
            function (event) {

                event.preventDefault();

                console.log("privateJupyterHandler called.");

                $("#name_valid").text("").show();
                $("#pass_valid").text("").show();

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

                // call REST API to create a Private Jupyter Instance
                var jqxhr = $.ajax({
                    type: 'post',
                    url: '/jupyter',
                    contentType: 'application/json',
                    data: JSON.stringify(data),
                    success: function (link) {
                        // alert('It can take several minutes after service status changes to "running" for the service to become available.');
                        window.location.href = "PrivateJupyter_manage.html";
                    },
                    error: function (xhr, textStatus, errorThrown) {
                        alert('Error code:' + xhr.status + '.  ' + xhr.responseText);
                        window.location.href = "PrivateJupyter_manage.html";
                    }
                });

            }
        )
    };

    var sparkJobHandler = function () {
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
    };

    var logout_handler = function () {
        $("#logout_button").click(function () {
            $.get("/logout");
            window.location.replace("index.html");
        });
    }

    privateJupyterHandler();
    sparkJobHandler();
    logout_handler();

});
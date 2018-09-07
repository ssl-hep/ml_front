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
                    $("#name").val(inp);
                }
                if ($("#password").val() === "") {
                    $("#pass_valid").text("Password is mandatory!").show();
                    return;
                }

                data['name'] = $("#name").val()
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
                        alert('To access your JupyterLab please wait 1 minute and visit: ' + link);
                        window.location.href = "services.html";
                    },
                    error: function (xhr, textStatus, errorThrown) {
                        alert('Error code:' + xhr.status + '.  ' + xhr.responseText);
                        window.location.href = "services.html";
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
    logout_handler();

});
$(document).ready(function () {

    $.getJSON('/get_users_services/sparkjob', function (data) {
        console.log('running jobs: ', data);
        var table = $('#services_table').DataTable({
            data: data,
            "paging": false,
            "searching": false,
            "aoColumns": [
                { "mData": 1, "sTitle": "Name", "sWidth": "10%" },
                { "mData": 2, "sTitle": "Started at", "sWidth": "15%" },
                { "mData": 3, "sTitle": "Status", "sWidth": "5%" },
                { "mData": 4, "sTitle": "Executors", "sWidth": "15%" },
                { "mData": 5, "sTitle": "Executable", "sWidth": "20%" },
                // { "mData": 4, "sTitle": "GPUs", "sWidth": "5%" },
                // { "mData": 5, "sTitle": "Cores", "sWidth": "5%" },
                // { "mData": 6, "sTitle": "Memory", "sWidth": "5%" },
                {
                    "mData": null,
                    "bSortable": false,
                    "mRender": function (o) { return '<a href=/delete/' + o[1] + '>Delete</a>&nbsp;&nbsp;<a href=/log/' + o[1] + '>View Log</a>' }
                }
            ]
        });
    });

    $.getJSON('/get_services_from_es/sparkjob', function (data) {
        console.log('from es:', data);
        var table = $('#services_table_es').DataTable({
            data: data,
            "paging": false,
            "searching": false,
            "aoColumns": [
                { "mData": 1, "sTitle": "Name", "sWidth": "15%" },
                { "mData": 2, "sTitle": "Started at", "sWidth": "20%" },
                { "mData": 3, "sTitle": "Executors", "sWidth": "15%" },
                { "mData": 4, "sTitle": "Executable", "sWidth": "20%" },
                // { "mData": 3, "sTitle": "Ending at", "sWidth": "20%" },
                // { "mData": 4, "sTitle": "GPUs", "sWidth": "5%" },
                // { "mData": 5, "sTitle": "Cores", "sWidth": "5%" },
                // { "mData": 6, "sTitle": "Memory", "sWidth": "5%" },
            ]
        });
    });

});
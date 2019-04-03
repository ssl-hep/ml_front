$(document).ready(function () {

    $.getJSON('/get_users_services/privatejupyter', function (data) {
        console.log(data);
        var table = $('#services_table').DataTable({
            data: data,
            "paging": false,
            "searching": false,
            "aoColumns": [
                { "mData": 1, "sTitle": "Name", "sWidth": "10%" },
                { "mData": 2, "sTitle": "Started at", "sWidth": "15%" },
                { "mData": 3, "sTitle": "Ending at", "sWidth": "15%" },
                { "mData": 4, "sTitle": "GPUs", "sWidth": "5%" },
                { "mData": 5, "sTitle": "Cores", "sWidth": "5%" },
                { "mData": 6, "sTitle": "Memory", "sWidth": "5%" },
                { "mData": 7, "sTitle": "Link", "sWidth": "20%" },
                { "mData": 8, "sTitle": "Status", "sWidth": "5%" },
                {
                    "mData": null,
                    "bSortable": false,
                    "mRender": function (o) { return '<a href=/delete/' + o[1] + '>Delete</a>' }
                    // "mRender": function (o) { return '<a href=/delete/' + o[1] + '>Delete</a>&nbsp;&nbsp;<a href=/edit/' + o[1] + '>Edit</a>' }
                }
            ]
        });
    });

    $.getJSON('/get_services_from_es/privatejupyter', function (data) {
        console.log(data);
        var table = $('#services_table_es').DataTable({
            data: data,
            "paging": false,
            "searching": false,
            "aoColumns": [
                { "mData": 1, "sTitle": "Name", "sWidth": "15%" },
                { "mData": 2, "sTitle": "Started at", "sWidth": "20%" },
                { "mData": 3, "sTitle": "Ending at", "sWidth": "20%" },
                { "mData": 4, "sTitle": "GPUs", "sWidth": "5%" },
                { "mData": 5, "sTitle": "Cores", "sWidth": "5%" },
                { "mData": 6, "sTitle": "Memory", "sWidth": "5%" },
            ]
        });
    });

});
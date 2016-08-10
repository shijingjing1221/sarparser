var parsesar = function(content) {

    const munit = 1000;
    const gunit = (munit * munit);
    const round_precision = 1000;
    var db_name = "parsesar";

    var machine_info, hug_block, restart_block;
    var filtered_objs, restart_lines, keys = [];
    var sar_date = "1970/01/01";
    loadSarFile(content);

    return {
        destroy: function() {
            storedb(db_name).remove();
            machine_info = null;
            hug_block = null;
            restart_block = null;
            filtered_objs = null;
        },
        getUnits: function() {
            return {
                munit: munit,
                gunit: gunit,
                round_precision: round_precision
            }
        },

        reloadSarFile: function(content) {
            loadSarFile(content);
        },

        getFilteredObjForMem: function() {
            return filtered_objs;
        },

        getFilteredRowForMem: function() {
            return jsonArray(filtered_objs);
        },

        getRestartLines: function() {

            var regions = [];
            for (var i in restart_lines) {
                var red_line = restart_lines[i];
                var region = {};
                for (var j in filtered_objs) {
                    if (filtered_objs[j].memused == null) {
                        continue;
                    }
                    if (filtered_objs[j].x <= red_line.value) {
                        if (region.start == null || region.start < filtered_objs[j].x) {
                            region.start = filtered_objs[j].x;
                        }

                    } else if (filtered_objs[j].x > red_line.value) {
                        if (region.end == null || region.end > filtered_objs[j].x) {
                            region.end = filtered_objs[j].x;
                        }
                    }
                }
                region.class = "restart_region";
                region.fill = "black";
                region.opacity = 0.2;
                regions.push(region);
            }

            return {restart_lines: restart_lines, regions: regions};
        },

        getHugepageSize: function() {
            for (var i in hug_block) {
                var last_line_items = processLine(hug_block[i].split("\n").pop());
                if (last_line_items.length > 1) {
                    return round(parseInt(last_line_items[1]) / gunit);
                }
            }
            return null;
        },

        getMemAverage: function() {
            var avg = storedb(db_name).avg();
            return {
                x: "Average:",
                memused: round(avg.memused - avg.cached - avg.buffers),
                cached: round(avg.cached),
                buffers: round(avg.buffers),
                memfree: round(avg.memfree),
                swpused: round(avg.swpused),
                swpfree: round(avg.swpfree)
            }
        },

        getMachineInfo: function() {
            var match_result = machine_info.match(/el\d/);
            var version = match_result == null ? null : match_result.shift();
            var dateRegex = /\d{4}-\d{2}-\d{2}/;
            var date_result = machine_info.match(dateRegex);
            var dateString = date_result == null ? null : date_result.shift();
            //Remove date in machine_info
            machine_info = machine_info.replace(dateRegex, "");

            return {
                raw: machine_info,
                version: version,
                date: dateString
            };
        }

    };
    function getRestartLine() {
        var restart_lines = [];
        for (var i in restart_block) {
            var block = restart_block[i];
            var time = processLine(block).shift();
            restart_lines.push({
                value: time,
                class: 'restart',
                text: "LINUX RESTART"
            })
        }
        return restart_lines;
    }

    function loadSarFile(content) {
        var blocks, mem_block, raw_objs, combined_objs;
        blocks = content.split("\n\n");

        machine_info = blocks.shift();
        parseMachineInfo(machine_info);

        mem_block = _.filter(blocks, function(o) {
            return o.indexOf("memused") != -1 || o.indexOf("swpused") != -1;
        });

        hug_block = _.filter(blocks, function(o) {
            return o.indexOf("hugused") != -1;
        });

        restart_block = _.filter(blocks, function(o) {
            return o.indexOf("RESTART") != -1;
        });

        raw_objs = _.map(mem_block, function(block) {
            return csvJSON(block);
        });

        restart_lines = getRestartLine();

        combined_objs = storeToDb(raw_objs, db_name);

        filtered_objs = filterPropForMemObject(combined_objs);

        filtered_objs = addRestartInMemObject(filtered_objs, restart_lines);

    }


    function parseMachineInfo(machine_info) {
        var re = /\d{4}-\d{2}-\d{2}/i;
        var found = machine_info.match(re);
        if (found != null) {
            sar_date = found.shift().replace(/-/g, "/");
        }
    }

    function filterPropForMemObject(combined_objs) {
        return _.map(combined_objs, function(obj) {
            return {
                x: obj.x,
                memused: round(obj.memused - obj.cached - obj.buffers),
                cached: obj.cached,
                buffers: obj.buffers,
                memfree: obj.memfree,
                swpused: obj.swpused,
                swpfree: obj.swpfree
            }
        });
    }

    function addRestartInMemObject(combined_objs, restart_lines) {
        for (var i in restart_lines) {
            var restart_line = restart_lines[i];
            combined_objs.push({
                x: restart_line.value,
                memused: null,
                cached: null,
                buffers: null,
                memfree: null,
                swpused: null,
                swpfree: null
            })
        }
        return combined_objs;
    }


    function round(number) {
        return Math.round(number * round_precision) / round_precision;
    }

    function processLine(line) {
        var delimiter = / +/;
        var timeArray = ["AM", "PM", "am", "pm"];
        var items = line.split(delimiter);
        var first_item = items.shift();
        if (!first_item.match(/^\d{2}:\d{2}:\d{2}$/)) {
            items.unshift(first_item);
            return items;
        }
        var date_string = sar_date;
        if (items.length > 1 && timeArray.indexOf(items[0]) != -1) {
            date_string += " " + first_item;
            date_string += " " + items.shift();
        } else {
            date_string += " " + first_item;
        }
        items.unshift((new Date(date_string)).getTime());
        return items;

    }


    function csvJSON(csv) {
        var delimiter = / +/;

        var lines = csv.split("\n");

        var result = [];

        var headers = processLine(lines[0]);
        headers.shift();
        headers.unshift("x");

        for (var i = 1; i < lines.length; i++) {

            var obj = {};
            var currentline = processLine(lines[i]);

            for (var j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j];
            }

            result.push(obj);

        }

        return result; //JavaScript object
        // return JSON.stringify(result); //JSON
    }

    function jsonArray(objs) {
        var first_obj = objs[0];
        var headers = [];
        var result = [];
        for (var key in first_obj) {
            headers.push(key);
        }

        result.push(headers);

        for (var i = 0; i < objs.length; i++) {
            var obj = objs[i];
            var row = [];

            for (var key in obj) {
                row.push(obj[key]);
            }
            result.push(row);

        }

        return result; //JavaScript object
        // return JSON.stringify(result); //JSON
    }


    function storeToDb(blocks, db_name) {
        keys = [];
        storedb(db_name).remove();
        _.each(blocks, function(block) {
            _.each(block, function(obj) {
                var new_obj = {};
                for (var key in obj) {
                    if (key == 'x') {
                        new_obj[key] = obj[key];
                    } else if (key.indexOf('%') != -1) {
                        new_obj[key] = parseInt(obj[key]);
                    } else {
                        var new_key = key.replace("kb", "");
                        new_obj[key.replace("kb", "")] = round(parseInt(obj[key]) / gunit);
                    }
                    if (keys.indexOf(key) < 0) {
                        keys.push(key);
                    }
                }
                storedb(db_name).find({"x": new_obj.x}, function(err, result) {
                    if (result == undefined || result.length == 0) {
                        storedb(db_name).insert(new_obj);
                    } else {
                        storedb(db_name).update({"x": new_obj.x}, {"$set": new_obj});

                    }
                });

            });
        });
        storedb(db_name).remove({x: "Average:"});
        return storedb(db_name).find();
    };


};

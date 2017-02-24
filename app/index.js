import $ from 'jquery';
import * as d3 from "d3";
import store from 'store'

function Editor(value) {
    this.vibes = [];
    this.loadAce(value);
}

Editor.prototype.TEXT_KEY = "text";
Editor.prototype.EDITOR_ID = "editor";

Editor.prototype.loadAce = function (v) {
    var editor = ace.edit(this.EDITOR_ID);
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/javascript");
    editor.setShowInvisibles(true);
    editor.setHighlightSelectedWord(true);
    editor.on('focus', onFocus);

    if (v) {
        editor.setValue(v);
        editor.gotoLine(editor.session.getLength());
    }

    editor.on('change', onChange);
    this.editor = editor;
};

function Gist(url) {
    document.getElementById("toaster-popup").MaterialSnackbar.showSnackbar({
        'message': "Loading GitHub Gist..."
    });
    $("#editor").remove();
    $("body").prepend('<div id="editor" style="overflow-y: scroll;"></div>');
    postscribe('#editor', '<script src="' + url + '.js"></script>');
    useGist = true;

    $("#edit-button").show();
    $("#gist-url").val(url);
    $("#gist-url").parent()[0].MaterialTextfield.checkDirty();
}

Gist.prototype.getText = function () {
    var gists = $(".gist-data");

    var text = [];

    gists.each(function () {
        var self = $(this);
        self.find(".blob-code-inner").each(function () {
            text.push($(this).text());
        });
    });

    return text.join('\n');
};

var currentEditor = false,
    currentGist = false;

var vibes = [],
	editor,
	TEXT_KEY = "text";

var useGist = false;

var queryString = {};

function loadQueryString() {
    queryString = {};
    location.hash.replace('#', '').split("&").forEach(function (pair) {
        if (pair === "") return;
        var parts = pair.split("=");
        queryString[parts[0]] = parts[1] &&
            decodeURIComponent(parts[1].replace(/\+/g, " "));
    });
}

loadQueryString();

function getPinEl(pin) {
	if (pin === Moment.Actuators.topLeft.pin) {
		return $("#top-left-actuator");
	}
	if (pin === Moment.Actuators.topRight.pin) {
		return $("#top-right-actuator");
	}
	if (pin === Moment.Actuators.bottomLeft.pin) {
		return $("#bottom-left-actuator");
	}
	if (pin === Moment.Actuators.bottomRight.pin) {
		return $("#bottom-right-actuator");
	}
}

function getBarEl(pin) {
	if (pin === Moment.Actuators.topLeft.pin) {
		return $("#tl-bar");
	}
	if (pin === Moment.Actuators.topRight.pin) {
		return $("#tr-bar");
	}
	if (pin === Moment.Actuators.bottomLeft.pin) {
		return $("#bl-bar");
	}
	if (pin === Moment.Actuators.bottomRight.pin) {
		return $("#br-bar");
	}
}

function computeScale(x) {
	return (3.0 * x / 100.0) + 1.0;
}

Moment.setTimeout = window.setTimeout;
Moment.clearTimeout = window.clearTimeout;
Moment.setInterval = window.setInterval;
Moment.clearInterval = window.clearInterval;

var currentLooper = false;
var currentGraphInterval = false;
var centiSeconds = 200; // hundredths of seconds in chart

Moment.LED.setColor = function(color) {
	if (currentLooper) window.clearInterval(currentLooper);
	var c = "rgb(" + color.red + "," + color.green + "," + color.blue + ")";
	$("#center-led")
		.css('transition-duration', '')
		.css('background-color', c);
};

Moment['_tween_led_color'] = function (r, g, b, func, duration) {
	if (currentLooper) window.clearInterval(currentLooper);
	var c = "rgb(" + r + "," + g + "," + b + ")";

	function startTween() {
		$("#center-led")
			.css('transition-duration', duration + 'ms')
			.css('background-color', c);
	}

	startTween.duration = duration;

	$("#center-led").data('last-tween', startTween);

    window.setTimeout(startTween, centiSeconds * 5);
}

Moment['_loop_led_color'] = function (r, g, b, func, duration) {
	if (currentLooper) window.clearInterval(currentLooper);
	var c = "rgb(" + r + "," + g + "," + b + ")";

	function startLoop() {
		$("#center-led")
			.css('transition-duration', duration + 'ms')
			.css('background-color', c);
	}

	var loop = true;

	startLoop.duration = duration;

	function runLoop() {
		startLoop();
		var fn = $("#center-led").data('last-tween');

		window.setTimeout(fn, duration);
	}

    window.setTimeout(function () {
        currentLooper = window.setInterval(runLoop, duration + $("#center-led").data('last-tween').duration);
    }, centiSeconds * 5);
}

Moment._add_transition = function(pin, start, end, func, duration, position, delay) {
	vibes.push({
		'pin': pin,
		'start': start,
		'end': end,
		'func': func,
		'duration': duration,
		'position': position,
		'delay': delay
	});

	var pinEl = getPinEl(pin),
		barEl = getBarEl(pin);

	var startScale = computeScale(start);

	function executeTransition() {
		console.log("Start scale: ", startScale);
		pinEl.css('transform', 'scale(' + startScale + ')');
		barEl.css('transform', 'scaleY(' + start / 100.0 + ')');

		var endScale = computeScale(end);

		window.setTimeout(function () {

		pinEl.css({
			'transition-duration': duration + 'ms',
			'transition-property': 'transform'
		});

		barEl.css({
			'transition-duration': duration + 'ms',
			'transition-property': 'transform'
		});

		// TODO: implement position handling
		// TODO: implement easing equations

		pinEl.css('transform', 'scale(' + endScale + ')');
		console.log("End scale: ", endScale);
		barEl.css('transform', 'scaleY(' + end / 100.0 + ')');

		}, 5);
	}

	window.setTimeout(executeTransition, delay + centiSeconds * 5);

};

function onChange() {
	var v = editor.getValue();
	store.set(TEXT_KEY, v);
}

var actuatorColors = [
    "#91BD00",
    "#fdaa00",
    "#007eed",
    "#850068"
];

function onRun() {
	vibes = [];
	$("#top-left-actuator").removeAttr('style');
	$("#top-right-actuator").removeAttr('style');
	$("#bottom-left-actuator").removeAttr('style');
	$("#bottom-right-actuator").removeAttr('style');
    $("#top-left-actuator").css('background-color', actuatorColors[0]);
    $("#top-right-actuator").css('background-color', actuatorColors[1]);
    $("#bottom-left-actuator").css('background-color', actuatorColors[2]);
    $("#bottom-right-actuator").css('background-color', actuatorColors[3]);
	$(".actuator-bar").removeAttr('style');
    if (currentLooper) window.clearInterval(currentLooper);
    if (currentGraphInterval) window.clearInterval(currentGraphInterval);
    $("#center-led")
        .css('transition-duration', '')
        .css('background-color', '#000');
    $("svg").empty();

    document.getElementById("toaster-popup").MaterialSnackbar.showSnackbar({
        'message': "Running JavaScript code..."
    });

	window.setTimeout(function () {
        var code;

        if (currentGist)
            code = currentGist.getText();
        else
		    code = editor.getValue();
		code = "(function (Moment) { " + code;
		code = code + " })(Moment);";
		eval(code);

		drawChart();
	}, 100);
}

function onFocus() {
    if ($(".mdl-layout__drawer.is-visible").length > 0) {
        document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
    }
}

function onReady() {
    if (queryString.hasOwnProperty('gist')) {
        currentGist = new Gist(queryString.gist);
    }
    else {
        currentEditor = new Editor(store.get(TEXT_KEY));
    }

    $("#run-button").on("click", onRun);

    $("mdl-js-progress").on("mdl-componentupgraded", function () {
        this.MaterialProgress.setProgress(0);
    });

    $("#vim-switch").on("change", function () {
        if ($(this).is(":checked")) {
            editor.setKeyboardHandler("ace/keyboard/vim");
        }
        else {
            editor.setKeyboardHandler(null);
        }
    });

    (function () {
	    var realConsoleLog = console.log;
		console.log = function () {
		    var message = [].join.call(arguments, " ");
		    // Display the message somewhere... (jQuery example)
		    var d = $("#repl-content").append($("<div />").text(message));
		    d.scrollTop(d.prop("scrollHeight"));
		    realConsoleLog.apply(console, arguments);
		};
    })();

    drawChart();

    $("#gist-url").on("paste submit", function () {
        var self = this;
        window.setTimeout(function () { self.blur(); }, 10);
    })
    .on("blur", function () {
        var val = this.value.replace(/\s/g, '');
        if (val.length == 0)
            return;

        location.hash = "#gist=" + val;
        document.getElementById("toaster-popup").MaterialSnackbar.showSnackbar({
            'message': "Loading GitHub Gist..."
        });
        $("#editor").remove();
        $("body").prepend('<div id="editor" style="overflow-y: scroll;"></div>');
        postscribe('#editor', '<script src="' + val + '.js"></script>');
        useGist = true;

        $("#edit-button").show();
        document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
    });

    $("#gist-url").on("keydown", function (e) {
        if (e.which == 13) $(this).trigger("paste");
    });

    $("#edit-button").on("click", function () {
        document.getElementById("toaster-popup").MaterialSnackbar.showSnackbar({
            'message': "Loading Moment editor..."
        });
        var v = currentGist.getText();
        $("#editor").remove();
        $("body").prepend('<pre id="editor"></pre>');
        location.hash = "";
        useGist = false;
        editor = ace.edit("editor");

        currentEditor = new Editor(v);
        currentGist = false;

        $("#edit-button").hide();
        $("#gist-url").val('');
    });

    $(window).on("hashchange", function () {
        loadQueryString();
        if (queryString.hasOwnProperty('gist')) {
            currentGist = new Gist(queryString.gist);
        }
        else {

        }
    });
}

$(document).ready(onReady);

function getIntensity(t, v) {
	t -= v.delay;
	t += v.position;

	var intensity = v.start;

	var fn = MomentEffects[v.func];

	intensity += fn(t / v.duration) * (v.end - v.start);
	return intensity;
}

function computeValue(t, items, previous) {
	var v;
	for (var i = 0, len = items.length; i < len; i++) {
		v = items[i];
		if (t >= v.delay && t <= v.delay + v.duration - v.position) {
			return getIntensity(t, v);
		}
	}
	return previous;
}

function drawSpark(id, data, color) {
    color = color || "#000";
    var interpolation = "basis",
        animate = true,
        updateDelay = 10,
        transitionDelay = 10,
        width = 400,
        height = 70;

    var graph = d3.select(id).append("svg:svg").attr("width", "100%").attr("height", "100%");
    var x = d3.scaleLinear().domain([0, centiSeconds]).range([-5, width]);
    var y = d3.scaleLinear().domain([100, 0]).range([0, height]);

    var line = d3.line()
        .x(function (d, i) {
            return x(i);
        })
        .y(function (d, i) {
            return y(d);
        })
        .curve(d3.curveBasis);

    graph.append("svg:path").attr("d", line(data));
    graph.selectAll('path')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .style("stroke", function(d) { return color; });

    function redrawWithAnimation () {
        graph.selectAll("path")
            .data([data]) // set the new data
            .attr("d", line) // apply the new data values ... but the new value is hidden at this point off the right of the canvas
    }

    return redrawWithAnimation;
}

var sparkIds = ["#tl-spark", "#tr-spark", "#bl-spark", "#br-spark"];

function drawChart() {
    var actuators = [{}, {}, {}, {}];

    actuators.forEach(function (a, i) {
        var next = 0, previous = 0;
        a['pin'] = i;
        a['sparkid'] = sparkIds[i];
        var values = [];
        a['values'] = values;
        a['color'] = actuatorColors[i];
        a['currentData'] = Array.apply(null, Array(centiSeconds)).map(Number.prototype.valueOf,0);

        var items = vibes.filter(function (v) {
            return v.pin === i;
        });

        var maxDuration = items.reduce(function (acc, val) {
            var d = val.delay + val.duration - val.position;

            if (d > acc)
                return d;
            else
                return acc;
        }, 0);

        for (var j = 0, len = maxDuration; j <= len; j+= 10) {
            next = computeValue(j, items, previous);
            values.push({'time': j, 'intensity': next});
            values.push({'time': j, 'intensity': next});
            values.push({'time': j, 'intensity': next});
            values.push({'time': j, 'intensity': next});
            previous = next;
        }
    });

    var xDomain = [],
        xExtent;

    vibes.forEach(function (v) {
        xDomain.push(v['delay']);
        xDomain.push(v['delay'] + v['duration'] - v['position']);
    });

    xExtent = d3.extent(xDomain);

    actuators.forEach(function (a, i) {
        var max = xExtent[1] / 10;
        var t = a['values'].length * 10;
        var v;

        if (a['values'].length == 0)
            v = 0;
        else
            v = a['values'][a['values'].length - 1].intensity;
        while (a['values'].length < max) {
            t += 10;
            a['values'].push({
                'time': t,
                'intensity': v
            });
        }

        a['redraw'] = drawSpark(a['sparkid'], a['currentData'], a['color']);
    });

    var timeCountCs = 0;

    function drawSparks() {
        actuators.forEach(function (a, i) {
            a['currentData'].shift();
            if (timeCountCs >= a['values'].length) {
                a['currentData'].push(a['values'][a['values'].length - 1]['intensity']);
            }
            else {
                a['currentData'].push(a['values'][timeCountCs]['intensity']);
            }
            a['redraw']();
            timeCountCs += 1;
        });
    }
    currentGraphInterval = window.setInterval(drawSparks, 10);
}

(function () {

var M_PI = 3.14159265358979323846;
var M_PI_2 = 1.57079632679;

var pow = Math.pow,
	sqrt = Math.sqrt,
	sin = Math.sin;

function out_effect(p) {
    return 0.0;
}

function in_effect(p) {
    return 1.0;
}

function linear_effect(p) {
    return p;
}

function quadratic_effect(p) {
    return p * p;
}

function inverse_quadratic_effect(p) {
    return -(p * (p - 2));
}

function combined_quadratic_effect(p) {
    if(p < 0.5)
    {
        return 2 * p * p;
    }
    else
    {
        return (-2 * p * p) + (4 * p) - 1;
    }
}

function cubic_effect(p) {
    return p * p * p;
}

function inverse_cubic_effect(p) {
    var f = (p - 1.0);
    return f * f * f + 1.0;
}

function combined_cubic_effect(p) {
    if(p < 0.5)
    {
        return 4.0 * p * p * p;
    }
    else
    {
        var f = ((2.0 * p) - 2.0);
        return 0.5 * f * f * f + 1;
    }
}

function quartic_effect(p) {
    return p * p * p * p;
}

function inverse_quartic_effect(p) {
    var f = (p - 1.0);
    return f * f * f * (1 - p) + 1;
}

function combined_quartic_effect(p) {
    if(p < 0.5)
    {
        return 8 * p * p * p * p;
    }
    else
    {
        var f = (p - 1);
        return -8 * f * f * f * f + 1;
    }
}

function quintic_effect(p) {
    return p * p * p * p * p;
}

function inverse_quintic_effect(p) {
    var f = (p - 1.0);
    return f * f * f * f * f + 1;
}

function combined_quintic_effect(p) {
    if(p < 0.5)
    {
        return 16 * p * p * p * p * p;
    }
    else
    {
        var f = ((2 * p) - 2);
        return  0.5 * f * f * f * f * f + 1;
    }
}

function sine_effect(p) {
    return sin((p - 1) * M_PI_2) + 1;
}

function inverse_sine_effect(p) {
    return sin(p * M_PI_2);
}

function combined_sine_effect(p) {
    return 0.5 * (1 - cos(p * M_PI));
}

function circular_effect(p) {
    return 1 - sqrt(1 - (p * p));
}

function inverse_circular_effect(p) {
    return sqrt((2 - p) * p);
}

function combined_circular_effect(p) {
    if(p < 0.5)
    {
        return 0.5 * (1 - sqrt(1 - 4 * (p * p)));
    }
    else
    {
        return 0.5 * (sqrt(-((2 * p) - 3) * ((2 * p) - 1)) + 1);
    }
}

function exponential_effect(p) {
    return (p == 0.0) ? p : pow(2, 10 * (p - 1));
}

function inverse_exponential_effect(p) {
    return (p == 1.0) ? p : 1 - pow(2, -10 * p);
}

function combined_exponential_effect(p) {
    if(p == 0.0 || p == 1.0) return p;

    if(p < 0.5)
    {
        return 0.5 * pow(2, (20 * p) - 10);
    }
    else
    {
        return -0.5 * pow(2, (-20 * p) + 10) + 1;
    }
}

function elastic_effect(p) {
    return sin(13 * M_PI_2 * p) * pow(2, 10 * (p - 1));
}

function inverse_elastic_effect(p) {
    return sin(-13 * M_PI_2 * (p + 1)) * pow(2, -10 * p) + 1;
}

function combined_elastic_effect(p) {
    if(p < 0.5)
    {
        return 0.5 * sin(13 * M_PI_2 * (2 * p)) * pow(2, 10 * ((2 * p) - 1));
    }
    else
    {
        return 0.5 * (sin(-13 * M_PI_2 * ((2 * p - 1) + 1)) * pow(2, -10 * (2 * p - 1)) + 2);
    }
}

function back_effect(p) {
    return p * p * p - p * sin(p * M_PI);
}

function inverse_back_effect(p) {
    var f = (1 - p);
    return 1 - (f * f * f - f * sin(f * M_PI));
}

function combined_back_effect(p) {
    if(p < 0.5)
    {
        var f = 2 * p;
        return 0.5 * (f * f * f - f * sin(f * M_PI));
    }
    else
    {
        var f = (1 - (2*p - 1));
        return 0.5 * (1 - (f * f * f - f * sin(f * M_PI))) + 0.5;
    }
}

function bounce_effect(p) {
    p = 1.0 - p;
    if(p < 4/11.0)
    {
        return 1.0 - ((121 * p * p)/16.0);
    }
    else if(p < 8/11.0)
    {
        return 1.0 - ((363/40.0 * p * p) - (99/10.0 * p) + 17/5.0);
    }
    else if(p < 9/10.0)
    {
        return 1.0 - ((4356/361.0 * p * p) - (35442/1805.0 * p) + 16061/1805.0);
    }
    else
    {
        return 1.0 - ((54/5.0 * p * p) - (513/25.0 * p) + 268/25.0);
    }
}

function inverse_bounce_effect(p) {
    if(p < 4/11.0)
    {
        return (121 * p * p)/16.0;
    }
    else if(p < 8/11.0)
    {
        return (363/40.0 * p * p) - (99/10.0 * p) + 17/5.0;
    }
    else if(p < 9/10.0)
    {
        return (4356/361.0 * p * p) - (35442/1805.0 * p) + 16061/1805.0;
    }
    else
    {
        return (54/5.0 * p * p) - (513/25.0 * p) + 268/25.0;
    }
}

function combined_bounce_effect(p) {
    if(p < 0.5)
    {
        return 0.5 * bounce_effect(p*2);
    }
    else
    {
        return 0.5 * inverse_bounce_effect(p * 2 - 1) + 0.5;
    }
}

var MomentEffects = [
    out_effect,         in_effect,                  linear_effect,
    quadratic_effect,   inverse_quadratic_effect,   combined_quadratic_effect,
    cubic_effect,       inverse_cubic_effect,       combined_cubic_effect,
    quartic_effect,     inverse_quartic_effect,     combined_quartic_effect,
    quintic_effect,     inverse_quintic_effect,     combined_quintic_effect,
    sine_effect,        inverse_sine_effect,        combined_sine_effect,
    circular_effect,    inverse_circular_effect,    combined_circular_effect,
    exponential_effect, inverse_exponential_effect, combined_exponential_effect,
    elastic_effect,     inverse_elastic_effect,     combined_elastic_effect,
    back_effect,        inverse_back_effect,        combined_back_effect,
    bounce_effect,      inverse_bounce_effect,      combined_bounce_effect
];

window.MomentEffects = MomentEffects;
})();

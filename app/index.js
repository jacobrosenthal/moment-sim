import $ from 'jquery';
import * as d3 from "d3";
import store from 'store'


var TEXT_KEY = "text"; // HTML5 localStorage key to use for saving user input

/** The class that handles actions on the main text editing pane where a
  * user inputs JavaScript code.
  */
function Editor(value) {
    this.vibes = [];
    this.loadAce(value);
}


Editor.prototype.TEXT_KEY = TEXT_KEY; // store.js key (localStorage)
Editor.prototype.EDITOR_ID = "editor"; // HTML element ID for editor container

/** Load the Ace editor into the current browser window using the EDITOR_ID
  * as the container element ID for the editor.
  */
Editor.prototype.loadAce = function (v) {
    var editor = ace.edit(this.EDITOR_ID);
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/javascript");
    editor.setShowInvisibles(true);
    editor.setHighlightSelectedWord(true);
    editor.setFontSize(14);
    editor.on('focus', onFocus);

    if (v) {
        editor.setValue(v);
        editor.gotoLine(editor.session.getLength());
        onChange();
    }

    editor.on('change', onChange);
    this.editor = editor;
    this.catchDroppedFiles();
};

/** Attach file drop events for the editor.
  */
Editor.prototype.catchDroppedFiles = function (editor) {
    if (typeof editor === 'undefined')
        editor = this.editor;

    function catchAndDoNothing(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    function drop(e) {
        catchAndDoNothing(e);
        var file = e.dataTransfer.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var contents = e.target.result;
                editor.session.setValue(contents);
                onChange();
            };
            reader.readAsText(file);
        } else {
            throw new Error("Failed to load file");
        }
    }

    function dragAndDropHook() {
        editor.container.addEventListener("dragenter", catchAndDoNothing, false);
        editor.container.addEventListener("dragover", catchAndDoNothing, false);
        editor.container.addEventListener("drop", drop, false);
    }
    dragAndDropHook();
};

/** The class the handles Github Gist content (including the display and DOM
  * events that are attached).
  */
function Gist(url) {
    $("#editor").remove();
    $("body").prepend('<div id="editor" style="overflow-y: scroll;"></div>');
    postscribe('#editor', '<script src="' + url + '.js"></script>');
    useGist = true;

    $("#edit-button").show();
    $("#compile-button").hide();
    $("#gist-url").val(url);

    $(window).on("load", function () {
        $("#gist-url").parent()[0].MaterialTextfield.checkDirty();
    });
}

/** Gets the code from the Github Gist.
  */
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

/** Get the gist URL from the HTML5 hash change API (after the hash specifying
  * the ID within url).
  */
Gist.getHashParam = function () {
    var queryString = {};
    location.hash.replace('#', '').split("&").forEach(function (pair) {
        if (pair === "") return;
        var parts = pair.split("=");
        queryString[parts[0]] = parts[1] &&
            decodeURIComponent(parts[1].replace(/\+/g, " "));
    });

    if (queryString.hasOwnProperty('gist'))
        return queryString.gist;
    else
        return false;
};

/** Variables for holding the current instances of the editor and Github
  * Gist objects.
  */
var currentEditor = false,
    currentGist = false;

var vibes = []; // array of the vibrations to execute

var useGist = false; // current state of the editor - true if Gist

/** Given a motor number, which part of the animation represents its intensity?
  */
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

/** Given a motor number, which item in the graph represents its intensity?
 */
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

/** Given an intensity, what is the size of the "sonar pulse" visual animation
  * on screen?
  */
function computeScale(x) {
	return (3.0 * x / 100.0) + 1.0;
}

// The following assignments alias Moment SDK timing functions to the browser
Moment.setTimeout = window.setTimeout.bind(window); // SDK timeouts
Moment.clearTimeout = window.clearTimeout.bind(window); // SDK timeout clear
Moment.setInterval = window.setInterval.bind(window); // SDK intervals
Moment.clearInterval = window.clearInterval.bind(window); // SDK interval clear


var currentGraphTimeout = false; // current function for refreshing the graph
var centiSeconds = 200; // hundredths of seconds in chart

/** Add a vibration to the Haptic Timeline within the simulator.
 */
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

    console.log({
        'pin': pin,
        'start': start,
        'end': end,
        'func': func,
        'duration': duration,
        'position': position,
        'delay': delay
    });
};

/** When the editor changes, store the text in HTML5 localStorage via store.js
  */
function onChange() {
	var v = currentEditor.editor.getValue();
	store.set(TEXT_KEY, v);
}

/** The color of each of the actuators on the charts and visual animation.
  */
var actuatorColors = [
    "#91BD00",
    "#fdaa00",
    "#007eed",
    "#850068"
];

/** Execute the user code and trigger the necessary animations in the simulator
  */
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
    if (currentGraphTimeout) window.clearTimeout(currentGraphTimeout);
    $("svg").empty();

    document.getElementById("toaster-popup").MaterialSnackbar.showSnackbar({
        'message': "Running JavaScript code..."
    });

	window.setTimeout(function () {
        var code;

        if (currentGist)
            code = currentGist.getText();
        else
		    code = currentEditor.editor.getValue();
		code = "(function (Moment) { " + code;
		code = code + " })(Moment);";
		eval(code);

		drawChart();
	}, 100);
}

/** When the editor is in focus, make sure that the settings drawer is closed.
  */
function onFocus() {
    if ($(".mdl-layout__drawer.is-visible").length > 0) {
        document.querySelector('.mdl-layout').MaterialLayout.toggleDrawer();
    }
}

/** Initialize all of the DOM interactions when ready.
  */
function onReady() {
    var gistUrl = Gist.getHashParam();
    if (gistUrl) {
        currentGist = new Gist(gistUrl);
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
            currentEditor.editor.setKeyboardHandler("ace/keyboard/vim");
        }
        else {
            currentEditor.editor.setKeyboardHandler(null);
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
        document.getElementById("toaster-popup").MaterialSnackbar.showSnackbar({
            'message': "Loading GitHub Gist..."
        });
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
        $("#compile-button").hide();
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

        currentEditor = new Editor(v);
        currentGist = false;

        $("#edit-button").hide();
        $("#compile-button").show();
        $("#gist-url").val('');
    });

    $("#compile-button").on("click", function (e) {
        e.preventDefault();
        var text = currentEditor.editor.getValue();

        $("#js-src-input").val(text);
        document.getElementById('js-compile').submit();
    });

    $(window).on("hashchange", function () {
        var gistUrl = Gist.getHashParam();
        if (gistUrl) {
            currentGist = new Gist(gistUrl);
        }
        else {

        }

        $("#gist-url").parent()[0].MaterialTextfield.checkDirty();
    });
}

$(document).ready(onReady); // execute on DOM ready event

// HTML ID's for the different lines in the actuator graph
var sparkIds = ["#tl-spark", "#tr-spark", "#bl-spark", "#br-spark"];

/** Class representing an individual chart where the intensity of an actuator
  * is plotted.
  */
function ActuatorChart(index) {
    this.pin = index;
    this.sparkid = sparkIds[index];
    this.color = actuatorColors[index];
    this.data = Array.apply(null, Array(centiSeconds)).map(Number.prototype.valueOf,0);

    this.redraw = this.redraw.bind(this);

    this.initChart();
}

ActuatorChart.prototype = {
    getIntensity: function (t, v) {
        t += v.position;

        var intensity = v.start;

        var fn = MomentEffects[v.func];

        intensity += fn(t / v.duration) * (v.end - v.start);
        return intensity;
    },

    initChart: function () {
        var width = 400,
            height = 70,
            color = this.color;

        this.graph = d3.select(this.sparkid).append("svg:svg").attr("width", "100%").attr("height", "100%");

        var x = d3.scaleLinear().domain([0, centiSeconds]).range([-5, width]);
        var y = d3.scaleLinear().domain([100, 0]).range([0, height]);

        this.line = d3.line()
            .x(function (d, i) {
                return x(i);
            })
            .y(function (d, i) {
                return y(d);
            })
            .curve(d3.curveBasis);


        this.graph.append("svg:path").attr("d", this.line(this.data));
        this.graph.selectAll('path')
          .attr('stroke-width', 2)
          .attr('fill', 'none')
          .style("stroke", function(d) { return color; });

        this.pinEl = getPinEl(this.pin);
    },

    redraw: function () {
        this.graph.selectAll("path").data([this.data]).attr("d", this.line);
        this.pinEl.css('transform', 'scale(' + computeScale(this.data[this.data.length / 2]) + ')');
    },

    updateData: function () {
        this.data.shift();
        var self = this;
        var i = this.pin;
        var getIntensity = this.getIntensity;

        var items = vibes.filter(function (v) {
            return v.pin === i;
        });

        items.forEach(function (vibe) {
            var t = -1 * vibe.delay, value = 0;
            if (vibe.delay <= 0 && t <= vibe.duration - vibe.position && t >= 0) {
                value = getIntensity(t, vibe);
                self.data.push(value);
            }
            else if (t > vibe.duration - vibe.position) {
                vibes.splice(vibes.indexOf(vibe), 1);
            }
            vibe.delay -= 10;
        });

        if (this.data.length < centiSeconds)
            this.data.push(this.data[this.data.length - 1]);
    }
};

var actuators = [{}, {}, {}, {}],
    lastDraw = new Date(),
    totalExtraTime = 0;

function drawSparks() {
    var now = new Date();
    var ms = now - lastDraw;
    lastDraw = now;

    totalExtraTime += ms - 20;

    while (totalExtraTime > 10) {
        totalExtraTime -= 10;
        for (var i = 0; i < 4; i++) {
            var a = actuators[i];
            a.updateData();
        }
    }

    for (var i = 0; i < 4; i++) {
        var a = actuators[i];
        a.updateData();
        a.updateData();
        window.requestAnimationFrame(a.redraw);
    }

    currentGraphTimeout = window.setTimeout(drawSparks, 20);
}

function drawChart() {
    actuators = [];

    for (var i = 0; i < 4; i++)
        actuators.push(new ActuatorChart(i));

    lastDraw = new Date();
    totalExtraTime = 0;
    currentGraphTimeout = window.setTimeout(drawSparks, 20);
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

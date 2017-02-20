import $ from 'jquery';
import * as d3 from "d3";
import store from 'store'

var vibes = [],
	editor,
	TEXT_KEY = "text";

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
	startTween();
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

		window.setTimeout(fn, fn.duration);
	}

	currentLooper = window.setInterval(runLoop, duration + $("#center-led").data('last-tween').duration);
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

	window.setTimeout(executeTransition, delay);

};

function onChange() {
	var v = editor.getValue();
	store.set(TEXT_KEY, v);
}

function onRun() {
	vibes = [];
	$("#top-left-actuator").removeAttr('style');
	$("#top-right-actuator").removeAttr('style');
	$("#bottom-left-actuator").removeAttr('style');
	$("#bottom-right-actuator").removeAttr('style');
	$(".actuator-bar").removeAttr('style');

	window.setTimeout(function () {
		var code = editor.getValue();
		code = "(function (Moment) { " + code;
		code = code + " })(Moment);";
		eval(editor.getValue());

		drawChart();
	}, 100);
}

function onReady() {
    editor = ace.edit("editor");
    editor.setTheme("ace/theme/solarized_light");
    editor.session.setMode("ace/mode/javascript");
    editor.setShowInvisibles(true);
    editor.setHighlightSelectedWord(true);

    var v = store.get(TEXT_KEY);
    if (v) {
         editor.setValue(v);
         editor.gotoLine(editor.session.getLength());
    }
    editor.on('change', onChange);

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
}

$(document).ready(onReady);

function drawChart() {

var svg = d3.select("svg"),
    margin = {top: 20, right: 80, bottom: 30, left: 50},
    width = svg.attr("width") - margin.left - margin.right,
    height = svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var x = d3.scaleTime().range([0, width]),
    y = d3.scaleLinear().range([height, 0]),
    z = d3.scaleOrdinal(d3.schemeCategory10);

var line = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.time); })
    .y(function(d) { return y(d.intensity); });


var data = vibes;

  var actuators = [{}, {}, {}, {}];

  actuators.forEach(function (a, i) {
    a['pin'] = i;
    a['values'] = [];

    vibes.forEach(function (v, j) {
      if (v.pin == i) {
        a['values'].push({'time': v['delay'], 'intensity': v['start']});
        a['values'].push({'time': v['delay'] + v['duration'] - v['position'], 'intensity': v['end']});
      }
    });

    if (a['values'].length == 0) {
        a['values'].push({
            'time': 0,
            'intensity': 0
        });
    }
  });

  var xDomain = [];
  vibes.forEach(function (v) {
    xDomain.push(v['delay']);
    xDomain.push(v['delay'] + v['duration'] - v['position']);
  });

  x.domain(d3.extent(xDomain));

  var yDomain = [];
  vibes.forEach(function (v) {
    yDomain.push(v['start']);
    yDomain.push(v['end']);
  });

  y.domain(d3.extent(yDomain));

  z.domain([0, 1, 2, 3]);

  g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("fill", "#000")
      .text("Intensity, %");

  var actuator = g.selectAll(".actuator")
    .data(actuators)
    .enter().append("g")
      .attr("class", "actuator");

  actuator.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line(d.values); })
      .style("stroke", function(d) { return z(d.id); });

  actuator.append("text")
      .datum(function(d) { return {pin: d.pin, value: d.values[d.values.length - 1]}; })
      .attr("transform", function(d) { console.log(d); return "translate(" + x(d.value.time) + "," + y(d.value.intensity) + ")"; })
      .attr("x", 3)
      .attr("dy", "0.35em")
      .style("font", "10px sans-serif")
      .text(function(d) { return d.pin; });

}

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
    if (currentLooper) window.clearInterval(currentLooper);
    $("#center-led")
        .css('transition-duration', '')
        .css('background-color', '#000');
    $("svg").empty();

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
    editor.setTheme("ace/theme/tomorrow");
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

function getIntensity(t, v) {
	t -= v.delay;
	t += v.position;

	var intensity = v.start;

	var fn = MomentEffects[v.func];

	intensity += fn(t / v.duration) * (v.end - v.start);
	return intensity;
}

function computeValue(t, items) {
	var v;
	for (var i = 0, len = items.length; i < len; i++) {
		v = items[i];
		if (t >= v.delay && t <= v.delay + v.duration - v.position) {
			return getIntensity(t, v);
		}
	}
	return 0;
}

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
    var values = [];
    a['values'] = values;

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
        values.push({'time': j, 'intensity': computeValue(j, items)});
    }

    console.log(values);
  });

  actuators.forEach(function (a, i) {
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
      .style("stroke", function(d) { return z(d.pin); })
      .attr('stroke-width', 2)
      .attr('fill', 'none');

  actuator.append("text")
      .datum(function(d) { return {pin: d.pin, value: d.values[d.values.length - 1]}; })
      .attr("transform", function(d) { console.log(d); return "translate(" + x(d.value.time) + "," + y(d.value.intensity) + ")"; })
      .attr("x", 3)
      .attr("dy", "0.35em")
      .style("font", "10px sans-serif")
      .text(function(d) { return d.pin; });

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

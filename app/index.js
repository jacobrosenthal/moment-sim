import $ from 'jquery';
import * as d3 from "d3";

function onReady() {
    var editor = ace.edit("editor");
    editor.setTheme("ace/theme/twilight");
    editor.session.setMode("ace/mode/javascript");
}

$(document).ready(onReady);

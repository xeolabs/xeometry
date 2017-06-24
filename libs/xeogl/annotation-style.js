(function () {
    var css = ".xeogl-annotation-pin {\
    color: #ffffff;\
    line-height: 1.8;\
    text-align: center;\
    font-family: 'monospace';\
    font-weight: bold;\
    position: absolute;\
    width: 25px;\
    height: 25px;\
    border-radius: 15px;\
    border: 2px solid #ffffff;\
    background: black;\
    visibility: hidden;\
    box-shadow: 5px 5px 15px 1px #000000;\
    z-index: 0;\
}\
.xeogl-annotation-pinClickable {\
    content: '';\
    position: absolute;\
    width: 50px;\
    height: 50px;\
    border-radius: 25px;\
    visibility: hidden;\
    z-index: 3000000;\
}\
.xeogl-annotation-label {\
    position: absolute;\
    max-width: 250px;\
    min-height: 50px;\
    padding: 8px;\
    padding-left: 12px;\
    padding-right: 12px;\
    background: black;\
    color: #ffffff;\
    -webkit-border-radius: 3px;\
    -moz-border-radius: 3px;\
    border-radius: 8px;\
    border: #ffffff solid 2px;\
    box-shadow: 5px 5px 15px 1px #000000;\
    z-index: 90000;\
}\
.xeogl-annotation-label:after {\
    content: '';\
    position: absolute;\
    border-style: solid;\
    border-width: 8px 12px 8px 0;\
    border-color: transparent black;\
    display: block;\
    width: 0;\
    z-index: 1;\
    margin-top: -11px;\
    left: -12px;\
    top: 20px;\
}\
.xeogl-annotation-label:before {\
    content: '';\
    position: absolute;\
    border-style: solid;\
    border-width: 9px 13px 9px 0;\
    border-color: transparent #ffffff;\
    display: block;\
    width: 0;\
    z-index: 0;\
    margin-top: -12px;\
    left: -15px;\
    top: 20px;\
}\
.xeogl-annotation-title {\
    font: normal 20px arial, serif;\
    margin-bottom: 8px;\
}\
.xeogl-annotation-desc {\
    font: normal 14px arial, serif;\
}";
    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';
    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
})();
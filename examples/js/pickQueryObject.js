xeometry.PickQueryObject = function (viewer) {

    var canvas = viewer.getOverlay();

    canvas.addEventListener("mousedown", function (e) {
        if (e.which === 1) {// Left button
            var canvasPos = getClickCoordsWithinElement(e);
            var hit = viewer.pickSurface(canvasPos);
            if (hit) {
                alert(JSON.stringify(hit, null, "\t"));
            }
        }
        e.preventDefault();
    });

    function getClickCoordsWithinElement(event) {
        var coords = [0, 0];
        if (!event) {
            event = window.event;
            coords.x = event.x;
            coords.y = event.y;
        }
        else {
            var element = event.target;
            var totalOffsetLeft = 0;
            var totalOffsetTop = 0;

            while (element.offsetParent) {
                totalOffsetLeft += element.offsetLeft;
                totalOffsetTop += element.offsetTop;
                element = element.offsetParent;
            }
            coords[0] = event.pageX - totalOffsetLeft;
            coords[1] = event.pageY - totalOffsetTop;
        }
        return coords;
    }
};

var str = [
    "{",
    "   eye:" + JSON.stringify(viewer.getEye(), null, "\t") + ",",
    "   look:" + JSON.stringify(viewer.getLook(), null, "\t") + ",",
    "   up:" + JSON.stringify(viewer.getUp(), null, "\t"),
    "};"
];

console.log(str.join(","));



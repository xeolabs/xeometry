xeometry.CameraControl = function (viewer, cfg) {

    cfg = cfg || {};

    var firstPerson = !!cfg.firstPerson;
    var mouseOrbitSens = cfg.mouseOrbitSens || 1.0;
    var mousePanSens = cfg.mousePanSens || 0.1;

    var canvas = viewer.getOverlay();

    canvas.oncontextmenu = function (e) {
        e.preventDefault();
    };

    // Mouse orbit

    (function () {

        var lastX;
        var lastY;
        var xDelta = 0;
        var yDelta = 0;
        var down = false;
        var over = false;
        var angle;

        canvas.addEventListener("mousedown", function (e) {
            if (!over) {
                return;
            }
            if (e.which === 1) {// Left button
                down = true;
                xDelta = 0;
                yDelta = 0;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            //e.preventDefault();
        });

        canvas.addEventListener("mouseup", function () {
            down = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseenter", function () {
            over = true;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseleave", function () {
            over = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mousemove", function (e) {
            if (!over) {
                return;
            }
            if (!down) {
                return;
            }
            var x = e.clientX;
            var y = e.clientY;
            var scaleSens = 0.5;
            var xDelta = (x - lastX) * scaleSens * mouseOrbitSens;
            var yDelta = (y - lastY) * scaleSens *mouseOrbitSens;
            lastX = x;
            lastY = y;
            if (xDelta !== 0) {
                angle = -xDelta * mouseOrbitSens;
                if (firstPerson) {
                    viewer.rotateLookY(angle);
                } else {
                    viewer.rotateEyeY(angle);
                }
            }
            if (yDelta !== 0) {
                angle = yDelta * mouseOrbitSens;
                if (firstPerson) {
                    viewer.rotateLookX(-angle);
                } else {
                    viewer.rotateEyeX(angle);
                }
            }
        });

    })();

    // Mouse pan

    (function () {

        var lastX;
        var lastY;
        var xDelta = 0;
        var yDelta = 0;
        var down = false;
        var over = false;
        var angle;

        canvas.addEventListener("mousedown", function (e) {
            if (!over) {
                return;
            }
            if (e.which === 3) {// Right button
                down = true;
                xDelta = 0;
                yDelta = 0;
                lastX = e.clientX;
                lastY = e.clientY;
                e.preventDefault();
            }
        });

        canvas.addEventListener("mouseup", function () {
            down = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseenter", function () {
            over = true;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mouseleave", function () {
            over = false;
            xDelta = 0;
            yDelta = 0;
        });

        canvas.addEventListener("mousemove", function (e) {
            if (!over) {
                return;
            }
            if (!down) {
                return;
            }
            var x = e.clientX;
            var y = e.clientY;
            var xDelta = (x - lastX) * mousePanSens;
            var yDelta = (y - lastY) * mousePanSens;
            lastX = x;
            lastY = y;
            if (xDelta !== 0 || yDelta !== 0) {
                viewer.pan([xDelta, yDelta, 0]);
            }
        });

    })();

    // Mouse picking

    (function () {

        var downX;
        var downY;

        canvas.addEventListener("mousedown", function (e) {
            if (e.which !== 1) {// Left button
                return;
            }
            downX = e.clientX;
            downY = e.clientY;
        });

        canvas.addEventListener("mouseup", function (e) {
            if (e.which !== 1) {// Left button
                return;
            }
            if (Math.abs(e.clientX - downX) > 3 || Math.abs(e.clientY - downY) > 3) {
                return;
            }
            var canvasPos = getCoordsWithinElement(e);
            var hit = viewer.pickSurface(canvasPos);
            if (hit) {
                var vfd = viewer.getViewFitDuration();
               // viewer.setViewFitDuration(1.0);
                viewer.viewFit(hit.id);
          //      viewer.setViewFitDuration(vfd);
               // alert(JSON.stringify(hit, null, "\t"));
                e.preventDefault();
            }
        });

    })(this);

    function getCoordsWithinElement(event) {
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
